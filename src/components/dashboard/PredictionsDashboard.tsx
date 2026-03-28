"use client";

import { useEffect, useState } from 'react';
import {
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  Cell,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Brain,
  Clock,
  Droplets,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';
import { usePredictions } from '@/hooks/usePredictions';
import type { TrafficRoad } from '@/hooks/useTrafficData';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const RISK_COLORS: Record<string, string> = {
  none: '#22c55e',
  low: '#84cc16',
  medium: '#eab308',
  high: '#f97316',
  critical: '#ef4444',
};

const CONGESTION_COLORS: Record<string, string> = {
  free: '#22c55e',
  light: '#84cc16',
  moderate: '#eab308',
  heavy: '#f97316',
  severe: '#ef4444',
};

const HORIZON_LABELS: Record<number, string> = {
  15: '15 min',
  30: '30 min',
  60: '1 hora',
  120: '2 horas',
};

function formatFeatureName(name: string): string {
  const map: Record<string, string> = {
    hour_of_day: 'Hora del dia',
    day_of_week: 'Dia de la semana',
    is_raining: 'Lluvia',
    rain_probability: 'Prob. lluvia',
    temperature: 'Temperatura',
    humidity: 'Humedad',
    wind_speed: 'Viento',
    event_nearby: 'Evento cercano',
    arroyo_nearby: 'Arroyo cercano',
    historical_speed: 'Velocidad historica',
    congestion_lag_1h: 'Congestion hace 1h',
    speed_kmh: 'Velocidad actual',
  };
  return map[name] || name.replace(/_/g, ' ');
}

export default function PredictionsDashboard() {
  const {
    timeline,
    explanation,
    arroyoRisk,
    isLoading,
    error,
    fetchAll,
    fetchArroyoRisk,
  } = usePredictions();

  const [roads, setRoads] = useState<TrafficRoad[]>([]);
  const [selectedRoad, setSelectedRoad] = useState<number | null>(null);
  const [roadsLoading, setRoadsLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [roadsError, setRoadsError] = useState<string | null>(null);

  // Fetch roads list
  useEffect(() => {
    async function loadRoads() {
      try {
        setRoadsError(null);
        const res = await fetch(`${API_BASE}/traffic/realtime`);
        if (!res.ok) {
          throw new Error(`No fue posible cargar vías (${res.status}).`);
        }

        const contentType = res.headers.get('content-type') ?? '';
        if (!contentType.includes('application/json')) {
          throw new Error('La respuesta de vías no llegó en formato JSON.');
        }

        const json = await res.json();
        const roadList = (json.data || []) as TrafficRoad[];
        const dedupedRoads = Array.from(
          new Map(
            roadList
              .filter((road) => Number.isFinite(road.id) && typeof road.name === 'string' && road.name.length > 0)
              .map((road) => [road.id, road])
          ).values()
        );
        setRoads(dedupedRoads);
        setSelectedRoad((prev) => prev ?? dedupedRoads[0]?.id ?? null);
        if (dedupedRoads.length === 0) {
          setRoadsError('No hay vías disponibles para generar predicciones.');
        }
      } catch (error) {
        setRoads([]);
        setSelectedRoad(null);
        setRoadsError(error instanceof Error ? error.message : 'No fue posible cargar vías.');
      } finally {
        setRoadsLoading(false);
      }
    }
    loadRoads();
  }, []);

  // Fetch predictions when road changes
  useEffect(() => {
    if (selectedRoad) {
      fetchAll(selectedRoad);
    }
  }, [selectedRoad, fetchAll]);

  // Fetch arroyo risk on mount
  useEffect(() => {
    fetchArroyoRisk();
  }, [fetchArroyoRisk]);

  const selectedRoadName = roads.find(r => r.id === selectedRoad)?.name || '';

  // Prepare timeline chart data
  const timelineData = timeline.map(t => ({
    horizon: HORIZON_LABELS[t.horizon_minutes] || `${t.horizon_minutes}m`,
    speed: t.prediction.predicted_speed_kmh,
    lower: t.prediction.predicted_speed_lower,
    upper: t.prediction.predicted_speed_upper,
    congestion: t.prediction.predicted_congestion_level,
    confidence: t.prediction.confidence_score,
  }));

  // Prepare SHAP chart data (sorted by absolute value)
  const shapData = (explanation?.top_features || [])
    .map(f => ({
      name: formatFeatureName(f.feature_name),
      value: Math.round(f.shap_value * 100) / 100,
      contribution: f.contribution,
      absValue: Math.abs(f.shap_value),
    }))
    .sort((a, b) => b.absValue - a.absValue);

  // Prepare arroyo risk data
  const arroyoData = (arroyoRisk?.arroyos || [])
    .sort((a, b) => b.activation_probability - a.activation_probability);

  if (roadsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!selectedRoad) {
    return (
      <div className="space-y-6 p-6 pt-20">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Predicciones ML</h2>
          <p className="mt-1 text-muted-foreground">Predicciones de trafico con Machine Learning</p>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <Brain className="mx-auto mb-3 h-12 w-12 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">
              {roadsError ?? 'No hay vías cargadas para mostrar predicciones.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 pt-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Predicciones ML</h2>
          <p className="text-muted-foreground mt-1">
            Predicciones de trafico con Machine Learning
          </p>
        </div>

        {/* Road Selector */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-4 py-2 bg-background border rounded-lg hover:bg-accent transition-colors min-w-[200px] justify-between"
          >
            <span className="text-sm font-medium truncate">
              {selectedRoadName || 'Seleccionar via'}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 w-64 max-h-64 overflow-y-auto bg-background border rounded-lg shadow-xl z-50">
              {roads.map((road) => (
                <button
                  key={road.id}
                  onClick={() => {
                    setSelectedRoad(road.id);
                    setDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors ${
                    road.id === selectedRoad ? 'bg-primary/10 text-primary font-medium' : ''
                  }`}
                >
                  {road.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
          {error}
        </div>
      )}

      {roadsError && !error && (
        <div className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          {roadsError}
        </div>
      )}

      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="timeline">
            <Clock className="w-4 h-4 mr-2" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="shap">
            <Brain className="w-4 h-4 mr-2" />
            Factores SHAP
          </TabsTrigger>
          <TabsTrigger value="arroyo">
            <Droplets className="w-4 h-4 mr-2" />
            Riesgo Arroyos
          </TabsTrigger>
        </TabsList>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="p-8 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </CardContent>
            </Card>
          ) : timelineData.length > 0 ? (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {timeline.map(t => (
                  <Card key={t.horizon_minutes} className="overflow-hidden">
                    <div
                      className="h-1"
                      style={{
                        backgroundColor: CONGESTION_COLORS[t.prediction.predicted_congestion_level] || '#6b7280',
                      }}
                    />
                    <CardContent className="p-4">
                      <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                        {HORIZON_LABELS[t.horizon_minutes]}
                      </p>
                      <p className="text-2xl font-bold">{t.prediction.predicted_speed_kmh} km/h</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className="text-xs font-semibold capitalize px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${CONGESTION_COLORS[t.prediction.predicted_congestion_level]}20`,
                            color: CONGESTION_COLORS[t.prediction.predicted_congestion_level],
                          }}
                        >
                          {t.prediction.predicted_congestion_level}
                        </span>
                        {t.prediction.confidence_score != null && (
                          <span className="text-[10px] text-muted-foreground">
                            {t.prediction.confidence_score}% conf.
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Timeline Chart with confidence bands */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Prediccion de Velocidad — {selectedRoadName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={timelineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="horizon" />
                      <YAxis
                        label={{ value: 'km/h', angle: -90, position: 'insideLeft' }}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value, name) => {
                          const label =
                            name === 'speed' ? 'Velocidad' :
                            name === 'upper' ? 'Limite superior' :
                            name === 'lower' ? 'Limite inferior' : String(name);
                          return [`${value} km/h`, label];
                        }}
                      />
                      <Legend
                        formatter={(value: string) =>
                          value === 'speed' ? 'Velocidad predicha' :
                          value === 'upper' ? 'Limite superior' :
                          value === 'lower' ? 'Limite inferior' : value
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="upper"
                        stroke="none"
                        fill="hsl(var(--primary))"
                        fillOpacity={0.1}
                      />
                      <Area
                        type="monotone"
                        dataKey="lower"
                        stroke="none"
                        fill="hsl(var(--background))"
                        fillOpacity={1}
                      />
                      <Line
                        type="monotone"
                        dataKey="speed"
                        stroke="hsl(var(--primary))"
                        strokeWidth={3}
                        dot={{ fill: 'hsl(var(--primary))', r: 5 }}
                        activeDot={{ r: 7 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">
                  No hay datos de timeline disponibles. Verifica que el servicio ML este corriendo.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* SHAP Explanation Tab */}
        <TabsContent value="shap" className="space-y-4">
          {explanation ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-500" />
                    Factores que Afectan la Congestion — {selectedRoadName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Valores SHAP: barras verdes reducen la congestion, rojas la aumentan.
                    Modelo: <span className="font-mono text-xs">{explanation.model_version}</span>
                  </p>
                  <ResponsiveContainer width="100%" height={Math.max(shapData.length * 45, 200)}>
                    <BarChart data={shapData} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        type="number"
                        label={{ value: 'Impacto SHAP', position: 'insideBottom', offset: -5 }}
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={140}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value) => {
                          const v = Number(value);
                          return [`${v > 0 ? '+' : ''}${v}`, 'Impacto SHAP'] as [string, string];
                        }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {shapData.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={
                              entry.contribution === 'positive' ? '#22c55e' :
                              entry.contribution === 'negative' ? '#ef4444' : '#6b7280'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Feature Impact Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {shapData.slice(0, 6).map((feature) => (
                  <Card key={feature.name} className="overflow-hidden">
                    <div
                      className="h-1"
                      style={{
                        backgroundColor:
                          feature.contribution === 'positive' ? '#22c55e' :
                          feature.contribution === 'negative' ? '#ef4444' : '#6b7280',
                      }}
                    />
                    <CardContent className="p-4">
                      <p className="text-sm font-semibold">{feature.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`text-lg font-bold ${
                            feature.contribution === 'positive' ? 'text-green-600' :
                            feature.contribution === 'negative' ? 'text-red-600' : 'text-muted-foreground'
                          }`}
                        >
                          {feature.value > 0 ? '+' : ''}{feature.value}
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase">
                          {feature.contribution === 'positive' ? 'Reduce congestion' :
                           feature.contribution === 'negative' ? 'Aumenta congestion' : 'Neutral'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">
                  {isLoading ? 'Cargando explicacion SHAP...' : 'Selecciona una via para ver los factores SHAP.'}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Arroyo Risk Tab */}
        <TabsContent value="arroyo" className="space-y-4">
          {arroyoData.length > 0 ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Droplets className="h-5 w-5 text-blue-500" />
                    Mapa de Riesgo de Arroyos por Zona
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Probabilidad de activacion de arroyos basada en pronostico meteorologico actual.
                  </p>

                  {/* Risk Heatmap Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                    {arroyoData.map(arroyo => {
                      const pct = Math.round(arroyo.activation_probability * 100);
                      const color = RISK_COLORS[arroyo.risk_level] || '#6b7280';
                      return (
                        <div
                          key={arroyo.arroyo_id}
                          className="relative rounded-xl border p-4 transition-all hover:shadow-lg hover:scale-[1.02]"
                          style={{
                            background: `linear-gradient(135deg, ${color}10, ${color}25)`,
                            borderColor: `${color}40`,
                          }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Droplets className="h-4 w-4" style={{ color }} />
                            <span className="text-xs font-bold uppercase tracking-wider" style={{ color }}>
                              {arroyo.risk_level}
                            </span>
                          </div>
                          <p className="text-sm font-semibold truncate">{arroyo.zone_name}</p>
                          <div className="mt-2">
                            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                              <span>Probabilidad</span>
                              <span className="font-bold" style={{ color }}>{pct}%</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${pct}%`, backgroundColor: color }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Risk Bar Chart */}
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={arroyoData.map(a => ({
                        name: a.zone_name.length > 15 ? a.zone_name.slice(0, 15) + '...' : a.zone_name,
                        probability: Math.round(a.activation_probability * 100),
                        risk_level: a.risk_level,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                      <YAxis
                        label={{ value: 'Probabilidad %', angle: -90, position: 'insideLeft' }}
                        domain={[0, 100]}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="probability" name="Probabilidad de activacion" radius={[4, 4, 0, 0]}>
                        {arroyoData.map((entry, index) => (
                          <Cell key={index} fill={RISK_COLORS[entry.risk_level] || '#6b7280'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Weather Summary */}
              {arroyoRisk?.weather_summary && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      Condiciones Meteorologicas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Object.entries(arroyoRisk.weather_summary).map(([key, value]) => (
                        <div key={key} className="p-3 rounded-lg bg-muted/50 border border-border/50">
                          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                            {key.replace(/_/g, ' ')}
                          </p>
                          <p className="text-lg font-bold">{String(value)}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Droplets className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">
                  {isLoading ? 'Cargando riesgo de arroyos...' : 'No hay datos de riesgo de arroyos disponibles.'}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
