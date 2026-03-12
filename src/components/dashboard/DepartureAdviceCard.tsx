"use client";

import { AlertTriangle, Clock3, CloudRain, ShieldAlert, TimerReset } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDepartureAdvice } from "@/hooks/useDepartureAdvice";

function formatTime(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function riskTone(score: number) {
  if (score >= 75) {
    return {
      badge: "bg-red-500/15 text-red-700 border-red-500/30",
      bar: "bg-red-500",
      label: "Riesgo alto",
    };
  }

  if (score >= 45) {
    return {
      badge: "bg-amber-500/15 text-amber-700 border-amber-500/30",
      bar: "bg-amber-500",
      label: "Riesgo medio",
    };
  }

  return {
    badge: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    bar: "bg-emerald-500",
    label: "Riesgo bajo",
  };
}

export default function DepartureAdviceCard() {
  const { advice, loading, error, refetch } = useDepartureAdvice(4, 30);

  if (loading) {
    return (
      <Card className="overflow-hidden border-sky-200/70 bg-gradient-to-br from-sky-50 via-cyan-50 to-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <Clock3 className="h-5 w-5 text-sky-600" />
            Mejor Hora para Salir
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 rounded-2xl bg-white/70 border border-sky-100 animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (error || !advice) {
    return (
      <Card className="overflow-hidden border-rose-200/70 bg-gradient-to-br from-rose-50 via-orange-50 to-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <AlertTriangle className="h-5 w-5 text-rose-600" />
            Mejor Hora para Salir
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">{error ?? "Sin datos disponibles."}</p>
          <Button onClick={refetch} variant="outline" className="bg-white/80">
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  const best = advice.best_departure;
  const tone = riskTone(best.risk_score);
  const topWindows = advice.windows.slice(0, 4);

  return (
    <Card className="overflow-hidden border-sky-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_35%),linear-gradient(135deg,_rgba(255,255,255,1),_rgba(240,249,255,1))]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3 text-slate-900">
          <span className="flex items-center gap-2">
            <Clock3 className="h-5 w-5 text-sky-600" />
            Mejor Hora para Salir
          </span>
          <Button onClick={refetch} variant="ghost" size="icon" className="text-slate-500 hover:text-slate-900">
            <TimerReset className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Ventana recomendada</p>
              <p className="mt-2 text-4xl font-black tracking-tight text-slate-950">{formatTime(best.departure_time)}</p>
              <p className="mt-2 max-w-xl text-sm text-slate-600">{best.recommendation}</p>
            </div>
            <div className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${tone.badge}`}>
              {tone.label}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Velocidad</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{best.expected_avg_speed_kmh} km/h</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Viaje</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{best.expected_travel_time_minutes} min</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Lluvia</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{best.rain_probability}%</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Score</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{best.risk_score}/100</p>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
              <span>Riesgo agregado</span>
              <span>{best.risk_score}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div className={`h-full rounded-full transition-all ${tone.bar}`} style={{ width: `${best.risk_score}%` }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="rounded-2xl border border-white/70 bg-white/75 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Ventanas proximas</p>
            <div className="space-y-2">
              {topWindows.map((window) => {
                const windowTone = riskTone(window.risk_score);
                return (
                  <div key={window.departure_time} className="grid grid-cols-[88px,1fr,72px] items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
                    <div className="text-sm font-bold text-slate-900">{formatTime(window.departure_time)}</div>
                    <div>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>{window.expected_avg_speed_kmh} km/h</span>
                        <span>{window.expected_travel_time_minutes} min</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div className={`h-full rounded-full ${windowTone.bar}`} style={{ width: `${window.risk_score}%` }} />
                      </div>
                    </div>
                    <div className={`rounded-full border px-2 py-1 text-center text-[11px] font-bold ${windowTone.badge}`}>
                      {window.risk_score}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/70 bg-white/75 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Contexto actual</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                <span className="flex items-center gap-2 text-sm text-slate-600">
                  <ShieldAlert className="h-4 w-4 text-rose-500" />
                  Alertas activas
                </span>
                <span className="text-lg font-bold text-slate-900">{advice.context.active_alerts}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                <span className="flex items-center gap-2 text-sm text-slate-600">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Criticas
                </span>
                <span className="text-lg font-bold text-slate-900">{advice.context.critical_alerts}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                <span className="flex items-center gap-2 text-sm text-slate-600">
                  <CloudRain className="h-4 w-4 text-sky-500" />
                  Lluvia ahora
                </span>
                <span className="text-lg font-bold text-slate-900">{advice.context.rain_now_probability}%</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

