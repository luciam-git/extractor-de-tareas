import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // lee ANTHROPIC_API_KEY del entorno

const MAX_CHARS = 400_000;

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

const SYSTEM = `Eres un asistente que extrae tareas de transcripciones de reuniones. Devuelve solo un JSON con dos listas: tareas y pendientes. Cada tarea tiene: tarea, responsable, fecha_limite, certeza (alta, media o baja) y cita (la frase literal de la transcripción de la que sale). Cada pendiente tiene: descripcion y cita (la frase literal de la transcripción de la que sale). Reglas: si nadie dijo quién se encarga, pon 'sin asignar' y no te inventes un nombre. Convierte fechas relativas ('el viernes', 'la semana que viene') en fechas concretas usando la fecha de la reunión que te paso. Si no hay plazo, pon 'sin fecha'. Si algo es ambiguo, certeza baja. No incluyas tareas que nadie se haya comprometido a hacer. Además, incluye en \`pendientes\` las cosas que alguien dijo que habría que hacer pero que nadie asumió: expresiones como 'alguien debería', 'habría que', 'tenemos que' sin un responsable claro o que se aplazan sin fecha. Si alguien se comprometió, aunque sea con poca convicción, va en \`tareas\` y no en \`pendientes\`. No inventes pendientes que no se hayan dicho. Responde sin texto adicional.`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { transcripcion, fecha } = req.body || {};

  if (typeof transcripcion !== "string" || !transcripcion.trim()) {
    return res.status(400).json({ error: "Falta la transcripción." });
  }
  if (transcripcion.length > MAX_CHARS) {
    return res.status(400).json({ error: "La transcripción es demasiado larga." });
  }
  const fechaReunion =
    typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null;

  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: SCHEMA },
      },
      messages: [
        {
          role: "user",
          content:
            `Fecha de la reunión: ${fechaReunion ?? "desconocida (no resuelvas fechas relativas, cópialas tal cual)"}\n\n` +
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
