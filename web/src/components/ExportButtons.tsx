import Link from "next/link";

interface Props {
  /** El plan del negocio incluye exportar (Pro y Premium). */
  allowed: boolean;
  disabled: boolean;
  onPdf: () => void;
  onExcel: () => void;
}

const BOTON =
  "rounded-xl border border-line bg-white py-3 text-sm font-semibold text-navy-900 transition hover:bg-green-100 disabled:opacity-50";

/** Botones de exportar a PDF y Excel. En el plan gratuito se ofrece mejorar el plan. */
export function ExportButtons({ allowed, disabled, onPdf, onExcel }: Props) {
  if (!allowed) {
    return (
      <Link
        href="/upgrade"
        className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-dashed border-line bg-white px-4 py-3.5 text-sm transition hover:bg-cream"
      >
        <span className="text-ink">
          <span aria-hidden>📄</span> Exporta tus reportes a PDF y Excel
        </span>
        <span className="whitespace-nowrap rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-navy-900">
          Pro
        </span>
      </Link>
    );
  }
  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      <button onClick={onPdf} disabled={disabled} className={BOTON}>
        Exportar PDF
      </button>
      <button onClick={onExcel} disabled={disabled} className={BOTON}>
        Exportar Excel
      </button>
    </div>
  );
}
