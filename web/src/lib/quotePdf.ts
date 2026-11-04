"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { download, normalizePhone } from "./receiptPdf";
import { quoteNumber } from "./quotes";
import type { Business, Quote } from "@/types/pinak";

type Rgb = [number, number, number];
const NAVY: Rgb = [16, 18, 58];
const GREEN: Rgb = [76, 140, 107];
const SOFT: Rgb = [107, 109, 133];
const LINE: Rgb = [200, 202, 212];

const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const fmt = (d: Date) => d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });

export function quoteFileName(q: Quote): string {
  return `cotizacion-${quoteNumber(q)}.pdf`;
}

type PdfBusiness = Pick<Business, "name" | "nit" | "phone" | "city" | "photoURL">;

/** PDF de la cotización con el membrete del negocio. */
export function buildQuotePdf(business: PdfBusiness, q: Quote): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;
  const IW = W - M * 2;

  const frame = () => {
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.4);
    doc.rect(M - 3, M - 3, IW + 6, H - (M - 3) * 2);
  };
  frame();

  // Encabezado: membrete (izq.) y número (der.)
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
    [business.phone ? `Tel: ${business.phone}` : "", business.city].filter(Boolean).join(" · "),
  ].filter(Boolean);
  const infoY = hTop + 9 + nameLines.length * 5.5;
  info.forEach((line, i) => doc.text(doc.splitTextToSize(line, leftW - (tx - M) - 3)[0], tx, infoY + i * 4));

  const rx = M + leftW + 3;
  doc.setFillColor(...NAVY);
  doc.rect(rx, hTop, rightW, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("COTIZACIÓN", rx + rightW / 2, hTop + 7.7, { align: "center" });
  doc.rect(rx, hTop + 12, rightW, hH - 12);
  doc.setTextColor(...SOFT);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("No.", rx + rightW / 2, hTop + 20, { align: "center" });
  doc.setTextColor(...GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(quoteNumber(q), rx + rightW / 2, hTop + 28.5, { align: "center" });

  let y = hTop + hH + 3;
  const BOTTOM = H - M - 16;
  const room = (h: number) => {
    if (y + h > BOTTOM) {
      doc.addPage();
      frame();
      y = M + 6;
    }
  };

  // Datos del cliente y de la oferta
  const cells: [string, string][] = [
    ["CLIENTE", q.customerName],
    ["DOCUMENTO", q.customerDocument || "—"],
    ["FECHA", fmt(q.date)],
    ["VÁLIDA HASTA", fmt(q.validUntil)],
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
    doc.text(doc.splitTextToSize(v, cw - 6)[0], cx + 3, cy + 9.3);
  });
  y += rh * 2 + 4;

  // Detalle
  autoTable(doc, {
    startY: y,
    head: [["#", "Descripción", "Cant.", "Vr. unitario", "Valor"]],
    body: q.items.map((i, idx) => [String(idx + 1), i.name, String(i.qty), cop.format(i.price), cop.format(Math.round(i.qty * i.price))]),
    margin: { left: M, right: M, top: M + 4, bottom: M + 16 },
    didDrawPage: (d) => {
      if (d.pageNumber > 1) frame();
    },
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 8.5, lineColor: NAVY },
    styles: { fontSize: 9.5, cellPadding: 2.2, textColor: NAVY, lineColor: LINE, lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      2: { cellWidth: 16, halign: "center" },
      3: { halign: "right", cellWidth: 32 },
      4: { halign: "right", cellWidth: 34 },
    },
    didParseCell: (data) => {
      if (data.section !== "head") return;
      const align: Record<number, "center" | "right"> = { 0: "center", 2: "center", 3: "right", 4: "right" };
      const a = align[data.column.index];
      if (a) data.cell.styles.halign = a;
    },
  });
  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20) + 4;

  // Total
  room(16);
  const totW = 78;
  const totX = W - M - totW;
  doc.setFillColor(...NAVY);
  doc.rect(totX, y, totW, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL", totX + 3, y + 6.8);
  doc.text(cop.format(q.total), totX + totW - 3, y + 6.8, { align: "right" });
  y += 16;

  // Observaciones y condiciones (línea por línea, con salto de página si hace falta)
  const line = (text: string, bold = false) => {
    room(5);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(9);
    doc.setTextColor(...SOFT);
    doc.text(text, M, y);
    y += 4.4;
  };
  if (q.notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    (doc.splitTextToSize(`Observaciones: ${q.notes}`, IW - 4) as string[]).forEach((l) => line(l));
    y += 2;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  (doc.splitTextToSize(
    `Esta cotización es una propuesta de precios y es válida hasta el ${fmt(q.validUntil)}. No es una factura ni un comprobante de pago.`,
    IW - 4
  ) as string[]).forEach((l) => line(l));

  // Pie en todas las páginas
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
    doc.text("Generado con Pinak", W / 2, fy + 5, { align: "center" });
    if (pages > 1) doc.text(`Página ${i} de ${pages}`, W - M, fy + 9, { align: "right" });
  }

  return doc.output("blob");
}

export function quoteMessage(businessName: string, q: Quote): string {
  const negocio = businessName.trim() || "nuestro negocio";
  return (
    `¡Hola ${q.customerName}! Te comparto la cotización ${quoteNumber(q)} de ${negocio} por ${cop.format(q.total)}, ` +
    `válida hasta el ${fmt(q.validUntil)}. Quedamos atentos a tus comentarios.`
  );
}

export function downloadQuote(business: PdfBusiness, q: Quote) {
  download(buildQuotePdf(business, q), quoteFileName(q));
}

/** Abre el diálogo de impresión del navegador con el PDF. */
export function printQuote(business: PdfBusiness, q: Quote) {
  const url = URL.createObjectURL(buildQuotePdf(business, q));
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  frame.src = url;
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      window.open(url, "_blank");
    }
    setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
    }, 60000);
  };
  document.body.appendChild(frame);
}

/** Comparte la cotización en PDF (menú de compartir en el celular; descarga + chat de WhatsApp en el computador). */
export async function shareQuoteWhatsApp(business: PdfBusiness, q: Quote): Promise<"compartido" | "descargado"> {
  const blob = buildQuotePdf(business, q);
  const name = quoteFileName(q);
  const text = quoteMessage(business.name, q);
  const file = new File([blob], name, { type: "application/pdf" });

  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, title: `Cotización ${quoteNumber(q)}` });
      return "compartido";
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return "compartido";
    }
  }
  download(blob, name);
  const phone = normalizePhone(q.customerPhone);
  const link = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(link, "_blank", "noopener,noreferrer");
  return "descargado";
}
