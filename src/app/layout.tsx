import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DataEcho — Enterprise Bidirectional Data Platform",
  description: "AI-driven enterprise data platform for bidirectional data movement between on-premise databases and cloud ecosystems. Powered by MCP.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
