"use client";

import { useCallback, useRef, useState } from "react";
import { addTransaction } from "@/lib/transactions";
import { parseTransactionText, type AiParsedTransaction } from "@/lib/ai";
import { useSpeechRecognition } from "@/lib/speech";

const currency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

type Step = "input" | "preview";

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="3" width="6" height="12" rx="3" stroke="currentColor" strokeWidth={2} />
      <path
        d="M5 11a7 7 0 0014 0M12 18v3"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AiQuickAddModal({ businessId, onClose }: { businessId: string; onClose: () => void }) {
  const [step, setStep] = useState<Step>("input");
  const [text, setText] = useState("");
  const [candidates, setCandidates] = useState<AiParsedTransaction[]>([]);
  const [usageInfo, setUsageInfo] = useState<{ used: number; limit: number | null } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Voz: el texto dictado se agrega al que ya estaba escrito.
  const baseTextRef = useRef("");
  const usedVoiceRef = useRef(false);

  const handleTranscript = useCallback((finalText: string, interim: string) => {
    const dictado = [finalText, interim].filter(Boolean).join(" ");
    const base = baseTextRef.current;
    setText(base ? `${base} ${dictado}`.trim() : dictado);
    if (finalText) usedVoiceRef.current = true;
  }, []);

  const {
    supported: voiceSupported,
    listening,
    error: voiceError,
    start: startVoice,
    stop: stopVoice,
  } = useSpeechRecognition(handleTranscript);

  function toggleMic() {
    if (listening) {
      stopVoice();
      return;
    }
    baseTextRef.current = text.trim();
    startVoice();
  }

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    if (listening) stopVoice();

    setProcessing(true);
    setError(null);
    try {
      const result = await parseTransactionText(text.trim(), businessId);
      if (result.transactions.length === 0) {
        setError(
          "No pude identificar ningún movimiento en ese mensaje. Intenta ser más específico (monto, si fue ingreso o gasto)."
        );
        return;
      }
      setCandidates(result.transactions);
      setUsageInfo(result.usage);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo procesar el mensaje.");
    } finally {
      setProcessing(false);
    }
  }

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      await Promise.all(
        candidates.map((c) =>
          addTransaction(businessId, {
            type: c.type,
            amount: c.amount,
            category: c.category,
            method: c.method,
            description: c.description,
            source: usedVoiceRef.current ? "ia_voz" : "ia_texto",
          })
        )
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  function updateCandidate(index: number, patch: Partial<AiParsedTransaction>) {
    setCandidates((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function removeCandidate(index: number) {
    setCandidates((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-navy-900">
            {step === "input" ? "Registrar con IA" : "Confirma los movimientos"}
          </h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {step === "input" && (
          <form onSubmit={handleAnalyze} className="mt-4 flex flex-col gap-3">
            <p className="text-sm text-ink-soft">
              Cuéntame qué pasó escribiendo o hablando, como si le hablaras a un asistente. Por ejemplo:{" "}
              <span className="italic">
                &ldquo;Vendí 60.000 en Nequi y gasté 15.000 en insumos en efectivo&rdquo;
              </span>
            </p>
            <textarea
              autoFocus
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              readOnly={listening}
              placeholder={
                voiceSupported
                  ? "Escribe o toca el micrófono para dictar..."
                  : "Escribe lo que pasó..."
              }
              className="w-full resize-none rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
            />
            {voiceSupported ? (
              <button
                type="button"
                onClick={toggleMic}
                disabled={processing}
                aria-pressed={listening}
                className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
                  listening
                    ? "animate-pulse border-danger bg-red-50 text-danger"
                    : "border-line text-navy-900 hover:bg-cream"
                }`}
              >
                <MicIcon />
                {listening ? "Escuchando... toca para detener" : "Dictar con voz"}
              </button>
            ) : (
              <p className="text-xs text-ink-soft">
                Tu navegador no permite dictado por voz. Prueba con Chrome, Edge o Safari, o usa
                el micrófono de tu teclado.
              </p>
            )}
            {(voiceError || error) && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
                {voiceError ?? error}
              </p>
            )}
            <button
              type="submit"
              disabled={processing || !text.trim()}
              className="rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-60"
            >
              {processing ? "Analizando..." : "Analizar con IA"}
            </button>
          </form>
        )}

        {step === "preview" && (
          <div className="mt-4 flex flex-col gap-3">
            {usageInfo?.limit !== null && usageInfo && (
              <p className="text-xs text-ink-soft">
                Registros IA usados este mes: {usageInfo.used}/{usageInfo.limit}
              </p>
            )}

            <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
              {candidates.map((c, i) => (
                <div key={i} className="rounded-xl border border-line p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            c.type === "ingreso"
                              ? "bg-green-100 text-green-600"
                              : "bg-red-50 text-danger"
                          }`}
                        >
                          {c.type === "ingreso" ? "Ingreso" : "Egreso"}
                        </span>
                        <input
                          type="text"
                          value={c.category}
                          onChange={(e) => updateCandidate(i, { category: e.target.value })}
                          className="min-w-0 flex-1 border-b border-transparent bg-transparent text-sm font-medium text-ink outline-none focus:border-green-500"
                        />
                      </div>
                      <p className="mt-1 text-xs text-ink-soft">
                        {c.method.charAt(0).toUpperCase() + c.method.slice(1)}
                        {c.description ? ` · ${c.description}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCandidate(i)}
                      className="text-ink-soft hover:text-danger"
                      aria-label="Quitar"
                    >
                      ✕
                    </button>
                  </div>
                  <input
                    type="number"
                    value={c.amount}
                    onChange={(e) => updateCandidate(i, { amount: Number(e.target.value) })}
                    className="mt-2 w-full rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                  />
                </div>
              ))}

              {candidates.length === 0 && (
                <p className="rounded-lg border border-line p-4 text-center text-sm text-ink-soft">
                  Quitaste todos los movimientos detectados.
                </p>
              )}
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep("input")}
                disabled={saving}
                className="flex-1 rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-cream disabled:opacity-60"
              >
                Atrás
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={saving || candidates.length === 0}
                className="flex-1 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-60"
              >
                {saving
                  ? "Guardando..."
                  : `Guardar ${candidates.length} ${
                      candidates.length === 1 ? "registro" : "registros"
                    }`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
