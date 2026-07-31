import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Encorpei Invest",
  description:
    "Sistema operacional de inteligência para investimentos. Teses vivas, decisões explicáveis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
