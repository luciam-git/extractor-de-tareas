import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM, construirMensaje } from "../prompt.js";

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { transcripcion, fecha, codigo, participantes } = req.body || {};

  if (!process.env.ACCESS_CODE || codigo !== process.env.ACCESS_CODE) {
    return res.status(401).json({ error: "Código de acceso incorrecto." });
  }

  if (typeof transcripcion !== "string" || !transcripcion.trim()) {
    return res.status(400).json({ error: "Falta la transcripción." });
  }
  if (transcripcion.length > MAX_CHARS) {
    return res.status(413).json({ error: "La transcripción es demasiado larga" });
  }
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
          content: construirMensaje(transcripcion, fecha, participantes),
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
