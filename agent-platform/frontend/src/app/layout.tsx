import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import HumanInbox from "@/components/HumanInbox";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AgentOS — AI Employee Platform",
  description: "Your AI workforce, always on.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-950 text-gray-100 min-h-screen`}>
        <header className="sticky top-0 z-30 border-b border-gray-800 bg-gray-950/90 backdrop-blur-sm">
          <div className="mx-auto max-w-7xl flex h-14 items-center px-4">
            <span className="text-sm font-semibold text-gray-100">AgentOS</span>
            <div className="ml-auto">
              <HumanInbox />
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
