"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { METHOD_LABELS, receiptLabel, receiptNumber } from "./receipts";
import type { Business, Receipt } from "@/types/pinak";

const NAVY: [number, number, number] = [16, 18, 58];
const GREEN: [number, number, number] = [76, 140, 107];
const SOFT: [number, number, number] = [107, 109, 133];

const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export function receiptFileName(r: Receipt): string {
  return `${r.docType === "factura" ? "factura" : "recibo"}-${receiptNumber(r)}.pdf`;
}

const TAX_LABELS: Record<string, string> = {
  no_responsable: "No responsable de IVA",
  responsable_iva: "Responsable de IVA",
  simple: "Régimen SIMPLE de tributación",
};

/** Fabricante del software de facturación (se imprime en las facturas generadas por sistema). */
const SOFTWARE_MAKER_NIT = process.env.NEXT_PUBLIC_SOFTWARE_NIT ?? "";
const SOFTWARE_MAKER_NAME = process.env.NEXT_PUBLIC_SOFTWARE_MAKER ?? "";

function fmtDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

type Rgb = [number, number, number];
const LINE: Rgb = [200, 202, 212];
const BAND: Rgb = [243, 244, 248];

/** Arma el PDF con aspecto de factura. Si es factura, incluye los datos que exige la norma. */
export function buildReceiptPdf(business: Pick<Business, "name" | "nit" | "phone" | "city" | "photoURL">, r: Receipt): Blob {
  const isInvoice = r.docType === "factura" && !!r.fiscal;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;
  const IW = W - M * 2;

  // Marco de la hoja (se repite en cada página)
  const frame = () => {
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.4);
    doc.rect(M - 3, M - 3, IW + 6, H - (M - 3) * 2);
  };
  frame();

  // --- Encabezado: membrete (izq.) y número (der.) ---
  const hTop = M;
  const hH = 34;
  const rightW = 66;
  const leftW = IW - rightW - 3;
  doc.rect(M, hTop, leftW, hH);
  let tx = M + 4;
  if (business.photoURL) {
    try {
      doc.addImage(business.photoURL, "JPEG", M + 3, hTop + 5, 24, 24);
      tx = M + 31;
    } catch {
      /* sin logo */
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...NAVY);
  const nameLines = doc.splitTextToSize(business.name || "Mi negocio", leftW - (tx - M) - 3).slice(0, 2);
  doc.text(nameLines, tx, hTop + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SOFT);
  const info = [
    business.nit ? `NIT: ${business.nit}` : "",
    isInvoice ? TAX_LABELS[r.fiscal!.taxStatus] ?? "" : "",
    isInvoice && r.fiscal!.taxNote ? r.fiscal!.taxNote : "",
    [business.phone ? `Tel: ${business.phone}` : "", business.city].filter(Boolean).join(" · "),
  ].filter(Boolean);
  const infoY = hTop + 9 + nameLines.length * 5.5;
  info.slice(0, 4).forEach((line, i) => doc.text(doc.splitTextToSize(line, leftW - (tx - M) - 3)[0], tx, infoY + i * 4));

  const rx = M + leftW + 3;
  doc.setFillColor(...NAVY);
  doc.rect(rx, hTop, rightW, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(isInvoice ? 11 : 10.5);
  doc.text(isInvoice ? "FACTURA DE VENTA" : "RECIBO DE VENTA", rx + rightW / 2, hTop + 7.7, { align: "center" });
  doc.rect(rx, hTop + 12, rightW, hH - 12);
  doc.setTextColor(...SOFT);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("No.", rx + rightW / 2, hTop + 20, { align: "center" });
  doc.setTextColor(...GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(receiptNumber(r), rx + rightW / 2, hTop + 28.5, { align: "center" });

  let y = hTop + hH + 3;
  /** Límite inferior del contenido: debajo va el pie de página. */
  const BOTTOM = H - M - 16;
  /** Si lo que sigue no cabe en la página, pasa a una nueva para que nada se encime. */
  const room = (h: number) => {
    if (y + h > BOTTOM) {
      doc.addPage();
      frame();
      y = M + 6;
    }
  };

  // --- Autorización de numeración ---
  if (isInvoice) {
    const f = r.fiscal!;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const txt = doc.splitTextToSize(
      `Autorización de numeración DIAN No. ${f.resolutionNumber} del ${fmtDate(f.resolutionDate)}` +
        `${f.prefix ? `, prefijo ${f.prefix}` : ""}, del ${f.rangeFrom} al ${f.rangeTo}. Vigencia hasta el ${fmtDate(f.validUntil)}.`,
      IW - 6
    );
    const bh = txt.length * 3.8 + 3.5;
    doc.setFillColor(...BAND);
    doc.rect(M, y, IW, bh, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...NAVY);
    doc.text(txt, M + 3, y + 5);
    y += bh + 3;
  }

  // --- Datos del cliente y del documento ---
  const fecha = r.date.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
  const hora = r.date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  const credito = r.status === "pendiente";
  const vence = r.dueDate ? r.dueDate.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
  const cells: [string, string][] = [
    ["CLIENTE", r.customerName],
    [isInvoice ? "NIT / C.C." : "DOCUMENTO", r.customerDocument || (isInvoice ? "222222222222" : "")],
    ["FECHA Y HORA", `${fecha}  ${hora}`],
    isInvoice
      ? ["FORMA DE PAGO", credito ? `Crédito${vence ? ` · vence ${vence}` : ""}` : "Contado"]
      : ["ESTADO", credito ? "Pendiente de pago" : "Pagado"],
  ];
  const cw = IW / 2;
  const rh = 12;
  cells.forEach(([k, v], i) => {
    const cx = M + (i % 2) * cw;
    const cy = y + Math.floor(i / 2) * rh;
    doc.setDrawColor(...LINE);
    doc.rect(cx, cy, cw, rh);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...SOFT);
    doc.text(k, cx + 3, cy + 4.3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text(doc.splitTextToSize(v || "—", cw - 6)[0], cx + 3, cy + 9.3);
  });
  y += rh * 2 + 4;

  // --- Detalle ---
  const head = isInvoice
    ? [["#", "Descripción", "Unid.", "Cant.", "Vr. unitario", "IVA", "Valor"]]
    : [["Descripción", "Cant.", "Vr. unitario", "Valor"]];
  const body = r.items.map((i, idx) =>
    isInvoice
      ? [String(idx + 1), i.name, i.unit ?? "UND", String(i.qty), cop.format(i.price), `${i.ivaRate ?? 0}%`, cop.format(Math.round(i.qty * i.price))]
      : [i.name, String(i.qty), cop.format(i.price), cop.format(Math.round(i.qty * i.price))]
  );
  autoTable(doc, {
    startY: y,
    head,
    body,
    margin: { left: M, right: M, top: M + 4, bottom: M + 16 },
    didDrawPage: (d) => {
      if (d.pageNumber > 1) frame();
    },
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 8.5, lineColor: NAVY },
    styles: { fontSize: 9.5, cellPadding: 2.2, textColor: NAVY, lineColor: LINE, lineWidth: 0.2 },
    columnStyles: isInvoice
      ? {
          0: { cellWidth: 8, halign: "center" },
          2: { cellWidth: 14, halign: "center" },
          3: { cellWidth: 14, halign: "center" },
          4: { halign: "right", cellWidth: 29 },
          5: { halign: "center", cellWidth: 13 },
          6: { halign: "right", cellWidth: 30 },
        }
      : { 1: { halign: "center", cellWidth: 18 }, 2: { halign: "right", cellWidth: 32 }, 3: { halign: "right", cellWidth: 34 } },
    didParseCell: (data) => {
      if (data.section !== "head") return;
      const align = isInvoice ? { 0: "center", 2: "center", 3: "center", 4: "right", 5: "center", 6: "right" } : { 1: "center", 2: "right", 3: "right" };
      const a = (align as unknown as Record<number, "center" | "right">)[data.column.index];
      if (a) data.cell.styles.halign = a;
    },
  });
  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20) + 4;

  // --- Totales (derecha) y observaciones (izquierda) ---
  const rows: [string, string, boolean][] = [];
  if (isInvoice) {
    rows.push(["Subtotal", cop.format(r.subtotal ?? r.total), false]);
    const byRate = new Map<number, number>();
    r.items.forEach((i) => {
      const rate = i.ivaRate ?? 0;
      if (rate > 0) byRate.set(rate, (byRate.get(rate) ?? 0) + Math.round((Math.round(i.qty * i.price) * rate) / 100));
    });
    [...byRate.entries()].sort((a, b) => a[0] - b[0]).forEach(([rate, v]) => rows.push([`IVA ${rate}%`, cop.format(v), false]));
  }
  room(rows.length * 7 + 14);
  const totW = 78;
  const totX = W - M - totW;
  let ty = y;
  doc.setDrawColor(...LINE);
  rows.forEach(([k, v]) => {
    doc.rect(totX, ty, totW, 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...SOFT);
    doc.text(k, totX + 3, ty + 4.8);
    doc.setTextColor(...NAVY);
    doc.text(v, totX + totW - 3, ty + 4.8, { align: "right" });
    ty += 7;
  });
  doc.setFillColor(...NAVY);
  doc.rect(totX, ty, totW, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL", totX + 3, ty + 6.8);
  doc.text(cop.format(r.total), totX + totW - 3, ty + 6.8, { align: "right" });
  ty += 10;

  // Izquierda: medio de pago y observaciones (línea por línea, saltando de página si hace falta)
  const startPage = doc.getNumberOfPages();
  const totalsEnd = ty;
  let ly = y + 4;
  const notesW = totX - M - 6;
  const line = (text: string) => {
    if (ly + 4 > BOTTOM) {
      doc.addPage();
      frame();
      ly = M + 6;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...SOFT);
    doc.text(text, M, ly);
    ly += 4.2;
  };
  if (!credito) line(`Medio de pago: ${METHOD_LABELS[r.method]}`);
  if (r.notes) {
    // Si las observaciones pasan a otra página, ocupan todo el ancho.
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const wide = doc.splitTextToSize(`Observaciones: ${r.notes}`, notesW) as string[];
    wide.forEach(line);
  }
  const samePage = doc.getNumberOfPages() === startPage;
  y = (samePage ? Math.max(totalsEnd, ly) : ly) + 4;

  // Estado en recibos
  if (!isInvoice) {
    room(10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...(r.status === "pagado" ? GREEN : ([179, 80, 63] as Rgb)));
    doc.text(r.status === "pagado" ? "PAGADO" : "PENDIENTE DE PAGO", M, y + 4);
  }

  // --- Pie (en todas las páginas) ---
  const fy = H - M - 12;
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(M, fy, W - M, fy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...SOFT);
    if (isInvoice) {
      doc.text("Factura de venta generada por sistema informático.", W / 2, fy + 5, { align: "center" });
      const maker = [SOFTWARE_MAKER_NAME, SOFTWARE_MAKER_NIT ? `NIT ${SOFTWARE_MAKER_NIT}` : ""].filter(Boolean).join(" · ");
      doc.text(`Software: Pinak${maker ? ` · Fabricante: ${maker}` : ""}`, W / 2, fy + 9, { align: "center" });
    } else {
      doc.text("Comprobante de venta interno. No constituye factura electrónica de venta ante la DIAN.", W / 2, fy + 5, { align: "center" });
      doc.text("Generado con Pinak", W / 2, fy + 9, { align: "center" });
    }
    if (pages > 1) doc.text(`Página ${i} de ${pages}`, W - M, fy + 9, { align: "right" });
  }

  return doc.output("blob");
}

