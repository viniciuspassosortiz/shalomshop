import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Playfair_Display } from "next/font/google";
import "./globals.css";

const display = Playfair_Display({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-display", display: "swap" });
const body = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken", display: "swap" });

export const metadata: Metadata = {
  title: "ShalomShop | Variedades",
  description: "Limpeza, vassouras e rodos, panos, papelaria, utilidades e muito mais. Escolha seus produtos e envie o pedido pelo WhatsApp.",
  manifest: "/manifest.json",
  icons: { apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "ShalomShop", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b2a4a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
