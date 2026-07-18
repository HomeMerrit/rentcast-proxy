import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Atlas — Build a company that builds itself",
  description:
    "Your business, brought to life. Hire workers, give them tools, and watch a whole company work, hand off and grow — in a living world you can actually look at.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${display.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-canvas font-sans text-content antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
