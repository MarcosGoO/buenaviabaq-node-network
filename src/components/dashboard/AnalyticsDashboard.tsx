"use client";

import React, { useEffect, useState, useCallback } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Cloud, AlertTriangle, LayoutDashboard, TrendingUp, TrendingDown, Minus, GitCompareArrows, ChevronDown } from 'lucide-react';
import DepartureAdviceCard from '@/components/dashboard/DepartureAdviceCard';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

interface HourlyPattern {
  hour: number;
  avg_speed: number;
  congestion_level: string;
  traffic_volume: number;
}

interface Hotspot {
  road_id: number;
  road_name: string;
  congestion_frequency: number;
  avg_speed: number;
  total_incidents: number;
}

interface WeatherImpact {
  is_raining: boolean;
  avg_speed: number;
  typical_congestion: string;
  sample_count: number;
  avg_travel_time: number;
}

interface ExecutiveSummary {
  system: { avg_speed_kmh: number; overall_congestion_level: string; total_active_roads: number; monitored_zones: number };
  traffic: { current_avg_speed: number; historical_avg_speed: number; speed_change_percentage: number; congestion_breakdown: { low: number; moderate: number; high: number; severe: number } };
  weather: { current_condition: string; temperature_celsius: number; rain_probability: number; is_affecting_traffic: boolean; weather_impact_score: number };
  alerts: { total_active: number; critical_count: number };
  predictions: { next_hour_trend: string; rush_hour_active: boolean; estimated_avg_travel_time_minutes: number; confidence_score: number };
  generated_at: string;
}

interface TrafficRoadBasic {
  id: number;
  name: string;
}

interface DailyComparison {
  current_avg_speed: number;
  historical_avg_speed: number;
  speed_difference: number;
  percentage_change: number;
  current_congestion_level: string;
  historical_congestion_level: string;
}

const TREND_ICON = { improving: TrendingUp, stable: Minus, worsening: TrendingDown }
const TREND_COLOR = { improving: 'text-green-600', stable: 'text-muted-foreground', worsening: 'text-red-600' }
const CONGESTION_COLOR: Record<string, string> = { low: '#22c55e', moderate: '#eab308', high: '#f97316', severe: '#ef4444' }

