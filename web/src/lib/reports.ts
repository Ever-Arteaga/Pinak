"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import type { Transaction } from "@/types/pinak";

const currency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function computeTotals(transactions: Transaction[]) {
  return transactions.reduce(
    (acc, t) => {
      if (t.type === "ingreso") {
        acc.totalIngresos += t.amount;
        acc.balance += t.amount;
      } else {
        acc.totalEgresos += t.amount;
        acc.balance -= t.amount;
      }
      return acc;
    },
    { balance: 0, totalIngresos: 0, totalEgresos: 0 }
  );
}

function slugify(text: string) {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "negocio"
  );
}

function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export async function exportTransactionsToExcel(
  businessName: string,
  transactions: Transaction[]
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Movimientos");

  sheet.columns = [
    { header: "Fecha", key: "fecha", width: 12 },
    { header: "Tipo", key: "tipo", width: 10 },
    { header: "Categoría", key: "categoria", width: 18 },
    { header: "Método", key: "metodo", width: 14 },
    { header: "Descripción", key: "descripcion", width: 28 },
    { header: "Monto", key: "monto", width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };

  transactions.forEach((t) => {
    sheet.addRow({
      fecha: dateFormatter.format(t.date),
      tipo: t.type === "ingreso" ? "Ingreso" : "Egreso",
      categoria: t.category,
      metodo: t.method.charAt(0).toUpperCase() + t.method.slice(1),
      descripcion: t.description || "",
      monto: t.amount,
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `PINAK_${slugify(businessName)}_${todayStamp()}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportTransactionsToPdf(businessName: string, transactions: Transaction[]) {
  const doc = new jsPDF();
  const { totalIngresos, totalEgresos, balance } = computeTotals(transactions);

  doc.setFontSize(16);
  doc.setTextColor(16, 18, 58);
  doc.text("PINAK — Reporte de movimientos", 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(90, 90, 100);
  doc.text(businessName, 14, 25);
  doc.text(`Generado el ${dateFormatter.format(new Date())}`, 14, 30);

  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text(`Ingresos: ${currency.format(totalIngresos)}`, 14, 40);
  doc.text(`Egresos: ${currency.format(totalEgresos)}`, 14, 46);
  doc.text(`Balance: ${currency.format(balance)}`, 14, 52);

  autoTable(doc, {
    startY: 58,
    head: [["Fecha", "Tipo", "Categoría", "Método", "Descripción", "Monto"]],
    body: transactions.map((t) => [
      dateFormatter.format(t.date),
      t.type === "ingreso" ? "Ingreso" : "Egreso",
      t.category,
      t.method.charAt(0).toUpperCase() + t.method.slice(1),
      t.description || "-",
      currency.format(t.amount),
    ]),
    headStyles: { fillColor: [16, 18, 58] },
    styles: { fontSize: 8 },
  });

  doc.save(`PINAK_${slugify(businessName)}_${todayStamp()}.pdf`);
}
