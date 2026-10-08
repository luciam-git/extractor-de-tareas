import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptDirectory, "..");
const resultsDirectory = join(scriptDirectory, "resultados");
const expectedPath = join(scriptDirectory, "esperado-reunion-larga.json");
const correctionsPath = join(scriptDirectory, "correcciones.csv");
const summaryPath = join(scriptDirectory, "resumen.csv");
const discrepanciesPath = join(scriptDirectory, "discrepancias.md");
const readmePath = join(scriptDirectory, "tabla-readme.md");

const summaryColumns = [
  "modelo",
  "formato",
  "participantes",
  "pasada",
  "tareas devueltas",
  "aciertos",
  "parciales",
  "mal clasificadas",
  "ausentes",
  "sobrantes",
  "sobrantes discutibles",
  "errores graves",
  "pendientes correctos",
  "segundos",
  "tokens de entrada",
  "tokens de salida",
];

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replaceAll("_", " ")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAllKeys(text, keys = []) {
  const normalizedText = normalize(text);
  return keys.length > 0 && keys.every((key) => normalizedText.includes(normalize(key)));
}

function collectJsonFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = join(directory, entry.name);
      if (entry.isDirectory()) return collectJsonFiles(entryPath);
      return entry.isFile() && entry.name.toLowerCase().endsWith(".json") ? [entryPath] : [];
    })
    .sort((left, right) => left.localeCompare(right));
}

function parseCsv(source) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const text = source.replace(/^\uFEFF/, "");

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  if (quoted) throw new Error("correcciones.csv tiene un campo entrecomillado sin cerrar.");
  if (rows.length === 0) return [];

  const headers = rows[0].map((header) => normalize(header).replaceAll(" ", "_"));
  return rows.slice(1).map((cells) => Object.fromEntries(
    headers.map((header, index) => [header, (cells[index] ?? "").trim()]),
  ));
}

function readCorrections() {
  if (!existsSync(correctionsPath)) return [];
  return parseCsv(readFileSync(correctionsPath, "utf8"));
}

function getRunMetadata(path, record) {
  const filename = path.split(/[\\/]/).at(-1);
  const match = filename.match(/^(meet|teams|otter|corrido)-(con|sin)-p(\d+)\.json$/i);
  const model = record?.modelo ?? path.split(/[\\/]/).at(-2) ?? "desconocido";
  return {
    model,
    format: record?.formato ?? match?.[1] ?? "desconocido",
    participants: record?.participantes ?? match?.[2] ?? "desconocido",
    pass: record?.pasada ?? (match ? Number(match[3]) : ""),
    relativePath: relative(resultsDirectory, path).replaceAll("\\", "/"),
    filename,
    stem: filename.replace(/\.json$/i, ""),
  };
}

function readExecution(path) {
  let record;
  let parseError = null;
  try {
    record = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    parseError = error.message;
  }

  const metadata = getRunMetadata(path, record);
  let response = record?.respuesta;
  if (typeof response === "string") {
    try {
      response = JSON.parse(response);
    } catch {
      response = null;
    }
  }
  if (!response && typeof record?.texto_crudo === "string") {
    try {
      response = JSON.parse(record.texto_crudo);
    } catch {
      response = null;
    }
  }

  return {
    ...metadata,
    record,
    parseError,
    response: response && typeof response === "object" ? response : {},
    tasks: Array.isArray(response?.tareas) ? response.tareas : [],
    pending: Array.isArray(response?.pendientes) ? response.pendientes : [],
    durationSeconds: Number(record?.duracion_ms ?? 0) / 1000,
    inputTokens: Number(record?.tokens_entrada ?? 0),
    outputTokens: Number(record?.tokens_salida ?? 0),
    taskMatches: [],
    pendingMatches: [],
    claimedTasks: new Map(),
    claimedPending: new Map(),
    taskStates: new Map(),
    pendingStates: new Map(),
    collisionWarnings: [],
    appliedCorrections: [],
    correctionWarnings: [],
    leftovers: [],
  };
}

