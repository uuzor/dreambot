import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://dreampilot.app"),
  title: {
    default: "DreamPilot — autonomous perps agents on Somnia",
    template: "%s · DreamPilot",
  },
  description:
    "Deploy an autonomous trading agent against your own DreamDEX account on Somnia. Your keys stay yours: the bot key can trade, and can never withdraw.",
  keywords: [
    "DreamDEX",
    "Somnia",
    "perpetual futures",
    "trading bot",
    "autonomous agents",
    "Telegram",
  ],
  openGraph: {
    title: "DreamPilot — autonomous perps agents on Somnia",
    description:
      "Multi-user trading agents for DreamDEX perps. Non-custodial by construction.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-ink text-chalk antialiased">{children}</body>
    </html>
  );
}
