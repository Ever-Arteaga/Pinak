"use client";

import Link from "next/link";
import type { ReceivablesSummary } from "@pinak/shared/dashboard";
import { buildWhatsAppCollectionLink } from "@/lib/receivables";
import { usePersonal } from "@/lib/personal";

function dueText(due: Date | undefined, overdue: boolean) {
  if (!due) return "Sin fecha de vencimiento";
  const d = due.toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "America/Bogota" });
  return overdue ? `Venció ${d}` : `Vence ${d}`;
}

export function ReceivablesCard({
  summary,
  businessName,
  money,
}: {
  summary: ReceivablesSummary;
  businessName: string;
  money: (n: number) => string;
}) {
  const personal = usePersonal();
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-semibold text-navy-900">Fiados por cobrar</h2>
          <p className="font-display mt-1 text-2xl font-semibold text-navy-900">{money(summary.totalPending)}</p>
        </div>
        <Link
          prefetch={false}
          href="/fiados"
          className="flex min-h-[44px] items-center rounded-lg px-2 text-xs font-semibold text-navy-900 hover:bg-cream"
        >
          Ver todos →
        </Link>
      </div>

      {summary.top.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">No tienes fiados pendientes. ¡Todo al día!</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {summary.top.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{r.clientName}</p>
                <p className={`text-xs ${r.overdue ? "font-semibold text-danger" : "text-ink-soft"}`}>
                  {r.overdue && <span aria-hidden>⚠ </span>}
                  {dueText(r.dueDate, r.overdue)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-ink">{money(r.amount)}</span>
              <a
                href={buildWhatsAppCollectionLink(businessName, r, personal)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Cobrar a ${r.clientName} por WhatsApp`}
                className="flex min-h-[44px] shrink-0 items-center rounded-lg border border-line px-3 text-xs font-semibold text-navy-900 transition hover:bg-green-100"
              >
                Cobrar
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
