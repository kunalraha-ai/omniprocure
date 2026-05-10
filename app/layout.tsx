import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "OmniProcure — AI-Native Procurement",
  description: "Automate supply chain intelligence. Parse BOMs, compare suppliers, and monitor stock risks with AI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" />
      </head>
      <body className={`${geist.variable} ${geistMono.variable} antialiased`} style={{ background: "#0a0e1a", color: "#e0e8f0" }}>
        {children}
      </body>
    </html>
  );
}