async function parseJsonIfAvailable(response: Response): Promise<{ data?: unknown } | null> {
  if (!response.ok) return null;
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return null;
  return (await response.json()) as { data?: unknown };
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
      <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

export default function AnalyticsDashboard() {
  const [hourlyPattern, setHourlyPattern] = useState<HourlyPattern[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [weatherImpact, setWeatherImpact] = useState<WeatherImpact[]>([]);
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Comparative state
  const [roads, setRoads] = useState<TrafficRoadBasic[]>([]);
  const [compareRoadA, setCompareRoadA] = useState<number | null>(null);
  const [compareRoadB, setCompareRoadB] = useState<number | null>(null);
  const [comparisonA, setComparisonA] = useState<DailyComparison | null>(null);
  const [comparisonB, setComparisonB] = useState<DailyComparison | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [dropdownA, setDropdownA] = useState(false);
  const [dropdownB, setDropdownB] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);

      const [hourlyRes, hotspotsRes, weatherRes, summaryRes] = await Promise.all([
        fetch(`${API_BASE}/analytics/hourly-pattern`),
        fetch(`${API_BASE}/analytics/hotspots?limit=5`),
        fetch(`${API_BASE}/analytics/weather-impact?days=7`),
        fetch(`${API_BASE}/insights/summary`).catch(() => null),
      ]);

      const [hourlyData, hotspotsData, weatherData] = await Promise.all([
        parseJsonIfAvailable(hourlyRes),
        parseJsonIfAvailable(hotspotsRes),
        parseJsonIfAvailable(weatherRes),
      ]);

      setHourlyPattern((hourlyData?.data as HourlyPattern[]) || []);
      setHotspots((hotspotsData?.data as Hotspot[]) || []);
      setWeatherImpact((weatherData?.data as WeatherImpact[]) || []);

      if (summaryRes?.ok) {
        const summaryData = await parseJsonIfAvailable(summaryRes);
        setSummary((summaryData?.data as ExecutiveSummary | undefined) ?? null);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch roads list for comparative
  useEffect(() => {
    async function loadRoads() {
      try {
        const res = await fetch(`${API_BASE}/traffic/realtime`);
        if (res.ok) {
          const json = await parseJsonIfAvailable(res);
          const rows = Array.isArray(json?.data) ? (json.data as Array<{ id: number; name: string }>) : [];
          const list = rows.map((r) => ({ id: r.id, name: r.name }));
          setRoads(list);
        }
      } catch { /* ignore */ }
    }
    loadRoads();
  }, []);

  const fetchComparison = useCallback(async () => {
    if (!compareRoadA && !compareRoadB) return;
    setCompareLoading(true);
    const [resA, resB] = await Promise.all([
      compareRoadA ? fetch(`${API_BASE}/analytics/compare/${compareRoadA}`).then(r => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null),
      compareRoadB ? fetch(`${API_BASE}/analytics/compare/${compareRoadB}`).then(r => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null),
    ]);
    setComparisonA(resA?.data ?? null);
    setComparisonB(resB?.data ?? null);
    setCompareLoading(false);
  }, [compareRoadA, compareRoadB]);

  useEffect(() => {
    fetchComparison();
  }, [fetchComparison]);

  useEffect(() => {
    fetchAnalytics();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchAnalytics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 pt-20">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h2>
        <button
          onClick={fetchAnalytics}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          Actualizar
        </button>
      </div>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="summary">
            <LayoutDashboard className="w-4 h-4 mr-2" />
            Resumen
          </TabsTrigger>
          <TabsTrigger value="patterns">
            <Activity className="w-4 h-4 mr-2" />
            Patrones
          </TabsTrigger>
          <TabsTrigger value="hotspots">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Hotspots
          </TabsTrigger>
          <TabsTrigger value="weather">
            <Cloud className="w-4 h-4 mr-2" />
            Clima
          </TabsTrigger>
          <TabsTrigger value="compare">
            <GitCompareArrows className="w-4 h-4 mr-2" />
            Comparar
          </TabsTrigger>
        </TabsList>

        {/* Executive Summary */}
        <TabsContent value="summary" className="space-y-4">
          {summary ? (
            <>
              <DepartureAdviceCard />

              {/* System KPIs */}
              <Card>
                <CardHeader>
                  <CardTitle>Estado General del Sistema</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Velocidad promedio" value={`${summary.system.avg_speed_kmh} km/h`} />
                    <StatCard label="Congestión general" value={summary.system.overall_congestion_level} sub="nivel actual" />
                    <StatCard label="Vías activas" value={summary.system.total_active_roads} />
                    <StatCard label="Zonas monitoreadas" value={summary.system.monitored_zones} />
                  </div>
                </CardContent>
              </Card>

              {/* Traffic vs Historical */}
              <Card>
                <CardHeader>
                  <CardTitle>Tráfico Actual vs Histórico</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <StatCard label="Velocidad actual" value={`${summary.traffic.current_avg_speed} km/h`} />
                    <StatCard label="Velocidad histórica" value={`${summary.traffic.historical_avg_speed} km/h`} />
                    <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                      <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Cambio</p>
                      <div className="flex items-center gap-1">
                        {(() => {
                          const pct = summary.traffic.speed_change_percentage
                          const trend = pct > 2 ? 'improving' : pct < -2 ? 'worsening' : 'stable'
                          const Icon = TREND_ICON[trend]
                          return (
                            <>
                              <Icon className={`h-5 w-5 ${TREND_COLOR[trend]}`} />
                              <span className={`text-2xl font-bold ${TREND_COLOR[trend]}`}>
                                {pct > 0 ? '+' : ''}{pct}%
                              </span>
                            </>
                          )
                        })()}
                      </div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                      <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Próxima hora</p>
                      <div className="flex items-center gap-1">
                        {(() => {
                          const trend = summary.predictions.next_hour_trend as 'improving' | 'stable' | 'worsening'
                          const Icon = TREND_ICON[trend] ?? Minus
                          return <Icon className={`h-5 w-5 ${TREND_COLOR[trend] ?? ''}`} />
                        })()}
                        <span className="text-sm font-semibold capitalize">{summary.predictions.next_hour_trend}</span>
                      </div>
                      {summary.predictions.rush_hour_active && (
                        <p className="text-[10px] text-amber-600 font-bold mt-1">⚡ Rush hour</p>
                      )}
                    </div>
                  </div>

                  {/* Congestion breakdown bar */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Distribución de Congestión</p>
                    <div className="flex h-6 rounded-full overflow-hidden gap-0.5">
                      {Object.entries(summary.traffic.congestion_breakdown).map(([level, count]) => {
                        const total = Object.values(summary.traffic.congestion_breakdown).reduce((a, b) => a + b, 0)
                        const pct = total > 0 ? (count / total) * 100 : 0
                        return pct > 0 ? (
                          <div
                            key={level}
                            style={{ width: `${pct}%`, backgroundColor: CONGESTION_COLOR[level] }}
                            title={`${level}: ${count} roads (${Math.round(pct)}%)`}
                            className="transition-all"
                          />
                        ) : null
                      })}
                    </div>
                    <div className="flex gap-4 mt-2">
                      {Object.entries(summary.traffic.congestion_breakdown).map(([level, count]) => (
                        <div key={level} className="flex items-center gap-1">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: CONGESTION_COLOR[level] }} />
                          <span className="text-[10px] text-muted-foreground capitalize">{level}: {count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Weather + Alerts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle>Condiciones Climáticas</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between"><span className="text-muted-foreground text-sm">Condición</span><span className="font-semibold">{summary.weather.current_condition}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground text-sm">Temperatura</span><span className="font-semibold">{summary.weather.temperature_celsius}°C</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground text-sm">Prob. lluvia</span><span className="font-semibold">{summary.weather.rain_probability}%</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground text-sm">Impacto en tráfico</span>
                        <span className={`font-semibold ${summary.weather.is_affecting_traffic ? 'text-amber-600' : 'text-green-600'}`}>
                          {summary.weather.is_affecting_traffic ? 'Sí' : 'No'}
                        </span>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1"><span className="text-muted-foreground text-sm">Score impacto</span><span className="font-semibold">{summary.weather.weather_impact_score}/100</span></div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${summary.weather.weather_impact_score}%` }} />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Alertas & Predicciones</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between"><span className="text-muted-foreground text-sm">Alertas activas</span><span className="font-semibold">{summary.alerts.total_active}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground text-sm">Alertas críticas</span>
                        <span className={`font-semibold ${summary.alerts.critical_count > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {summary.alerts.critical_count}
                        </span>
                      </div>
                      <div className="flex justify-between"><span className="text-muted-foreground text-sm">Rush hour activo</span>
                        <span className={`font-semibold ${summary.predictions.rush_hour_active ? 'text-amber-600' : 'text-green-600'}`}>
                          {summary.predictions.rush_hour_active ? 'Sí' : 'No'}
                        </span>
                      </div>
                      <div className="flex justify-between"><span className="text-muted-foreground text-sm">Tiempo viaje estimado</span><span className="font-semibold">{summary.predictions.estimated_avg_travel_time_minutes} min</span></div>
                      <div>
                        <div className="flex justify-between mb-1"><span className="text-muted-foreground text-sm">Confianza</span><span className="font-semibold">{summary.predictions.confidence_score}%</span></div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${summary.predictions.confidence_score}%` }} />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <LayoutDashboard className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">Resumen ejecutivo no disponible. Verifica que el servicio esté corriendo.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Hourly Patterns */}
        <TabsContent value="patterns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Patrón de Tráfico por Hora (Hoy)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={hourlyPattern}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="hour"
                    label={{ value: 'Hora del día', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis
                    label={{ value: 'Velocidad (km/h)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="avg_speed"
                    stroke="#8884d8"
                    strokeWidth={2}
                    name="Velocidad Promedio"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Volumen de Tráfico por Hora</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={hourlyPattern}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="traffic_volume" fill="#82ca9d" name="Volumen" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hotspots */}
        <TabsContent value="hotspots" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top 5 Zonas Críticas de Tráfico</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {hotspots.map((hotspot, index) => (
                  <div
                    key={hotspot.road_id}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <h4 className="font-semibold">{hotspot.road_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {hotspot.congestion_frequency}% congestión
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{hotspot.avg_speed} km/h</p>
                      <p className="text-sm text-muted-foreground">
                        {hotspot.total_incidents} incidentes
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Frecuencia de Congestión</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={hotspots} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="road_name" type="category" width={100} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="congestion_frequency" fill="#ef4444" name="% Congestión" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Weather Impact */}
        <TabsContent value="weather" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Impacto del Clima en el Tráfico</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {weatherImpact.map((impact) => (
                  <div
                    key={impact.is_raining ? 'rain' : 'clear'}
                    className="p-6 rounded-lg border-2"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <Cloud
                        className={`h-8 w-8 ${impact.is_raining ? 'text-blue-500' : 'text-yellow-500'}`}
                      />
                      <h3 className="text-lg font-semibold">
                        {impact.is_raining ? 'Con Lluvia' : 'Sin Lluvia'}
                      </h3>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Velocidad promedio:</span>
                        <span className="font-semibold">{impact.avg_speed} km/h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tiempo de viaje:</span>
                        <span className="font-semibold">{impact.avg_travel_time} min</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Congestión típica:</span>
                        <span className="font-semibold capitalize">
                          {impact.typical_congestion}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Muestras:</span>
                        <span className="font-semibold">{impact.sample_count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={weatherImpact}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="is_raining"
                      tickFormatter={(value) => (value ? 'Con Lluvia' : 'Sin Lluvia')}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="avg_speed" fill="#3b82f6" name="Velocidad Promedio (km/h)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comparative Side-by-Side */}
        <TabsContent value="compare" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitCompareArrows className="h-5 w-5 text-primary" />
                Comparar Zonas — Actual vs Historico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Selecciona dos vias para comparar su trafico actual contra el promedio historico (misma hora y dia de la semana).
              </p>

              {/* Road Selectors */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* Road A Selector */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Via A</label>
                  <div className="relative">
                    <button
                      onClick={() => { setDropdownA(!dropdownA); setDropdownB(false); }}
                      className="flex items-center gap-2 px-3 py-2 bg-background border rounded-lg hover:bg-accent transition-colors w-full justify-between text-sm"
                    >
                      <span className="truncate">{roads.find(r => r.id === compareRoadA)?.name || 'Seleccionar via...'}</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </button>
                    {dropdownA && (
                      <div className="absolute left-0 top-full mt-1 w-full max-h-48 overflow-y-auto bg-background border rounded-lg shadow-xl z-50">
                        {roads.map(road => (
                          <button
                            key={road.id}
                            onClick={() => { setCompareRoadA(road.id); setDropdownA(false); }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-accent ${road.id === compareRoadA ? 'bg-primary/10 text-primary font-medium' : ''}`}
                          >
                            {road.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Road B Selector */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Via B</label>
                  <div className="relative">
                    <button
                      onClick={() => { setDropdownB(!dropdownB); setDropdownA(false); }}
                      className="flex items-center gap-2 px-3 py-2 bg-background border rounded-lg hover:bg-accent transition-colors w-full justify-between text-sm"
                    >
                      <span className="truncate">{roads.find(r => r.id === compareRoadB)?.name || 'Seleccionar via...'}</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </button>
                    {dropdownB && (
                      <div className="absolute left-0 top-full mt-1 w-full max-h-48 overflow-y-auto bg-background border rounded-lg shadow-xl z-50">
                        {roads.map(road => (
                          <button
                            key={road.id}
                            onClick={() => { setCompareRoadB(road.id); setDropdownB(false); }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-accent ${road.id === compareRoadB ? 'bg-primary/10 text-primary font-medium' : ''}`}
                          >
                            {road.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {compareLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : (comparisonA || comparisonB) ? (
                <>
                  {/* Side-by-Side Comparison Cards */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {[
                      { label: roads.find(r => r.id === compareRoadA)?.name || 'Via A', data: comparisonA, color: '#8884d8' },
                      { label: roads.find(r => r.id === compareRoadB)?.name || 'Via B', data: comparisonB, color: '#82ca9d' },
                    ].map(({ label, data, color }) => (
                      <Card key={label} className="overflow-hidden">
                        <div className="h-1" style={{ backgroundColor: color }} />
                        <CardContent className="p-4 space-y-3">
                          <p className="text-sm font-bold">{label}</p>
                          {data ? (
                            <>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="p-2 rounded bg-muted/50">
                                  <p className="text-[10px] text-muted-foreground uppercase">Actual</p>
                                  <p className="text-lg font-bold">{data.current_avg_speed} km/h</p>
                                  <p className="text-xs capitalize text-muted-foreground">{data.current_congestion_level}</p>
                                </div>
                                <div className="p-2 rounded bg-muted/50">
                                  <p className="text-[10px] text-muted-foreground uppercase">Historico</p>
                                  <p className="text-lg font-bold">{data.historical_avg_speed} km/h</p>
                                  <p className="text-xs capitalize text-muted-foreground">{data.historical_congestion_level}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {(() => {
                                  const pct = data.percentage_change;
                                  const trend = pct > 2 ? 'improving' : pct < -2 ? 'worsening' : 'stable';
                                  const Icon = TREND_ICON[trend];
                                  return (
                                    <>
                                      <Icon className={`h-4 w-4 ${TREND_COLOR[trend]}`} />
                                      <span className={`text-sm font-bold ${TREND_COLOR[trend]}`}>
                                        {pct > 0 ? '+' : ''}{pct}%
                                      </span>
                                      <span className="text-xs text-muted-foreground">vs historico</span>
                                    </>
                                  );
                                })()}
                              </div>
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground py-4 text-center">Selecciona una via</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Overlay Bar Chart */}
                  {comparisonA && comparisonB && (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={[
                          {
                            metric: 'Vel. Actual',
                            [roads.find(r => r.id === compareRoadA)?.name || 'Via A']: comparisonA.current_avg_speed,
                            [roads.find(r => r.id === compareRoadB)?.name || 'Via B']: comparisonB.current_avg_speed,
                          },
                          {
                            metric: 'Vel. Historica',
                            [roads.find(r => r.id === compareRoadA)?.name || 'Via A']: comparisonA.historical_avg_speed,
                            [roads.find(r => r.id === compareRoadB)?.name || 'Via B']: comparisonB.historical_avg_speed,
                          },
                          {
                            metric: 'Diferencia',
                            [roads.find(r => r.id === compareRoadA)?.name || 'Via A']: Math.abs(comparisonA.speed_difference),
                            [roads.find(r => r.id === compareRoadB)?.name || 'Via B']: Math.abs(comparisonB.speed_difference),
                          },
                        ]}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="metric" />
                        <YAxis label={{ value: 'km/h', angle: -90, position: 'insideLeft' }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey={roads.find(r => r.id === compareRoadA)?.name || 'Via A'} fill="#8884d8" radius={[4, 4, 0, 0]} />
                        <Bar dataKey={roads.find(r => r.id === compareRoadB)?.name || 'Via B'} fill="#82ca9d" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <GitCompareArrows className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground">
                    Selecciona dos vias arriba para ver la comparacion lado a lado.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
