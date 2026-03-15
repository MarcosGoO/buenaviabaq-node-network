import type { Metadata } from "next";
import "./globals.css";
import { ConnectionStatus } from "@/components/alerts/ConnectionStatus";

export const metadata: Metadata = {
  title: "Buenavia BQ",
  description: "Plataforma de inteligencia vial para Barranquilla",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased"
        suppressHydrationWarning={true}
      >
        {children}
        <ConnectionStatus />
      </body>
    </html>
  );
}
