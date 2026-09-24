import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PINAK — Asistente Financiero con IA",
  description:
    "El asistente financiero con IA que pone tu negocio en piloto automático.",
  icons: {
    icon: "/favicon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-cream text-ink">{children}</body>
    </html>
  );
}