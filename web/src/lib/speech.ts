"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Tipos mínimos de la Web Speech API (no vienen en lib.dom de TypeScript).
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function traducirErrorVoz(code: string): string | null {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "No hay permiso para usar el micrófono. Actívalo en la configuración del navegador.";
    case "no-speech":
      return "No te escuché. Toca el micrófono e intenta de nuevo.";
    case "audio-capture":
      return "No se encontró un micrófono en este dispositivo.";
    case "network":
      return "El dictado por voz necesita conexión a internet.";
    case "aborted":
      return null; // cancelado a propósito, no es un error
    default:
      return "No se pudo usar el dictado por voz. Intenta de nuevo.";
  }
}

/**
 * Dictado por voz en español de Colombia con la Web Speech API del navegador
 * (Chrome, Edge, Safari). No usa servidores propios ni cuesta nada.
 *
 * onTranscript recibe el texto dictado en esta sesión: `final` (ya confirmado)
 * e `interim` (parcial, se va corrigiendo mientras hablas).
 */
export function useSpeechRecognition(
  onTranscript: (final: string, interim: string) => void
) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const cbRef = useRef(onTranscript);

  useEffect(() => {
    cbRef.current = onTranscript;
  }, [onTranscript]);

  // Se detecta después de montar para no desfasar el render del servidor.
  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
    return () => recRef.current?.abort();
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    setError(null);
    const rec = new Ctor();
    rec.lang = "es-CO";
    rec.continuous = false; // más estable en celulares; se vuelve a tocar para seguir
    rec.interimResults = true;

    rec.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      cbRef.current(finalText.trim(), interimText.trim());
    };
    rec.onerror = (e) => setError(traducirErrorVoz(e.error));
    rec.onend = () => setListening(false);

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  return { supported, listening, error, start, stop };
}