function taskText(item) {
  return item?.tarea ?? item?.descripcion ?? "";
}

function itemMatchesTask(item, expectedTask, allExpectedTasks) {
  const text = taskText(item);
  if (hasAllKeys(text, expectedTask.claves)) return true;
  if (expectedTask.id !== 19) return false;

  const matchesAnotherTask = allExpectedTasks.some((other) =>
    other.id !== 19 && hasAllKeys(text, other.claves));
  return !matchesAnotherTask && /guardia|corte/i.test(normalize(text));
}

function permittedFusion(left, right) {
  return left.fusion_admitida_con === right.id || right.fusion_admitida_con === left.id;
}

function matchItems(items, expectedRows, allExpectedTasks = []) {
  return items.map((item) => expectedRows
    .filter((row) => (row.responsable
      ? itemMatchesTask(item, row, allExpectedTasks)
      : hasAllKeys(taskText(item), row.claves)))
    .map((row) => row.id));
}

function expectedById(rows, id) {
  return rows.find((row) => String(row.id) === String(id));
}

function noteCollisionWarnings(execution, expectedTasks, expectedPending) {
  const groups = [
    { items: execution.tasks, matches: execution.taskMatches, rows: expectedTasks, kind: "tarea" },
    { items: execution.pending, matches: execution.pendingMatches, rows: expectedPending, kind: "pendiente" },
  ];

  for (const group of groups) {
    group.matches.forEach((ids, index) => {
      if (ids.length < 2) return;
      const rows = ids.map((id) => expectedById(group.rows, id));
      if (rows.length === 2 && permittedFusion(rows[0], rows[1])) return;
      execution.collisionWarnings.push({
        kind: group.kind,
        ids,
        text: taskText(group.items[index]),
        citation: group.items[index]?.cita ?? "",
      });
    });
  }
}

function pickOutput(indices, claimed, rowsById, currentRow) {
  const available = indices.find((index) => {
    const existingRows = claimed.get(index) ?? [];
    return existingRows.every((existingId) => {
      const existingRow = rowsById.get(String(existingId));
      return existingRow && permittedFusion(currentRow, existingRow);
    });
  });
  return available;
}

function claimOutput(claimed, index, rowId) {
  const ids = claimed.get(index) ?? [];
  ids.push(rowId);
  claimed.set(index, ids);
}

function ownerMatches(task, expected, execution) {
  const owner = normalize(task?.responsable);
  if (owner === normalize(expected.responsable)) return true;
  return ["otter", "corrido"].includes(normalize(execution.format)) &&
    expected.dificil_sin_etiquetas === true && owner === "sin asignar";
}

function findDivisionOutputIndices(row, execution) {
  if (!Array.isArray(row.division_admitida) || row.division_admitida.length < 2) return null;
  const candidatesByPart = row.division_admitida.map((part) => execution.tasks
    .map((task, index) => ({ task, index }))
    .filter(({ task, index }) => !execution.claimedTasks.has(index) && hasAllKeys(taskText(task), part))
    .map(({ index }) => index));
  if (candidatesByPart.some((candidates) => candidates.length === 0)) return null;

  function findDistinct(indices, partIndex) {
    if (partIndex === candidatesByPart.length) return indices;
    for (const index of candidatesByPart[partIndex]) {
      if (indices.includes(index)) continue;
      const match = findDistinct([...indices, index], partIndex + 1);
      if (match) return match;
    }
    return null;
  }

  return findDistinct([], 0);
}

