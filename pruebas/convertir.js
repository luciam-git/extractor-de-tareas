import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const outputDirectory = dirname(fileURLToPath(import.meta.url));
const inputPath = resolve(outputDirectory, "../demo/transcripcion.txt");

function parseTranscripcion(source) {
  const lines = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  const entries = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const timeMatch = lines[lineIndex].trim().match(/^(\d{2}):(\d{2}):(\d{2})$/);
    if (!timeMatch) continue;

    let speakerIndex = lineIndex + 1;
    while (speakerIndex < lines.length && !lines[speakerIndex].trim()) speakerIndex += 1;

    const speakerMatch = lines[speakerIndex]?.trim().match(/^([^:]+):\s*(.*)$/);
    if (!speakerMatch) continue;

    const textLines = [speakerMatch[2].trim()];
    let nextTimeIndex = speakerIndex + 1;
    while (nextTimeIndex < lines.length && !/^\d{2}:\d{2}:\d{2}$/.test(lines[nextTimeIndex].trim())) {
      const continuation = lines[nextTimeIndex].trim();
      if (continuation) textLines.push(continuation);
      nextTimeIndex += 1;
    }

    const hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);
    const seconds = Number(timeMatch[3]);
    entries.push({
      hours,
      minutes,
      seconds,
      totalSeconds: hours * 3600 + minutes * 60 + seconds,
      name: speakerMatch[1].trim(),
      text: textLines.join(" "),
    });
    lineIndex = nextTimeIndex - 1;
  }

  return entries;
}

function formatVttTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.000`;
}

function formatMinutesSeconds(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatHoursMinutesSeconds(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function crearVtt(entries) {
  const cues = entries.map((entry, index) => {
    // El último cue dura un segundo al no existir una marca posterior.
    const endTime = entries[index + 1]?.totalSeconds ?? entry.totalSeconds + 1;
    return `${index + 1}\n${formatVttTime(entry.totalSeconds)} --> ${formatVttTime(endTime)}\n${entry.name}: ${entry.text}`;
  });
  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
}

function crearOtter(entries) {
  const speakerNumbers = new Map();
  return `${entries.map((entry) => {
    if (!speakerNumbers.has(entry.name)) speakerNumbers.set(entry.name, speakerNumbers.size + 1);
    return `Speaker ${speakerNumbers.get(entry.name)}  ${formatMinutesSeconds(entry.totalSeconds)}\n${entry.text}`;
  }).join("\n\n")}\n`;
}

function crearCorrido(entries) {
  const nombresMalTranscritos = [
    ["marina", "marino"],
    ["clara", "clarra"],
    ["raquel", "rakel"],
    ["julián", "julian"],
    ["andrés", "andres"],
    ["tomás", "tomas"],
  ];
  let text = entries.map((entry) => entry.text).join(" ").toLocaleLowerCase("es");

  for (const [original, corregido] of nombresMalTranscritos) {
    const nombre = new RegExp(`(^|[^\\p{L}\\p{N}_])${original}(?=$|[^\\p{L}\\p{N}_])`, "gu");
    text = text.replace(nombre, `$1${corregido}`);
  }

  return `${text.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim()}\n`;
}

function crearTeams(entries) {
  return `${entries.map((entry) => `${entry.name}   ${formatHoursMinutesSeconds(entry.totalSeconds)}\n${entry.text}`).join("\n\n")}\n`;
}

const transcript = readFileSync(inputPath, "utf8");
const entries = parseTranscripcion(transcript);

writeFileSync(join(outputDirectory, "reunion.vtt"), crearVtt(entries), "utf8");
writeFileSync(join(outputDirectory, "reunion-otter.txt"), crearOtter(entries), "utf8");
writeFileSync(join(outputDirectory, "reunion-corrido.txt"), crearCorrido(entries), "utf8");
writeFileSync(join(outputDirectory, "reunion-teams.txt"), crearTeams(entries), "utf8");

console.log(`Intervenciones procesadas: ${entries.length}`);