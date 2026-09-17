import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import { fromByteArray } from "base64-js";
import ExcelJS from "exceljs";
import type { Transaction } from "../types/pinak";

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

function slug(text: string) {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "negocio"
  );
}

async function shareFile(uri: string, filename: string, mimeType: string) {
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, { mimeType, dialogTitle: filename });
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return fromByteArray(new Uint8Array(buffer));
}

export async function exportTransactionsToExcel(businessName: string, transactions: Transaction[]) {
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
  const base64 = arrayBufferToBase64(buffer as ArrayBuffer);

  const file = new File(Paths.cache, `${slug(businessName)}-movimientos.xlsx`);
  if (file.exists) file.delete();
  file.create();
  file.write(base64, { encoding: "base64" });

  await shareFile(
    file.uri,
    `${slug(businessName)}-movimientos.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

export async function exportTransactionsToPdf(businessName: string, transactions: Transaction[]) {
  const { totalIngresos, totalEgresos, balance } = computeTotals(transactions);

  const rows = transactions
    .map(
      (t) => `
      <tr>
        <td>${dateFormatter.format(t.date)}</td>
        <td>${t.type === "ingreso" ? "Ingreso" : "Egreso"}</td>
        <td>${t.category}</td>
        <td>${t.method.charAt(0).toUpperCase() + t.method.slice(1)}</td>
        <td>${t.description || "-"}</td>
        <td>${currency.format(t.amount)}</td>
      </tr>`
    )
    .join("");

  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 24px; color: #1b1c29; }
          h1 { color: #10123a; font-size: 20px; margin-bottom: 4px; }
          p.meta { color: #5c5f72; font-size: 12px; margin: 2px 0; }
          .totals { margin-top: 16px; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 11px; }
          th, td { border-bottom: 1px solid #e4e3dd; padding: 6px 8px; text-align: left; }
          th { background: #10123a; color: white; }
        </style>
      </head>
      <body>
        <h1>PINAK — Reporte de movimientos</h1>
        <p class="meta">${businessName}</p>
        <p class="meta">Generado el ${dateFormatter.format(new Date())}</p>
        <div class="totals">
          <p>Ingresos: ${currency.format(totalIngresos)}</p>
          <p>Egresos: ${currency.format(totalEgresos)}</p>
          <p><strong>Balance: ${currency.format(balance)}</strong></p>
        </div>
        <table>
          <thead>
            <tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Método</th><th>Descripción</th><th>Monto</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>`;

  const { uri } = await Print.printToFileAsync({ html });
  await shareFile(uri, `${slug(businessName)}-reporte.pdf`, "application/pdf");
}
