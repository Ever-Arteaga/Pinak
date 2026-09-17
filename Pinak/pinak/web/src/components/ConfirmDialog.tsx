"use client";

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Eliminar",
  cancelLabel = "Cancelar",
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-6">
      <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-lg">
        <h3 className="font-display text-base font-semibold text-navy-900">{title}</h3>
        <p className="mt-1.5 text-sm text-ink-soft">{message}</p>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink transition hover:bg-cream disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold text-white transition disabled:opacity-60 ${
              danger ? "bg-danger hover:bg-red-700" : "bg-navy-900 hover:bg-navy-800"
            }`}
          >
            {busy ? "Eliminando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