function classify(execution, expected) {
  const { tareas: expectedTasks, pendientes: expectedPending } = expected;
  execution.taskMatches = matchItems(execution.tasks, expectedTasks, expectedTasks);
  execution.pendingMatches = matchItems(execution.pending, expectedPending);
  noteCollisionWarnings(execution, expectedTasks, expectedPending);

  const expectedTaskById = new Map(expectedTasks.map((row) => [String(row.id), row]));
  const expectedPendingById = new Map(expectedPending.map((row) => [String(row.id), row]));
  const taskRowsById = new Map(expectedTasks.map((row) => [String(row.id), row]));
  const pendingRowsById = new Map(expectedPending.map((row) => [String(row.id), row]));

  for (const row of expectedTasks) {
    const properCandidates = execution.taskMatches
      .map((ids, index) => ids.includes(row.id) ? index : -1)
      .filter((index) => index >= 0)
      .filter((index) => !(row.id === 19 && normalize(taskText(execution.tasks[index])).includes("apoyo")));
    if (properCandidates.length > 0) {
      const index = pickOutput(properCandidates, execution.claimedTasks, taskRowsById, row);
      if (index !== undefined) {
        const task = execution.tasks[index];
        claimOutput(execution.claimedTasks, index, row.id);
        const acceptableDate = row.fechas_aceptadas.map(normalize).includes(normalize(task?.fecha_limite));
        const acceptableCertainty = row.certezas_aceptadas.map(normalize).includes(normalize(task?.certeza));
        const acceptableOwner = ownerMatches(task, row, execution);
        execution.taskStates.set(String(row.id), {
          status: acceptableDate && acceptableCertainty && acceptableOwner ? "acierto" : "parcial",
          outputs: [task],
          reasons: [
            ...(!acceptableOwner ? ["responsable"] : []),
            ...(!acceptableDate ? ["fecha"] : []),
            ...(!acceptableCertainty ? ["certeza"] : []),
          ],
        });
        continue;
      }
    }

    const divisionIndices = findDivisionOutputIndices(row, execution);
    if (divisionIndices) {
      const outputs = divisionIndices.map((index) => execution.tasks[index]);
      for (const index of divisionIndices) claimOutput(execution.claimedTasks, index, row.id);
      const reasons = new Set();
      for (const task of outputs) {
        if (!ownerMatches(task, row, execution)) reasons.add("responsable");
        if (!row.fechas_aceptadas.map(normalize).includes(normalize(task?.fecha_limite))) reasons.add("fecha");
        if (!row.certezas_aceptadas.map(normalize).includes(normalize(task?.certeza))) reasons.add("certeza");
      }
      execution.taskStates.set(String(row.id), {
        status: reasons.size === 0 ? "acierto" : "parcial",
        outputs,
        reasons: [...reasons],
      });
      continue;
    }

    const wrongTypeTask = execution.pending.find((item, index) =>
      !execution.claimedPending.has(index) && itemMatchesTask(item, row, expectedTasks));
    if (wrongTypeTask) {
      claimOutput(execution.claimedPending, execution.pending.indexOf(wrongTypeTask), row.id);
      execution.taskStates.set(String(row.id), { status: "mal_clasificada", outputs: [wrongTypeTask], reasons: [] });
    } else {
      execution.taskStates.set(String(row.id), { status: "ausente", outputs: [], reasons: [] });
    }
  }

  for (const row of expectedPending) {
    const properCandidates = execution.pendingMatches
      .map((ids, index) => ids.includes(row.id) ? index : -1)
      .filter((index) => index >= 0);
    if (properCandidates.length > 0) {
      const index = pickOutput(properCandidates, execution.claimedPending, pendingRowsById, row);
      if (index !== undefined) {
        claimOutput(execution.claimedPending, index, row.id);
        execution.pendingStates.set(String(row.id), {
          status: "acierto",
          outputs: [execution.pending[index]],
          reasons: [],
        });
        continue;
      }
    }

    const wrongTypeTaskIndex = execution.taskMatches.findIndex((ids, index) =>
      !execution.claimedTasks.has(index) && hasAllKeys(taskText(execution.tasks[index]), row.claves));
    if (wrongTypeTaskIndex >= 0) {
      claimOutput(execution.claimedTasks, wrongTypeTaskIndex, row.id);
      execution.pendingStates.set(String(row.id), {
        status: "mal_clasificada",
        outputs: [execution.tasks[wrongTypeTaskIndex]],
        reasons: [],
      });
    } else {
      execution.pendingStates.set(String(row.id), { status: "ausente", outputs: [], reasons: [] });
    }
  }

  applyCorrections(execution, expected, expectedTaskById, expectedPendingById);
  classifyLeftovers(execution, expected);
}

