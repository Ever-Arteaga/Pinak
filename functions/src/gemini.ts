import { defineSecret } from "firebase-functions/params";

// La API key se guarda como secreto de Firebase (nunca en el código ni en el cliente).
// Se configura una vez con: firebase functions:secrets:set GEMINI_API_KEY
// Se define en un solo lugar para que todas las funciones compartan el mismo secreto.
export const geminiApiKey = defineSecret("GEMINI_API_KEY");

// Se usa el alias "gemini-flash-latest" (en vez de un ID de modelo fijo como
// "gemini-2.5-flash") porque Google retira modelos Flash específicos con el
// tiempo — a veces antes de la fecha de apagado anunciada. El alias siempre
// apunta al modelo Flash vigente con cuota gratuita, evitando que la función
// deje de funcionar sola cuando Google rota su catálogo.
export const MODEL = "gemini-flash-latest";
