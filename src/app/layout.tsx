import type { Metadata } from "next"
import "./globals.css"
import { ConnectionStatus } from "@/components/alerts/ConnectionStatus"
import { getThemeBootstrapScript } from "@/lib/theme"

export const metadata: Metadata = {
  title: "Buenavia BQ",
  description: "Plataforma de inteligencia vial para Barranquilla",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: getThemeBootstrapScript(),
          }}
        />
      </head>
      <body className="bg-background text-foreground antialiased">
        {children}
        <ConnectionStatus />
      </body>
    </html>
  )
}
