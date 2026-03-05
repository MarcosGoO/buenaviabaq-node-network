"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useSettings } from "@/hooks/useSettings";
import { useSocketIO } from "@/hooks/useSocketIO";
import { cn } from "@/lib/utils";
import { Palette, Bell, Map, Wifi, RotateCcw, CheckCircle2, XCircle } from "lucide-react";

const SEVERITY_LABELS: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
};

export default function SettingsDashboard() {
  const { settings, updateSetting, resetSettings } = useSettings();
  const { isConnected } = useSocketIO();

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-1">Preferencias del dashboard VíaBaq</p>
      </div>

      <Tabs defaultValue="appearance">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="appearance" className="gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Apariencia</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Alertas</span>
          </TabsTrigger>
          <TabsTrigger value="map" className="gap-2">
            <Map className="h-4 w-4" />
            <span className="hidden sm:inline">Mapa</span>
          </TabsTrigger>
          <TabsTrigger value="connection" className="gap-2">
            <Wifi className="h-4 w-4" />
            <span className="hidden sm:inline">Conexión</span>
          </TabsTrigger>
        </TabsList>

        {/* Apariencia */}
        <TabsContent value="appearance" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tema</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex rounded-lg border overflow-hidden w-fit">
                {(['light', 'dark', 'system'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => updateSetting('theme', t)}
                    className={cn(
                      "px-5 py-2 text-sm font-medium transition-colors",
                      settings.theme === t
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-foreground hover:bg-muted"
                    )}
                  >
                    {t === 'light' ? 'Claro' : t === 'dark' ? 'Oscuro' : 'Sistema'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {settings.theme === 'system'
                  ? 'Sigue la preferencia del sistema operativo.'
                  : `Forzado a modo ${settings.theme === 'dark' ? 'oscuro' : 'claro'}.`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Idioma</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex rounded-lg border overflow-hidden w-fit">
                {(['es', 'en'] as const).map(lang => (
                  <button
                    key={lang}
                    onClick={() => updateSetting('language', lang)}
                    className={cn(
                      "px-5 py-2 text-sm font-medium transition-colors",
                      settings.language === lang
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-foreground hover:bg-muted"
                    )}
                  >
                    {lang === 'es' ? 'Español' : 'English'}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notificaciones */}
        <TabsContent value="notifications" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mostrar alertas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex rounded-lg border overflow-hidden w-fit">
                {([true, false] as const).map(val => (
                  <button
                    key={String(val)}
                    onClick={() => updateSetting('showAlerts', val)}
                    className={cn(
                      "px-5 py-2 text-sm font-medium transition-colors",
                      settings.showAlerts === val
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-foreground hover:bg-muted"
                    )}
                  >
                    {val ? 'Activadas' : 'Desactivadas'}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Severidad mínima</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex rounded-lg border overflow-hidden w-fit">
                {(['low', 'medium', 'high', 'critical'] as const).map(sev => (
                  <button
                    key={sev}
                    onClick={() => updateSetting('minAlertSeverity', sev)}
                    className={cn(
                      "px-4 py-2 text-sm font-medium transition-colors",
                      settings.minAlertSeverity === sev
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-foreground hover:bg-muted"
                    )}
                  >
                    {SEVERITY_LABELS[sev]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Solo se mostrarán alertas con severidad igual o mayor a la seleccionada.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mapa */}
        <TabsContent value="map" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Zoom por defecto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Nivel {settings.defaultZoom}</span>
                <span className="text-xs text-muted-foreground">(10 – 18)</span>
              </div>
              <Slider
                min={10}
                max={18}
                step={1}
                value={[settings.defaultZoom]}
                onValueChange={([val]) => updateSetting('defaultZoom', val)}
                className="w-full"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Auto-centrar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex rounded-lg border overflow-hidden w-fit">
                {([true, false] as const).map(val => (
                  <button
                    key={String(val)}
                    onClick={() => updateSetting('autoCenter', val)}
                    className={cn(
                      "px-5 py-2 text-sm font-medium transition-colors",
                      settings.autoCenter === val
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-foreground hover:bg-muted"
                    )}
                  >
                    {val ? 'Activado' : 'Desactivado'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                El mapa vuelve automáticamente al centro de Barranquilla al abrir.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Etiquetas de vías</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex rounded-lg border overflow-hidden w-fit">
                {([true, false] as const).map(val => (
                  <button
                    key={String(val)}
                    onClick={() => updateSetting('showRoadLabels', val)}
                    className={cn(
                      "px-5 py-2 text-sm font-medium transition-colors",
                      settings.showRoadLabels === val
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-foreground hover:bg-muted"
                    )}
                  >
                    {val ? 'Visibles' : 'Ocultas'}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Conexión */}
        <TabsContent value="connection" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estado del sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">Socket.IO</span>
                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span className="text-sm font-medium text-emerald-600">Conectado</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium text-red-600">Desconectado</span>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">API URL</span>
                <code className="block text-xs bg-muted px-3 py-2 rounded-md font-mono break-all">
                  {apiUrl}
                </code>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Socket URL</span>
                <code className="block text-xs bg-muted px-3 py-2 rounded-md font-mono break-all">
                  {socketUrl}
                </code>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Restablecer configuración</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Vuelve todos los ajustes a sus valores predeterminados.
              </p>
              <Button variant="outline" onClick={resetSettings} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Restablecer valores por defecto
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