function correctionAliases(execution) {
  return new Set([
    normalize(execution.relativePath),
    normalize(execution.filename),
    normalize(execution.stem),
    normalize(`${execution.model}/${execution.filename}`),
    normalize(`${execution.model}/${execution.stem}`),
  ]);
}

function applyCorrections(execution, expected, expectedTaskById, expectedPendingById) {
  const aliases = correctionAliases(execution);
  for (const correction of execution.corrections ?? []) {
    if (!aliases.has(normalize(correction.ejecucion))) continue;
    const rowId = String(correction.fila ?? "").trim();
    const result = normalize(correction.resultado_final).replaceAll(" ", "_");
    const reason = correction.motivo ?? "";

    if (expectedTaskById.has(rowId) && ["acierto", "parcial", "mal_clasificada", "ausente"].includes(result)) {
      const previous = execution.taskStates.get(rowId)?.status;
      const currentState = execution.taskStates.get(rowId) ?? { outputs: [], reasons: [] };
      const correctedState = { ...currentState, status: result, corrected: true, correctionReason: reason };
      const excludedRowId = reason.match(/\bno\s+(?:a\s+)?(?:la\s+)?fila\s+(\d+)\b/i)?.[1];
      const ambiguousOutputIndex = excludedRowId && result === "acierto"
        ? execution.taskMatches.findIndex((ids) => ids.includes(Number(rowId)) && ids.includes(Number(excludedRowId)))
        : -1;

      if (ambiguousOutputIndex >= 0) {
        const output = execution.tasks[ambiguousOutputIndex];
        const claimedIds = (execution.claimedTasks.get(ambiguousOutputIndex) ?? [])
          .filter((id) => String(id) !== excludedRowId);
        if (claimedIds.length > 0) execution.claimedTasks.set(ambiguousOutputIndex, claimedIds);
        else execution.claimedTasks.delete(ambiguousOutputIndex);
        claimOutput(execution.claimedTasks, ambiguousOutputIndex, Number(rowId));
        correctedState.outputs = [output];
        const excludedState = execution.taskStates.get(excludedRowId) ?? { outputs: [], reasons: [] };
        const alternateIndex = execution.taskMatches.findIndex((ids, index) =>
          index !== ambiguousOutputIndex &&
          ids.includes(Number(excludedRowId)) &&
          (execution.claimedTasks.get(index) ?? []).every((id) => String(id) === excludedRowId));
        let excludedCorrection;
        if (alternateIndex >= 0) {
          const alternate = execution.tasks[alternateIndex];
          const alternateReasons = [
            ...(!ownerMatches(alternate, expectedTaskById.get(excludedRowId), execution) ? ["responsable"] : []),
            ...(!expectedTaskById.get(excludedRowId).fechas_aceptadas.map(normalize).includes(normalize(alternate?.fecha_limite)) ? ["fecha"] : []),
            ...(!expectedTaskById.get(excludedRowId).certezas_aceptadas.map(normalize).includes(normalize(alternate?.certeza)) ? ["certeza"] : []),
          ];
          if (!(execution.claimedTasks.get(alternateIndex) ?? []).some((id) => String(id) === excludedRowId)) {
            claimOutput(execution.claimedTasks, alternateIndex, Number(excludedRowId));
          }
          const status = alternateReasons.length === 0 ? "acierto" : "parcial";
          execution.taskStates.set(excludedRowId, {
            ...excludedState,
            status,
            outputs: [alternate],
            reasons: alternateReasons,
            corrected: true,
            correctionReason: `Se conserva la salida propia de la fila ${excludedRowId}.`,
          });
          excludedCorrection = { rowId: excludedRowId, previous: excludedState.status, result: status, reason: "Se conserva su salida propia." };
        } else {
          execution.taskStates.set(excludedRowId, {
            ...excludedState,
            status: "ausente",
            outputs: [],
            corrected: true,
            correctionReason: `Asignada manualmente a la fila ${rowId}, no a la fila ${excludedRowId}.`,
          });
          excludedCorrection = { rowId: excludedRowId, previous: excludedState.status, result: "ausente", reason: `Asignada a fila ${rowId}.` };
        }
        execution.appliedCorrections.push({
          ...excludedCorrection,
        });
      }

      execution.taskStates.set(rowId, correctedState);
      execution.appliedCorrections.push({ rowId, previous, result, reason });
    } else if (expectedPendingById.has(rowId) && ["acierto", "correcto", "pendiente_correcto", "mal_clasificada", "ausente"].includes(result)) {
      const previous = execution.pendingStates.get(rowId)?.status;
      const finalStatus = ["acierto", "correcto", "pendiente_correcto"].includes(result) ? "acierto" : result;
      execution.pendingStates.set(rowId, { ...execution.pendingStates.get(rowId), status: finalStatus, corrected: true, correctionReason: reason });
      execution.appliedCorrections.push({ rowId, previous, result: finalStatus, reason });
    } else {
      execution.correctionWarnings.push(`Corrección ignorada para fila ${rowId}: resultado_final "${correction.resultado_final}" no reconocido o fila inexistente.`);
    }
  }
}

