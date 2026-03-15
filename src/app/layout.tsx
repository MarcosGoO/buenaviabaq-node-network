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
    <html lang="es">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (() => {
                try {
                  const raw = localStorage.getItem('viabaq:settings');
                  const theme = raw ? JSON.parse(raw)?.theme : 'system';
                  const root = document.documentElement;
                  if (theme === 'dark') root.classList.add('dark');
                  else if (theme === 'light') root.classList.remove('dark');
                  else root.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
                } catch {}
              })();
            `,
          }}
        />
      </head>
      <body
        className="antialiased bg-background text-foreground"
        suppressHydrationWarning={true}
      >
        {children}
        <ConnectionStatus />
      </body>
    </html>
  );
}

