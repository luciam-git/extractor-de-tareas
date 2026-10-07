import Anthropic from "@anthropic-ai/sdk";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SYSTEM, construirMensaje } from "../prompt.js";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptDirectory, "..");
const resultsDirectory = join(scriptDirectory, "resultados");
const errorsPath = join(resultsDirectory, "errores.log");
const meetingDate = "2026-10-27";
const defaultModel = "claude-opus-5-5";
const participantList = "Marina, Clara, Andr\u00e9s, Tom\u00e1s, Raquel, Juli\u00e1n, Nerea, \u00c1lvaro";

const transcriptPaths = {
  meet: join(projectDirectory, "demo", "transcripcion.txt"),
  teams: join(scriptDirectory, "reunion-teams.txt"),
  otter: join(scriptDirectory, "reunion-otter.txt"),
  corrido: join(scriptDirectory, "reunion-corrido.txt"),
};

const outputSchema = {
  type: "object",
  properties: {
    tareas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tarea: { type: "string" },
          responsable: { type: "string" },
          fecha_limite: { type: "string" },
          certeza: { type: "string", enum: ["alta", "media", "baja"] },
          cita: { type: "string" },
        },
        required: ["tarea", "responsable", "fecha_limite", "certeza", "cita"],
        additionalProperties: false,
      },
    },
    pendientes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          descripcion: { type: "string" },
          cita: { type: "string" },
        },
        required: ["descripcion", "cita"],
        additionalProperties: false,
      },
    },
  },
  required: ["tareas", "pendientes"],
  additionalProperties: false,
};

function parseArguments(args) {
  const options = {
    model: defaultModel,
    format: "meet",
    withParticipants: false,
    pass: 1,
    all: false,
    dryRun: false,
    selected: new Set(),
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--modelo" || argument === "--formato" || argument === "--pasada") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Falta un valor para ${argument}.`);
      index += 1;
      if (argument === "--modelo") {
        if (!/^[a-zA-Z0-9._-]+$/.test(value)) throw new Error("Nombre de modelo no valido.");
        options.model = value;
        options.selected.add("model");
      } else if (argument === "--formato") {
        if (!Object.hasOwn(transcriptPaths, value)) {
          throw new Error("Formato no valido. Usa meet, teams, otter o corrido.");
        }
        options.format = value;
        options.selected.add("format");
      } else {
        const pass = Number(value);
        if (!Number.isInteger(pass) || pass < 1) throw new Error("La pasada debe ser un entero positivo.");
        options.pass = pass;
        options.selected.add("pass");
      }
    } else if (argument === "--participantes") {
      options.withParticipants = true;
      options.selected.add("participants");
    } else if (argument === "--todo") {
      options.all = true;
    } else if (argument === "--dry-run") {
      options.dryRun = true;
    } else {
      throw new Error(`Argumento no reconocido: ${argument}`);
    }
  }

  if (options.all && options.selected.size > 0) {
    throw new Error("--todo no se combina con --modelo, --formato, --pasada o --participantes.");
  }
  return options;
}

function createRuns(options) {
  if (!options.all) {
    return [{
      model: options.model,
      format: options.format,
      withParticipants: options.withParticipants,
      pass: options.pass,
    }];
  }

  const models = ["claude-haiku-4-5-20251001", "claude-opus-5-5"];
  const configurations = [
    { format: "meet", withParticipants: false },
    { format: "teams", withParticipants: false },
    { format: "otter", withParticipants: false },
    { format: "corrido", withParticipants: false },
    { format: "corrido", withParticipants: true },
  ];
  const runs = [];

  for (const pass of [1, 2, 3]) {
    for (const model of models) {
      for (const configuration of configurations) {
        runs.push({ model, pass, ...configuration });
      }
    }
  }
  return runs;
}

function getResultPath(run) {
  const participantMode = run.withParticipants ? "con" : "sin";
  return join(resultsDirectory, run.model, `${run.format}-${participantMode}-p${run.pass}.json`);
}

function getCommitHash() {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: projectDirectory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "desconocido";
  }
}

