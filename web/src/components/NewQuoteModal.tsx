"use client";

import { useMemo, useState } from "react";
import { addCustomer, useCustomers } from "@/lib/customers";
import { useProducts } from "@/lib/products";
import { createQuote, quoteNumber, quoteTotal } from "@/lib/quotes";
import { downloadQuote, printQuote, shareQuoteWhatsApp } from "@/lib/quotePdf";
import { MoneyInput } from "@/components/MoneyInput";
import { MAX_AMOUNT } from "@/lib/money";
import type { Business, Product, Quote } from "@/types/pinak";

interface Line {
  key: number;
  name: string;
  qty: string;
  price: string;
}

const INPUT =
  "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500";
const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const VALIDITY = [7, 15, 30, 60];

export function NewQuoteModal({ business, onClose }: { business: Business; onClose: () => void }) {
  const { items: customers } = useCustomers(business.id);
  const { items: products } = useProducts(business.id);

  const [customerId, setCustomerId] = useState<string | undefined>();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState("");
  const [saveCustomer, setSaveCustomer] = useState(true);
  const [lines, setLines] = useState<Line[]>([]);
  const [days, setDays] = useState("15");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Quote | null>(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [seq, setSeq] = useState(0);

  const total = useMemo(
    () => quoteTotal(lines.map((l) => ({ name: l.name, qty: Number(l.qty) || 0, price: Number(l.price) || 0 }))),
    [lines]
  );

  function onNameChange(v: string) {
    setName(v);
    const match = customers.find((c) => c.name.toLowerCase() === v.trim().toLowerCase());
    if (match) {
      setCustomerId(match.id);
      setPhone(match.phone ?? "");
      setDocument(match.document ?? "");
    } else {
      setCustomerId(undefined);
    }
  }

  function addFromCatalog(p: Product) {
    setLines((prev) => {
      const i = prev.findIndex((l) => l.name === p.name && l.price === String(p.price));
      if (i >= 0) return prev.map((l, j) => (j === i ? { ...l, qty: String((Number(l.qty) || 0) + 1) } : l));
      return [...prev, { key: seq, name: p.name, qty: "1", price: String(p.price) }];
    });
    setSeq((n) => n + 1);
  }

  function addFree() {
    setLines((prev) => [...prev, { key: seq, name: "", qty: "1", price: "" }]);
    setSeq((n) => n + 1);
  }

  function patch(key: number, p: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...p } : l)));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const valid = lines.filter((l) => l.name.trim());
    if (name.trim().length < 2) return setError("Escribe el nombre del cliente.");
    if (valid.length === 0) return setError("Agrega al menos un producto o servicio.");
    for (const l of valid) {
      const q = Number(l.qty);
      const p = Number(l.price);
      if (!Number.isFinite(q) || q <= 0 || q > 100000) return setError(`Revisa la cantidad de "${l.name}".`);
      if (!Number.isFinite(p) || p < 0 || p > MAX_AMOUNT) return setError(`Revisa el precio de "${l.name}".`);
    }
    const items = valid.map((l) => ({ name: l.name.trim(), qty: Number(l.qty), price: Number(l.price) }));
    const sum = quoteTotal(items);
    if (sum <= 0) return setError("El total debe ser mayor a cero.");
    if (sum > MAX_AMOUNT) return setError("El total es demasiado alto. Revisa que no tenga ceros de más.");
    const digits = phone.replace(/\D/g, "");
    if (phone.trim() && (digits.length < 7 || digits.length > 15)) return setError("El número de WhatsApp no parece válido.");

    const now = new Date();
    const validUntil = new Date(now.getFullYear(), now.getMonth(), now.getDate() + Number(days), 23, 59, 59);

    setBusy(true);
    try {
      let cid = customerId;
      if (!cid && saveCustomer && name.trim().length >= 2) {
        try {
          cid = await addCustomer(business.id, { name, phone, document });
        } catch {
          cid = undefined; // si no se pudo guardar el cliente, la cotización sigue
        }
      }
      const q = await createQuote(business.id, {
        customerId: cid,
        customerName: name,
        customerPhone: phone,
        customerDocument: document,
        items,
        validUntil,
        notes,
      });
      setCreated(q);
    } catch (err) {
      console.error("Error al crear la cotización:", err);
      setError("No se pudo crear la cotización. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function share(q: Quote) {
    setShareMsg(null);
    const res = await shareQuoteWhatsApp(business, q);
    if (res === "descargado") setShareMsg("Descargamos el PDF y abrimos WhatsApp. Adjunta el archivo en el chat.");
  }

  if (created) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
        <div className="w-full max-w-sm rounded-t-2xl bg-white p-6 text-center sm:rounded-2xl">
          <p className="text-4xl" aria-hidden>✅</p>
          <h2 className="font-display mt-2 text-lg font-semibold text-navy-900">Cotización {quoteNumber(created)} creada</h2>
          <p className="mt-1 text-sm text-ink-soft">Envíala al cliente. Cuando la acepte, conviértela en recibo desde la lista.</p>
          <div className="mt-5 flex flex-col gap-2">
            <button onClick={() => void share(created)} className="rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90">
              Enviar por WhatsApp (PDF)
            </button>
            <button onClick={() => printQuote(business, created)} className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-navy-900 transition hover:bg-cream">
              Imprimir
            </button>
            <button onClick={() => downloadQuote(business, created)} className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-navy-900 transition hover:bg-cream">
              Descargar PDF
            </button>
            <button onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-ink-soft transition hover:bg-cream">
              Cerrar
            </button>
          </div>
          {shareMsg && <p className="mt-3 text-xs text-ink-soft">{shareMsg}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-navy-900">Nueva cotización</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink" aria-label="Cerrar">✕</button>
        </div>

        <form onSubmit={save} noValidate className="flex flex-col gap-4">
          <section className="flex flex-col gap-2">
            <label className="text-sm font-medium text-ink">Cliente
              <input
                className={`${INPUT} mt-1`}
                list="clientes-cot"
                maxLength={80}
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="Elige uno guardado o escribe un nombre nuevo"
              />
              <datalist id="clientes-cot">
                {customers.map((c) => (<option key={c.id} value={c.name} />))}
              </datalist>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input className={INPUT} type="tel" inputMode="tel" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="WhatsApp" aria-label="WhatsApp del cliente" />
              <input className={INPUT} maxLength={30} value={document} onChange={(e) => setDocument(e.target.value)} placeholder="Cédula o NIT" aria-label="Cédula o NIT del cliente" />
            </div>
            {!customerId && name.trim().length >= 2 && (
              <label className="flex items-center gap-2 text-xs text-ink-soft">
                <input type="checkbox" checked={saveCustomer} onChange={(e) => setSaveCustomer(e.target.checked)} />
                Guardar este cliente para la próxima vez
              </label>
            )}
          </section>

          <section>
            <p className="mb-2 text-sm font-medium text-ink">Qué cotizas</p>
            {products.length > 0 ? (
              <div className="-mx-1 mb-3 flex flex-wrap gap-2 px-1">
                {products.map((p) => (
                  <button key={p.id} type="button" onClick={() => addFromCatalog(p)} className="rounded-full border border-line bg-cream px-3 py-1.5 text-xs font-semibold text-navy-900 transition hover:bg-green-100">
                    {p.name} · {cop.format(p.price)}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mb-3 text-xs text-ink-soft">Tip: carga tu catálogo en el menú para agregar productos con un toque.</p>
            )}
            <div className="flex flex-col gap-2">
              {lines.map((l) => (
                <div key={l.key} className="rounded-xl border border-line p-3">
                  <div className="flex items-center gap-2">
                    <input className={INPUT} maxLength={80} value={l.name} onChange={(e) => patch(l.key, { name: e.target.value })} placeholder="Descripción" aria-label="Descripción" />
                    <button type="button" onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))} className="px-1 text-ink-soft hover:text-danger" aria-label="Quitar línea">✕</button>
                  </div>
                  <div className="mt-2 grid grid-cols-[88px_1fr] items-center gap-2">
                    <input className={INPUT} inputMode="decimal" value={l.qty} onChange={(e) => patch(l.key, { qty: e.target.value.replace(",", ".").replace(/[^0-9.]/g, "") })} aria-label="Cantidad" />
                    <MoneyInput value={l.price} onChange={(v) => patch(l.key, { price: v })} />
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={addFree} className="mt-2 text-xs font-semibold text-green-600 hover:underline">
              + Agregar línea manual
            </button>
          </section>

          <label className="text-sm font-medium text-ink">Válida por
            <select className={`${INPUT} mt-1`} value={days} onChange={(e) => setDays(e.target.value)}>
              {VALIDITY.map((d) => (<option key={d} value={d}>{d} días</option>))}
            </select>
          </label>

          <label className="text-sm font-medium text-ink">Observaciones (opcional)
            <textarea className={`${INPUT} mt-1`} rows={2} maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Condiciones, tiempos de entrega, forma de pago..." />
          </label>

          <div className="flex items-center justify-between rounded-xl bg-navy-900 px-4 py-3 text-white">
            <span className="text-sm text-white/70">Total</span>
            <span className="font-display text-xl font-semibold">{cop.format(total)}</span>
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}

          <button type="submit" disabled={busy} className="rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-500 disabled:opacity-60">
            {busy ? "Creando..." : "Crear cotización"}
          </button>
        </form>
      </div>
    </div>
  );
}
