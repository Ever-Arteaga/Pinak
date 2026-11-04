"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { useSpeechRecognition } from "@/lib/speech";
import { usePersonal } from "@/lib/personal";

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="3" width="6" height="12" rx="3" stroke="currentColor" strokeWidth={2} />
      <path d="M5 11a7 7 0 0014 0M12 18v3" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

const PLACEHOLDER = "Ej.: Vendí 60.000 en Nequi y gasté 15.000 en insumos en efectivo";
const PLACEHOLDER_PERSONAL = "Ej.: Me pagaron 1.200.000 de salario y gasté 80.000 en mercado con Nequi";

/** Barra "Registrar con IA" siempre visible. Para el plan Emprendedor aparece bloqueada. */
export function AiBar({
  enabled,
  onDetect,
}: {
  enabled: boolean;
  /** Se llama con el texto (y si fue dictado) para abrir la revisión de movimientos. */
  onDetect: (text: string, usedVoice: boolean) => void;
}) {
  const personal = usePersonal();
  const [text, setText] = useState("");
  const baseRef = useRef("");
  const voiceRef = useRef(false);

  const onTranscript = useCallback((finalText: string, interim: string) => {
    const dictado = [finalText, interim].filter(Boolean).join(" ");
    setText(baseRef.current ? `${baseRef.current} ${dictado}`.trim() : dictado);
    if (finalText) voiceRef.current = true;
  }, []);
  const { supported, listening, error, start, stop } = useSpeechRecognition(onTranscript);

  if (!enabled) {
    return (
      <section className="flex flex-col gap-3 rounded-2xl bg-navy-900 p-4 text-white sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <p className="font-display text-base font-semibold">
            <span aria-hidden>✨</span> Registrar con IA <span aria-hidden>🔒</span>
          </p>
          <p className="mt-0.5 text-sm text-white/75">
            {personal ? "Dicta o escribe tus ingresos y gastos y la IA los registra por ti." : "Dicta o escribe tus ventas y gastos y la IA los registra por ti."}{" "}Disponible en los planes Essential, Pro y Premium.
          </p>
        </div>
        <Link
          prefetch={false}
          href="/upgrade"
          className="flex min-h-[44px] shrink-0 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-navy-900 transition hover:opacity-90"
        >
          Mejorar mi plan
        </Link>
      </section>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (listening) stop();
    onDetect(text.trim(), voiceRef.current);
    setText("");
    voiceRef.current = false;
  };

  return (
    <form onSubmit={submit} className="rounded-2xl bg-navy-900 p-4 text-white sm:p-5" aria-label="Registrar con IA">
      <label htmlFor="ai-bar-text" className="font-display text-base font-semibold">
        <span aria-hidden>✨</span> Registrar con IA
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="ai-bar-text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            voiceRef.current = false;
          }}
          readOnly={listening}
          placeholder={personal ? PLACEHOLDER_PERSONAL : PLACEHOLDER}
          className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-3 text-sm text-white outline-none placeholder:text-white/50 focus:border-white/60"
        />
        <div className="flex gap-2">
          {supported && (
            <button
              type="button"
              onClick={() => {
                if (listening) return stop();
                baseRef.current = text.trim();
                start();
              }}
              aria-pressed={listening}
              aria-label={listening ? "Detener dictado" : "Dictar con el micrófono"}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition ${
                listening ? "animate-pulse border-white bg-white/25" : "border-white/20 bg-white/10 hover:bg-white/20"
              }`}
            >
              <MicIcon />
            </button>
          )}
          <button
            type="submit"
            disabled={!text.trim()}
            className="min-h-[44px] flex-1 rounded-xl bg-green-600 px-4 text-sm font-semibold text-white transition hover:bg-green-500 disabled:opacity-50 sm:flex-none"
          >
            Detectar movimientos
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-200">{error}</p>}
    </form>
  );
}