function pause(milliseconds) {
  return new Promise((resolvePause) => setTimeout(resolvePause, milliseconds));
}

function getHttpStatus(error) {
  const status = Number(error?.status ?? error?.statusCode);
  return Number.isInteger(status) ? status : null;
}

function sanitizeApiMessage(message, transcript) {
  let sanitized = String(message ?? "");
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) sanitized = sanitized.replaceAll(apiKey, "[clave omitida]");

  const sensitiveText = new Set([
    transcript,
    ...transcript.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length >= 16),
  ]);
  for (const text of sensitiveText) {
    if (!text) continue;
    const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    sanitized = sanitized.replace(new RegExp(escapedText, "giu"), "[transcripcion omitida]");
  }
  return sanitized;
}

function getApiErrorDetails(error, transcript) {
  const apiError = error?.error;
  const type = typeof apiError?.type === "string" ? apiError.type : "api_error";
  const message = typeof apiError?.message === "string" ? apiError.message : error?.message;
  return { type, message: sanitizeApiMessage(message, transcript) };
}

function getStopReason(error) {
  const apiError = error?.error;
  const details = `${apiError?.type ?? ""} ${apiError?.message ?? error?.message ?? ""}`;
  if (/insufficient(?:\s+\w+){0,2}\s+(?:credits?|funds?|balance)|not enough (?:credits?|funds?)|out of (?:credits?|funds?)|(?:credits?|funds?)\s+(?:are\s+)?(?:insufficient|exhausted|too low)|balance.{0,40}(?:low|insufficient|exhausted)|(?:saldo|fondos)\s+insuficientes/i.test(details)) {
    return "saldo";
  }
  if (/authentication|unauthori[sz]ed|invalid api key|api key.{0,30}(?:invalid|missing)|not authenticated|forbidden|permission denied|access denied/i.test(details)) {
    return "autenticacion";
  }
  return null;
}

function safeErrorDescription(error) {
  const status = getHttpStatus(error);
  return status === null ? "Error de API sin codigo HTTP." : `Error de API HTTP ${status}.`;
}

async function requestWithRetries(client, run, userMessage) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await client.beta.messages.create({
        model: run.model,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: SYSTEM,
        output_config: {
          format: { type: "json_schema", schema: outputSchema },
        },
        messages: [{ role: "user", content: userMessage }],
      });
    } catch (error) {
      const status = getHttpStatus(error);
      const shouldRetry = status === 429 || (status !== null && status >= 500 && status <= 599);
      if (!shouldRetry || attempt === 2) throw error;
      await pause(2000 * (attempt + 1));
    }
  }
  throw new Error("La solicitud no produjo respuesta.");
}