function unknownParticipant(task, participants, expected) {
  const owner = normalize(task?.responsable);
  const misspelledNames = new Set((expected.nombres_con_errata ?? []).map((name) => normalize(name.errata)));
  const mentionedNonParticipants = new Set((expected.mencionados_no_participantes ?? []).map(normalize));
  return owner.length > 0 && !["todos", "sin asignar"].includes(owner) &&
    !participants.has(owner) && !misspelledNames.has(owner) && !mentionedNonParticipants.has(owner);
}

function classifyLeftovers(execution, expected) {
  const participants = new Set(expected.reunion.participantes.map(normalize));
  const taskItems = execution.tasks.map((item, index) => ({ item, index, type: "tarea" }));
  const pendingItems = execution.pending.map((item, index) => ({ item, index, type: "pendiente" }));
  const outputs = [
    ...taskItems.filter(({ index }) => !execution.claimedTasks.has(index)),
    ...pendingItems.filter(({ index }) => !execution.claimedPending.has(index)),
  ];

  execution.leftovers = outputs.map(({ item, index, type }) => {
    const text = taskText(item);
    const disputed = expected.no_esperadas_discutibles.find((row) => hasAllKeys(text, row.claves));
    const forbidden = expected.no_debe_salir.find((row) => hasAllKeys(text, row.claves));
    const invalidOwner = unknownParticipant(item, participants, expected);
    let category = "sobrante";
    if (disputed) category = "sobrante_discutible";
    else if (forbidden || invalidOwner) category = "error_grave";
    return {
      type,
      index,
      item,
      text,
      citation: item?.cita ?? "",
      category,
      forbidden,
      disputed,
      invalidOwner,
    };
  });
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function executionMetrics(execution, expected) {
  const taskStatuses = expected.tareas.map((row) => execution.taskStates.get(String(row.id))?.status ?? "ausente");
  const pendingStatuses = expected.pendientes.map((row) => execution.pendingStates.get(String(row.id))?.status ?? "ausente");
  return {
    taskCount: execution.tasks.length,
    correct: taskStatuses.filter((status) => status === "acierto").length,
    partial: taskStatuses.filter((status) => status === "parcial").length,
    misclassified: taskStatuses.filter((status) => status === "mal_clasificada").length +
      pendingStatuses.filter((status) => status === "mal_clasificada").length,
    absent: taskStatuses.filter((status) => status === "ausente").length,
    surplus: execution.leftovers.filter((item) => item.category === "sobrante").length,
    disputed: execution.leftovers.filter((item) => item.category === "sobrante_discutible").length,
    severe: execution.leftovers.filter((item) => item.category === "error_grave").length,
    pendingCorrect: pendingStatuses.filter((status) => status === "acierto").length,
    seconds: execution.durationSeconds,
  };
}

function writeSummaryCsv(executions, expected) {
  const rows = [summaryColumns.map(csvCell).join(",")];
  for (const execution of executions) {
    const metrics = executionMetrics(execution, expected);
    const fields = [
      execution.model,
      execution.format,
      execution.participants,
      execution.pass,
      metrics.taskCount,
      metrics.correct,
      metrics.partial,
      metrics.misclassified,
      metrics.absent,
      metrics.surplus,
      metrics.disputed,
      metrics.severe,
      `${metrics.pendingCorrect}/6`,
      metrics.seconds.toFixed(2),
      execution.inputTokens,
      execution.outputTokens,
    ];
    rows.push(fields.map(csvCell).join(","));
  }
  writeFileSync(summaryPath, `${rows.join("\r\n")}\r\n`, "utf8");
}

function escapeMarkdown(value) {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replace(/\r?\n/g, "<br>");
}

function renderOutput(label, item) {
  if (!item) return "  - Salida del modelo: no encontrada.\n";
  const text = taskText(item);
  const citation = item.cita ?? "(sin cita)";
  return `  - ${label}: **${escapeMarkdown(text)}**\n  - Cita: > ${escapeMarkdown(citation)}\n`;
}

const commonWords = new Set([
  "algo", "alguien", "ante", "como", "con", "contra", "cual", "cuando", "debe", "desde", "donde", "del",
  "durante", "ella", "ellas", "ellos", "entre", "era", "eran", "eres", "esa", "esas", "ese", "eso",
  "esos", "esta", "estas", "este", "esto", "estos", "fue", "fueron", "hay", "hace", "hacia", "han", "las", "los",
  "hasta", "hemos", "hoy", "junto", "mas", "mientras", "mismo", "nada", "nadie", "nos", "nuestra",
  "nuestro", "para", "pero", "poco", "porque", "puede", "pueden", "que", "quien", "quienes", "queda",
  "quedar", "sean", "sido", "sobre", "solo", "son", "tambien", "tiene", "tienen", "todo", "todos", "tras",
  "una", "uno", "unos", "unas", "usar", "varios", "veces", "yendo", "por", "esta", "estan", "estaba",
  "estaban", "hacer", "hicieron", "tarea", "tareas",
]);

function comparableWords(text) {
  return normalize(text).match(/[\p{L}\p{N}_]+/gu)?.filter((word) =>
    word.length > 2 && !commonWords.has(word)) ?? [];
}

function possibleMatches(expectedRow, execution) {
  const expectedWords = new Set(comparableWords(`${expectedRow.descripcion} ${(expectedRow.claves ?? []).join(" ")}`));
  return execution.leftovers
    .map((leftover) => {
      const sharedWords = [...new Set(comparableWords(leftover.text))]
        .filter((word) => expectedWords.has(word));
      return { leftover, sharedWords };
    })
    .filter((candidate) => candidate.sharedWords.length > 0)
    .sort((left, right) => right.sharedWords.length - left.sharedWords.length);
}

function renderPossibleMatches(expectedRow, execution) {
  const matches = possibleMatches(expectedRow, execution);
  if (matches.length === 0) return "  - Posibles coincidencias: ninguna.\n";
  const lines = ["  - Posibles coincidencias (sugerencias por palabras compartidas):"];
  for (const { leftover, sharedWords } of matches) {
    lines.push(`    - Comparte ${sharedWords.map(escapeMarkdown).join(", ")}: ${leftover.type}: **${escapeMarkdown(leftover.text || "(sin descripción)")}**`);
    lines.push(`      - Cita: > ${escapeMarkdown(leftover.citation || "(sin cita)")}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderDiscrepancies(executions, expected) {
  const lines = ["# Discrepancias de evaluación", ""];
  for (const execution of executions) {
    const metrics = executionMetrics(execution, expected);
    lines.push(`## ${execution.model} / ${execution.format}-${execution.participants} / pasada ${execution.pass}`);
    lines.push("");
    lines.push(`Tareas devueltas: ${metrics.taskCount}; aciertos: ${metrics.correct}/28; pendientes correctos: ${metrics.pendingCorrect}/6; duración: ${metrics.seconds.toFixed(2)} s.`);
    if (execution.parseError) lines.push(`\nNo se pudo leer el archivo JSON: ${escapeMarkdown(execution.parseError)}`);
    if (execution.record?.error) lines.push(`\nError guardado en el resultado: ${escapeMarkdown(execution.record.error)}`);
    lines.push("");

    const taskDiscrepancies = expected.tareas.filter((row) => execution.taskStates.get(String(row.id))?.status !== "acierto");
    lines.push("### Tareas esperadas no acertadas");
    if (taskDiscrepancies.length === 0) lines.push("- Ninguna.");
    for (const row of taskDiscrepancies) {
      const state = execution.taskStates.get(String(row.id));
      lines.push(`- Fila ${row.id}: **${state?.status ?? "ausente"}** (${escapeMarkdown(row.descripcion)})${state?.reasons?.length ? `; campos: ${state.reasons.join(", ")}` : ""}${state?.corrected ? `; corrección manual: ${escapeMarkdown(state.correctionReason)}` : ""}`);
      if (state?.outputs?.length) {
        for (const item of state.outputs) lines.push(renderOutput("Salida del modelo", item).trimEnd());
      } else {
        lines.push("  - Salida del modelo: no encontrada.");
        if (state?.status === "ausente") lines.push(renderPossibleMatches(row, execution).trimEnd());
      }
    }

    const pendingDiscrepancies = expected.pendientes.filter((row) => execution.pendingStates.get(String(row.id))?.status !== "acierto");
    lines.push("", "### Pendientes esperados no encontrados correctamente");
    if (pendingDiscrepancies.length === 0) lines.push("- Ninguno.");
    for (const row of pendingDiscrepancies) {
      const state = execution.pendingStates.get(String(row.id));
      lines.push(`- ${row.id}: **${state?.status ?? "ausente"}** (${escapeMarkdown(row.descripcion)})${state?.corrected ? `; corrección manual: ${escapeMarkdown(state.correctionReason)}` : ""}`);
      if (state?.outputs?.length) {
        for (const item of state.outputs) lines.push(renderOutput("Salida del modelo", item).trimEnd());
      } else {
        lines.push("  - Salida del modelo: no encontrada.");
        if (state?.status === "ausente") lines.push(renderPossibleMatches(row, execution).trimEnd());
      }
    }

    for (const category of ["sobrante", "sobrante_discutible", "error_grave"]) {
      const items = execution.leftovers.filter((leftover) => leftover.category === category);
      const heading = category === "error_grave" ? "Errores graves" : category === "sobrante_discutible" ? "Sobrantes discutibles" : "Sobrantes";
      lines.push("", `### ${heading}`);
      if (items.length === 0) lines.push("- Ninguno.");
      for (const leftover of items) {
        const notes = [
          leftover.forbidden ? `coincide con ${leftover.forbidden.id}` : "",
          leftover.disputed ? `coincide con ${leftover.disputed.id}` : "",
          leftover.invalidOwner ? `responsable no reconocido: ${escapeMarkdown(leftover.item?.responsable)}` : "",
        ].filter(Boolean);
        lines.push(`- ${leftover.type}${notes.length ? ` (${notes.join("; ")})` : ""}: **${escapeMarkdown(leftover.text || "(sin descripción)")}**`);
        lines.push(`  - Cita: > ${escapeMarkdown(leftover.citation || "(sin cita)")}`);
      }
    }

    lines.push("", "### Coincidencias compartidas", "");
    if (execution.collisionWarnings.length === 0) lines.push("- Ninguna.");
    for (const warning of execution.collisionWarnings) {
      lines.push(`- Aviso: las filas esperadas ${warning.ids.join(" y ")} apuntan a la misma ${warning.kind} devuelta: **${escapeMarkdown(warning.text)}**.`);
      lines.push(`  - Cita: > ${escapeMarkdown(warning.citation || "(sin cita)")}`);
    }

    if (execution.appliedCorrections.length > 0) {
      lines.push("", "### Correcciones manuales", "");
      for (const correction of execution.appliedCorrections) {
        lines.push(`- Fila ${correction.rowId}: ${correction.previous} → ${correction.result}${correction.reason ? `; ${escapeMarkdown(correction.reason)}` : ""}`);
      }
    }
    for (const warning of execution.correctionWarnings) lines.push(`\nAviso de corrección: ${escapeMarkdown(warning)}`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function formatMean(values, digits = 1) {
  return average(values).toFixed(digits);
}

function renderReadme(executions, expected) {
  const lines = ["# Resultados de extracción", "", "Las métricas de la tabla son medias entre las pasadas disponibles, excepto aciertos, que muestra mínimo, media y máximo. Ausentes y mal clasificadas cuentan filas esperadas; los pendientes se informan por separado.", ""];
  const models = [...new Set(executions.map((execution) => execution.model))].sort();
  const configurationOrder = ["meet-sin", "teams-sin", "otter-sin", "corrido-sin", "corrido-con"];

  for (const model of models) {
    lines.push(`## ${model}`, "");
    lines.push("| Formato | Participantes | Pasadas | Aciertos mín./media/máx. (de 28) | Parciales (media) | Mal clasificadas (media) | Ausentes (media) | Sobrantes (media) | Discutibles (media) | Errores graves (media) | Pendientes correctos (media de 6) | Segundos medios |", "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
    const modelExecutions = executions.filter((execution) => execution.model === model);
    const configurationKeys = [...new Set(modelExecutions.map((execution) => `${execution.format}-${execution.participants}`))]
      .sort((left, right) => configurationOrder.indexOf(left) - configurationOrder.indexOf(right));

    for (const key of configurationKeys) {
      const group = modelExecutions.filter((execution) => `${execution.format}-${execution.participants}` === key);
      const metrics = group.map((execution) => executionMetrics(execution, expected));
      const hits = metrics.map((item) => item.correct);
      const minHits = Math.min(...hits);
      const maxHits = Math.max(...hits);
      const meanHits = formatMean(hits);
      const [format, participants] = key.split("-");
      lines.push(`| ${format} | ${participants} | ${group.length} | ${minHits} / ${meanHits} / ${maxHits} | ${formatMean(metrics.map((item) => item.partial))} | ${formatMean(metrics.map((item) => item.misclassified))} | ${formatMean(metrics.map((item) => item.absent))} | ${formatMean(metrics.map((item) => item.surplus))} | ${formatMean(metrics.map((item) => item.disputed))} | ${formatMean(metrics.map((item) => item.severe))} | ${formatMean(metrics.map((item) => item.pendingCorrect))}/6 | ${formatMean(metrics.map((item) => item.seconds), 2)} |`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function attachCorrections(executions, corrections) {
  for (const execution of executions) {
    const aliases = correctionAliases(execution);
    execution.corrections = corrections.filter((correction) => aliases.has(normalize(correction.ejecucion)));
  }
}

function main() {
  const expected = JSON.parse(readFileSync(expectedPath, "utf8"));
  const corrections = readCorrections();
  const resultFiles = collectJsonFiles(resultsDirectory);
  const executions = resultFiles.map(readExecution);
  attachCorrections(executions, corrections);

  for (const execution of executions) classify(execution, expected);
  writeSummaryCsv(executions, expected);
  writeFileSync(discrepanciesPath, renderDiscrepancies(executions, expected), "utf8");
  writeFileSync(readmePath, renderReadme(executions, expected), "utf8");

  console.log(`Puntuadas ${executions.length} ejecuciones; correcciones manuales: ${corrections.length}.`);
  console.log("Generados pruebas/resumen.csv, pruebas/discrepancias.md y pruebas/tabla-readme.md.");
}

main();