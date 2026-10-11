import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "JDA · Gestão Integrada", template: "%s | JDA" },
  description: "Gestão comercial, jurídica e operacional da área tributária.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
