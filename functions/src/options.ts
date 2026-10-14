/**
 * App Check: exige que las llamadas vengan de la app real (no de un script).
 * Se activa con APP_CHECK_ENFORCE=true en functions/.env (o .env.pinak-dev).
 * Déjalo apagado en el emulador y mientras algún cliente (la app móvil) no
 * envíe tokens de App Check: con la exigencia activa, esas llamadas se rechazan.
 */
export const ENFORCE_APP_CHECK = process.env.APP_CHECK_ENFORCE === "true";
