import { defineSecret } from "firebase-functions/params";

// La API key se guarda como secreto de Firebase (nunca en el código ni en el cliente).
// Se configura una vez con: firebase functions:secrets:set GEMINI_API_KEY
// Se define en un solo lugar para que todas las funciones compartan el mismo secreto.
export const geminiApiKey = defineSecret("GEMINI_API_KEY");

// Modelo FIJO (no un alias "latest"): así una actualización de Google no cambia en silencio
// el comportamiento, el costo ni la cuota de las funciones de IA. Para cambiarlo sin tocar el
// código, pon GEMINI_MODEL=<id> en functions/.env y vuelve a desplegar. Antes de subir de
// versión, revisa https://ai.google.dev/gemini-api/docs/deprecations (fechas de retiro).
export const DEFAULT_MODEL = "gemini-3.6-flash";
export const MODEL = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
