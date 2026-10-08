import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";
import { BusinessProvider } from "@/lib/business";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "PINAK — Asistente Financiero con IA",
  description:
    "El asistente financiero con IA que pone tu negocio en piloto automático.",
  applicationName: "PINAK",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "PINAK",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

// Color de la barra del sistema cuando la app está instalada (azul marino de la marca).
export const viewport: Viewport = {
  themeColor: "#10123a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream text-ink">
        <BusinessProvider>{children}</BusinessProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
