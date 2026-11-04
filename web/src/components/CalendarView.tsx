"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Appointment } from "@/types/pinak";

type View = "mes" | "semana" | "dia";

const HOUR_PX = 48;
const DAY_MS = 86400000;
const WEEKDAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** Lunes de la semana de `d`. */
const weekStart = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const hhmm = (d: Date) => d.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });

interface Placed {
  a: Appointment;
  col: number;
  cols: number;
}

/** Reparte las citas que se cruzan en columnas lado a lado, como Google Calendar. */
function layout(list: Appointment[]): Placed[] {
  const sorted = [...list].sort((x, y) => x.start.getTime() - y.start.getTime());
  const out: Placed[] = [];
  let cluster: Placed[] = [];
  let colEnds: number[] = [];
  let clusterEnd = 0;
  const flush = () => {
    const n = Math.max(...cluster.map((c) => c.col)) + 1;
    cluster.forEach((c) => (c.cols = n));
    out.push(...cluster);
    cluster = [];
    colEnds = [];
  };
  for (const a of sorted) {
    const s = a.start.getTime();
    const e = s + a.durationMin * 60000;
    if (cluster.length && s >= clusterEnd) flush();
    let col = colEnds.findIndex((x) => x <= s);
    if (col < 0) {
      col = colEnds.length;
      colEnds.push(e);
    } else {
      colEnds[col] = e;
    }
    cluster.push({ a, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, e);
  }
  if (cluster.length) flush();
  return out;
}

function chipClass(a: Appointment) {
  return a.status === "atendida"
    ? "border-green-500 bg-green-100 text-navy-900"
    : "border-navy-900 bg-navy-900 text-white";
}

export function CalendarView({
  appointments,
  onCreate,
  onOpen,
}: {
  appointments: Appointment[];
  /** Se llama con la fecha y hora elegidas al tocar un espacio vacío. */
  onCreate: (start: Date) => void;
  onOpen: (a: Appointment) => void;
}) {
  const [view, setView] = useState<View>("semana");
  const [cursor, setCursor] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());
  const scroller = useRef<HTMLDivElement>(null);

  // En el celular arranca en vista de día (7 columnas no caben).
  useEffect(() => {
    if (window.innerWidth < 640) setView("dia");
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  // Al abrir semana/día, deja a la vista la mañana (7 a. m.).
  useEffect(() => {
    if (view !== "mes" && scroller.current) scroller.current.scrollTop = 7 * HOUR_PX - 8;
  }, [view]);

  const visible = useMemo(() => appointments.filter((a) => a.status !== "cancelada"), [appointments]);
  const byDay = useMemo(() => {
    const m = new Map<string, Appointment[]>();
    for (const a of visible) {
      const k = a.start.toDateString();
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(a);
    }
    return m;
  }, [visible]);

  function move(dir: -1 | 1) {
    setCursor((c) =>
      view === "mes" ? new Date(c.getFullYear(), c.getMonth() + dir, 1) : addDays(c, dir * (view === "semana" ? 7 : 1))
    );
  }

  const title = (() => {
    if (view === "mes") return cap(cursor.toLocaleDateString("es-CO", { month: "long", year: "numeric" }));
    if (view === "dia") return cap(cursor.toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short", year: "numeric" }));
    const s = weekStart(cursor);
    const e = addDays(s, 6);
    const f = (d: Date, y: boolean) => d.toLocaleDateString("es-CO", { day: "numeric", month: "short", ...(y ? { year: "numeric" } : {}) });
    return `${f(s, false)} – ${f(e, true)}`;
  })();

  const days = view === "semana" ? Array.from({ length: 7 }, (_, i) => addDays(weekStart(cursor), i)) : [cursor];

  // ----- Vista de mes -----
  function Month() {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = weekStart(first);
    const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
    const rows = cells[35].getMonth() === cursor.getMonth() ? 6 : 5;
    return (
      <div>
        <div className="grid grid-cols-7 border-b border-line text-center text-[11px] font-semibold uppercase text-ink-soft">
          {WEEKDAYS.map((d) => (<div key={d} className="py-1.5">{d}</div>))}
        </div>
        <div className="grid grid-cols-7">
          {cells.slice(0, rows * 7).map((d) => {
            const list = (byDay.get(d.toDateString()) ?? []).sort((a, b) => a.start.getTime() - b.start.getTime());
            const out = d.getMonth() !== cursor.getMonth();
            const today = sameDay(d, now);
            return (
              <div
                key={d.toISOString()}
                onClick={() => onCreate(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0))}
                className={`min-h-[78px] cursor-pointer border-b border-r border-line p-1 transition hover:bg-cream sm:min-h-[104px] ${out ? "bg-cream/60" : ""}`}
              >
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setCursor(d); setView("dia"); }}
                  className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    today ? "bg-green-600 text-white" : out ? "text-ink-soft/60" : "text-ink"
                  }`}
                  aria-label={`Ver el día ${d.getDate()}`}
                >
                  {d.getDate()}
                </button>
                <div className="mt-1 flex flex-col gap-0.5">
                  {list.slice(0, 3).map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onOpen(a); }}
                      className={`truncate rounded border-l-2 px-1 py-px text-left text-[10px] leading-tight sm:text-[11px] ${chipClass(a)}`}
                    >
                      <span className="hidden sm:inline">{hhmm(a.start)} </span>{a.customerName}
                    </button>
                  ))}
                  {list.length > 3 && <span className="px-1 text-[10px] font-semibold text-ink-soft">+{list.length - 3} más</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ----- Semana / día -----
  function Grid() {
    return (
      <div>
        <div className="grid border-b border-line" style={{ gridTemplateColumns: `44px repeat(${days.length}, minmax(0, 1fr))` }}>
          <div />
          {days.map((d) => {
            const today = sameDay(d, now);
            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => { setCursor(d); setView("dia"); }}
                className="py-1.5 text-center"
              >
                <span className="block text-[11px] font-semibold uppercase text-ink-soft">{WEEKDAYS[(d.getDay() + 6) % 7]}</span>
                <span className={`mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${today ? "bg-green-600 text-white" : "text-ink"}`}>
                  {d.getDate()}
                </span>
              </button>
            );
          })}
        </div>
        <div ref={scroller} className="max-h-[68vh] overflow-y-auto">
          <div className="grid" style={{ gridTemplateColumns: `44px repeat(${days.length}, minmax(0, 1fr))` }}>
            <div>
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} style={{ height: HOUR_PX }} className="pr-1 text-right text-[10px] text-ink-soft">
                  <span className="relative -top-1.5">{h === 0 ? "" : new Date(2000, 0, 1, h).toLocaleTimeString("es-CO", { hour: "numeric" })}</span>
                </div>
              ))}
            </div>
            {days.map((d) => {
              const placed = layout(byDay.get(d.toDateString()) ?? []);
              const today = sameDay(d, now);
              const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
              return (
                <div
                  key={d.toISOString()}
                  className="relative border-l border-line"
                  style={{
                    height: 24 * HOUR_PX,
                    backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, var(--line, #e4e3dd) ${HOUR_PX - 1}px, var(--line, #e4e3dd) ${HOUR_PX}px)`,
                  }}
                  onClick={(e) => {
                    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                    const mins = Math.min(23 * 60 + 30, Math.floor((y / HOUR_PX) * 2) * 30);
                    onCreate(new Date(dayStart + mins * 60000));
                  }}
                >
                  {placed.map(({ a, col, cols }) => {
                    const top = ((a.start.getTime() - dayStart) / 3600000) * HOUR_PX;
                    const height = Math.max(20, Math.min((a.durationMin / 60) * HOUR_PX, 24 * HOUR_PX - top) - 2);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onOpen(a); }}
                        className={`absolute overflow-hidden rounded border-l-4 px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm ${chipClass(a)}`}
                        style={{ top, height, left: `calc(${(col / cols) * 100}% + 1px)`, width: `calc(${100 / cols}% - 3px)` }}
                      >
                        <span className="block truncate font-semibold">{a.customerName}</span>
                        {height > 32 && <span className="block truncate opacity-80">{hhmm(a.start)} · {a.serviceName}</span>}
                      </button>
                    );
                  })}
                  {today && (
                    <div
                      className="pointer-events-none absolute left-0 right-0 z-10 border-t-2 border-red-500"
                      style={{ top: ((now.getTime() - dayStart) / DAY_MS) * 24 * HOUR_PX }}
                    >
                      <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-red-500" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
        <button type="button" onClick={() => setCursor(new Date())} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-navy-900 transition hover:bg-cream">
          Hoy
        </button>
        <div className="flex">
          <button type="button" onClick={() => move(-1)} aria-label="Anterior" className="rounded-lg px-2.5 py-1.5 text-sm text-navy-900 transition hover:bg-cream">‹</button>
          <button type="button" onClick={() => move(1)} aria-label="Siguiente" className="rounded-lg px-2.5 py-1.5 text-sm text-navy-900 transition hover:bg-cream">›</button>
        </div>
        <h2 className="font-display min-w-0 flex-1 truncate text-sm font-semibold text-navy-900 sm:text-base">{title}</h2>
        <div className="flex rounded-lg bg-cream p-0.5 text-xs font-semibold">
          {(["dia", "semana", "mes"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-md px-2.5 py-1 ${view === v ? "bg-white text-navy-900 shadow-sm" : "text-ink-soft"}`}
            >
              {v === "dia" ? "Día" : v === "semana" ? "Semana" : "Mes"}
            </button>
          ))}
        </div>
      </div>
      {view === "mes" ? Month() : Grid()}
    </section>
  );
}