/** Abre el diálogo de impresión del navegador con el PDF. */
export function printReceipt(business: Parameters<typeof buildReceiptPdf>[0], r: Receipt) {
  const url = URL.createObjectURL(buildReceiptPdf(business, r));
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  frame.src = url;
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      window.open(url, "_blank"); // si el navegador bloquea la impresión, se abre el PDF
    }
    setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
    }, 60000);
  };
  document.body.appendChild(frame);
}

export function normalizePhone(raw?: string): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("57")) return digits;
  if (digits.length === 10) return `57${digits}`;
  return digits;
}

export function receiptMessage(businessName: string, r: Receipt): string {
  const negocio = businessName.trim() || "nuestro negocio";
  return (
    `¡Hola ${r.customerName}! Gracias por tu compra en ${negocio}. ` +
    `Te comparto tu ${receiptLabel(r).toLowerCase().replace("factura ", "factura ").replace("recibo no. ", "recibo No. ")} por ${cop.format(r.total)}. ¡Gracias!`
  );
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadReceipt(business: Parameters<typeof buildReceiptPdf>[0], r: Receipt) {
  download(buildReceiptPdf(business, r), receiptFileName(r));
}

/**
 * Comparte el recibo en PDF. En el celular abre el menú de compartir con el archivo adjunto
 * (ahí se elige WhatsApp). En el computador descarga el PDF y abre el chat con el mensaje
 * escrito, para que la persona adjunte el archivo descargado.
 */
export async function shareReceiptWhatsApp(
  business: Parameters<typeof buildReceiptPdf>[0],
  r: Receipt
): Promise<"compartido" | "descargado"> {
  const blob = buildReceiptPdf(business, r);
  const name = receiptFileName(r);
  const text = receiptMessage(business.name, r);
  const file = new File([blob], name, { type: "application/pdf" });

  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, title: receiptLabel(r) });
      return "compartido";
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return "compartido";
    }
  }
  download(blob, name);
  const phone = normalizePhone(r.customerPhone);
  const link = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(link, "_blank", "noopener,noreferrer");
  return "descargado";
}
