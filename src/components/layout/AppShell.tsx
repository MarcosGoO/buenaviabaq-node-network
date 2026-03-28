"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { APP_NAV_ITEMS, Sidebar } from "@/components/layout/Sidebar"

interface AppShellProps {
  children: React.ReactNode
  mainClassName?: string
}

export function AppShell({ children, mainClassName }: AppShellProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  React.useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  return (
    <div className="relative min-h-dvh bg-background md:flex md:h-screen md:overflow-hidden">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/70 bg-background/95 backdrop-blur md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                VíaBaq
              </p>
              <p className="text-sm font-semibold text-foreground">Barranquilla en tiempo real</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="focus-ring h-10 w-10 rounded-xl"
            aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-background/70 backdrop-blur-sm transition-opacity md:hidden",
          mobileMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden={!mobileMenuOpen}
      />

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[min(18rem,calc(100vw-1.5rem))] max-w-full border-r border-border/70 bg-background shadow-2xl transition-transform duration-300 ease-out md:hidden",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border/70 px-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Navegación
            </p>
            <p className="text-sm font-semibold text-foreground">Panel principal</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="focus-ring h-9 w-9 rounded-lg"
            aria-label="Cerrar menú"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Sidebar allowCollapse={false} onNavigate={() => setMobileMenuOpen(false)} />
      </div>

      <div className="hidden md:block md:shrink-0">
        <Sidebar />
      </div>

      <main
        className={cn(
          "relative flex-1 pt-14 pb-20 md:pt-0 md:pb-0",
          mainClassName
        )}
      >
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/95 px-2 py-2 backdrop-blur md:hidden">
        <div className="grid grid-cols-5 gap-1">
          {APP_NAV_ITEMS.map(({ href, label, mobileLabel, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "focus-ring interactive-soft flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-center",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[10px] font-medium leading-none">{mobileLabel ?? label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
