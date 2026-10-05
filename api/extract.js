import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // lee ANTHROPIC_API_KEY del entorno

const MAX_CHARS = 60_000;

const SCHEMA = {
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

const SYSTEM = `Eres un asistente que extrae tareas de transcripciones de reuniones. Devuelve solo un JSON con dos listas: tareas y pendientes. Cada tarea tiene: tarea, responsable, fecha_limite, certeza (alta, media o baja) y cita (la frase literal de la transcripción de la que sale). Cada pendiente tiene: descripcion y cita (la frase literal de la transcripción de la que sale). Reglas: si nadie dijo quién se encarga, pon 'sin asignar' y no te inventes un nombre. Convierte fechas relativas ('el viernes', 'la semana que viene') en fechas concretas usando la fecha de la reunión que te paso. Si no hay plazo, pon 'sin fecha'. Si algo es ambiguo, certeza baja. No incluyas tareas que nadie se haya comprometido a hacer. Además, incluye en \`pendientes\` las cosas que alguien dijo que habría que hacer pero que nadie asumió: expresiones como 'alguien debería', 'habría que', 'tenemos que' sin un responsable claro o que se aplazan sin fecha. Si alguien se comprometió, aunque sea con poca convicción, va en \`tareas\` y no en \`pendientes\`. No inventes pendientes que no se hayan dicho. La transcripción puede venir de distintas herramientas y estar imperfecta. Ignora cabeceras, marcas de tiempo, numeración de subtítulos y avisos de la herramienta. Si los hablantes aparecen como "Speaker 1", "Hablante 2" o no hay etiquetas, no asumas quién es cada uno: deduce el responsable solo de los nombres que se mencionan en la conversación, y si no se puede saber con seguridad, pon "sin asignar". Los nombres pueden estar mal transcritos; si dos variantes parecen la misma persona por contexto, úsalas como una sola y escribe la forma más repetida. No corrijas ni inventes frases en la cita literal: copia lo que aparece en el texto. Antes de responder, recorre la transcripción en orden y revisa cada compromiso explícito ('yo estoy', 'cuenta conmigo', 'yo mando', 'lo hago'). Si alguien se compromete, aunque sea con poca convicción, inclúyelo como tarea con certeza baja o media; no lo omitas. No fusiones en una sola tarea compromisos de personas distintas. Responde sin texto adicional.`;
const SYSTEM_ADDITIONAL_RULES = "`fecha_limite` debe ser exactamente una fecha en formato AAAA-MM-DD o el texto 'sin fecha', sin ningún texto adicional. Si el plazo es 'antes del 4', pon la fecha del 4 y deja la aclaración para el campo tarea o ignórala. Si alguien pide a todo el grupo que haga algo ('todos', 'necesito que comentéis'), el responsable es 'todos', aunque solo una persona responda afirmativamente.";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { transcripcion, fecha, codigo, participantes } = req.body || {};
  const listaParticipantes = typeof participantes === "string" ? participantes.trim() : "";
  const instruccionParticipantes = listaParticipantes
    ? `Lista de participantes: ${listaParticipantes}. Si en la transcripción aparece un nombre que se parece a uno de la lista (por ejemplo por un error de transcripción), usa siempre la forma de la lista. No asignes responsables que no estén en la lista salvo que sea imposible evitarlo.\n\n`
    : "";

  if (!process.env.ACCESS_CODE || codigo !== process.env.ACCESS_CODE) {
    return res.status(401).json({ error: "Código de acceso incorrecto." });
  }

  if (typeof transcripcion !== "string" || !transcripcion.trim()) {
    return res.status(400).json({ error: "Falta la transcripción." });
  }
  if (transcripcion.length > MAX_CHARS) {
    return res.status(413).json({ error: "La transcripción es demasiado larga" });
  }
  const fechaReunion =
    typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null;

  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: `${SYSTEM} ${SYSTEM_ADDITIONAL_RULES}`,
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: SCHEMA },
      },
      messages: [
        {
          role: "user",
          content:
            `Fecha de la reunión: ${fechaReunion ?? "desconocida (no resuelvas fechas relativas, cópialas tal cual)"}\n\n` +
            instruccionParticipantes +
            `<transcripcion>\n${transcripcion}\n</transcripcion>`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return res.status(422).json({ error: "El modelo no ha podido procesar esta transcripción." });
    }
    if (response.stop_reason === "max_tokens") {
      return res.status(422).json({ error: "La respuesta se ha cortado: la transcripción tiene demasiadas tareas." });
    }

    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) {
      return res.status(502).json({ error: "Respuesta vacía del modelo." });
    }

    const data = JSON.parse(text);
    return res.status(200).json({ tareas: data.tareas ?? [], pendientes: data.pendientes ?? [] });
  } catch (err) {
    console.error(err);
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(500).json({ error: "La clave ANTHROPIC_API_KEY no es válida o no está configurada." });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "Demasiadas peticiones. Inténtalo de nuevo en un momento." });
    }
    if (err instanceof Anthropic.APIError) {
      return res.status(502).json({ error: "Error al contactar con la API de Anthropic." });
    }
    return res.status(500).json({ error: "Error interno del servidor." });
  }
}