async function writeResult(resultPath, result) {
  await mkdir(dirname(resultPath), { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

async function appendSafeError(run, error) {
  await mkdir(resultsDirectory, { recursive: true });
  const participantMode = run.withParticipants ? "con" : "sin";
  const status = getHttpStatus(error);
  const statusText = status === null ? "sin estado HTTP" : `HTTP ${status}`;
  await appendFile(
    errorsPath,
    `${new Date().toISOString()} ${run.model} ${run.format}-${participantMode}-p${run.pass}: ${statusText}\n`,
    "utf8",
  );
}

function responseText(response) {
  return response.content.find((block) => block.type === "text")?.text ?? "";
}

async function executeRun(client, run, commitHash) {
  const startedAt = Date.now();
  const resultPath = getResultPath(run);
  const participantMode = run.withParticipants ? "con" : "sin";
  let result;
  let taskCount = "-";
  let pendingCount = "-";
  let inputTokens = null;
  let outputTokens = null;
  let fatalError = null;
  let transcript = "";
  let executionFailed = false;

  try {
    transcript = await readFile(transcriptPaths[run.format], "utf8");
    const userMessage = construirMensaje(
      transcript,
      meetingDate,
      run.withParticipants ? participantList : "",
    );
    const response = await requestWithRetries(client, run, userMessage);
    const text = responseText(response);
    inputTokens = response.usage?.input_tokens ?? null;
    outputTokens = response.usage?.output_tokens ?? null;

    const metadata = {
      modelo: run.model,
      formato: run.format,
      participantes: participantMode,
      pasada: run.pass,
      fecha_hora: new Date().toISOString(),
      fecha_reunion: meetingDate,
      duracion_ms: Date.now() - startedAt,
      tokens_entrada: inputTokens,
      tokens_salida: outputTokens,
      commit: commitHash,
    };

    try {
      const parsedResponse = JSON.parse(text);
      result = { ...metadata, respuesta: parsedResponse };
      taskCount = Array.isArray(parsedResponse.tareas) ? parsedResponse.tareas.length : 0;
      pendingCount = Array.isArray(parsedResponse.pendientes) ? parsedResponse.pendientes.length : 0;
    } catch {
      result = {
        ...metadata,
        respuesta: null,
        texto_crudo: text,
        error: "No se pudo parsear la respuesta como JSON.",
      };
    }
  } catch (error) {
    executionFailed = true;
    const status = getHttpStatus(error);
    const stopReason = getStopReason(error);
    const description = safeErrorDescription(error);
    fatalError = stopReason ? { status, reason: stopReason } : null;
    result = {
      modelo: run.model,
      formato: run.format,
      participantes: participantMode,
      pasada: run.pass,
      fecha_hora: new Date().toISOString(),
      fecha_reunion: meetingDate,
      duracion_ms: Date.now() - startedAt,
      tokens_entrada: inputTokens,
      tokens_salida: outputTokens,
      commit: commitHash,
      respuesta: null,
      error: description,
    };
    if (error instanceof Anthropic.APIError) {
      const details = getApiErrorDetails(error, transcript);
      console.error(`Anthropic ${details.type}: ${details.message}`);
    }
    if (!stopReason) await appendSafeError(run, error);
  }

  result.duracion_ms = Date.now() - startedAt;
  if (!executionFailed) await writeResult(resultPath, result);

  const seconds = (result.duracion_ms / 1000).toFixed(1);
  const inputText = inputTokens ?? "-";
  const outputText = outputTokens ?? "-";
  console.log(
    `${run.model} ${run.format}-${participantMode} pasada ${run.pass}: ` +
    `tareas ${taskCount}, pendientes ${pendingCount}, ${seconds}s, ` +
    `tokens ${inputText}/${outputText}`,
  );

  return fatalError;
}

async function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  const runs = createRuns(options);
  if (options.dryRun) {
    let skipped = 0;
    for (const run of runs) {
      const alreadyExists = existsSync(getResultPath(run));
      if (alreadyExists) skipped += 1;
      const participantMode = run.withParticipants ? "con" : "sin";
      console.log(`${alreadyExists ? "Saltar" : "Ejecutar"}: ${run.model} ${run.format}-${participantMode}-p${run.pass}`);
    }
    console.log(`${runs.length} ejecuciones; ${skipped} se saltarian por existir.`);
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Falta ANTHROPIC_API_KEY en el entorno. No se inicio ninguna ejecucion.");
    process.exitCode = 1;
    return;
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0 });
  const commitHash = getCommitHash();
  let executed = false;

  for (const run of runs) {
    const resultPath = getResultPath(run);
    if (existsSync(resultPath)) {
      console.log(`Saltar: ${run.model} ${run.format}-${run.withParticipants ? "con" : "sin"}-p${run.pass} (ya existe).`);
      continue;
    }
    if (executed) await pause(2000);
    executed = true;

    const fatalStatus = await executeRun(client, run, commitHash);
    if (fatalStatus !== null) {
      const reason = fatalStatus.reason === "saldo" ? "Saldo insuficiente" : "Error de autenticacion";
      console.error(`${reason} (HTTP ${fatalStatus.status}). Se detuvieron las pruebas.`);
      process.exitCode = 1;
      return;
    }
  }
}

main().catch(() => {
  console.error("Error inesperado al ejecutar las pruebas.");
  process.exitCode = 1;
});