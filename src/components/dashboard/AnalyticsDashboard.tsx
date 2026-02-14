"use client";

import React, { useEffect, useState } from 'react';
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
import { Activity, Cloud, AlertTriangle } from 'lucide-react';

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

export default function AnalyticsDashboard() {
  const [hourlyPattern, setHourlyPattern] = useState<HourlyPattern[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [weatherImpact, setWeatherImpact] = useState<WeatherImpact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      const [hourlyRes, hotspotsRes, weatherRes] = await Promise.all([
        fetch(`${API_BASE}/analytics/hourly-pattern`),
        fetch(`${API_BASE}/analytics/hotspots?limit=5`),
        fetch(`${API_BASE}/analytics/weather-impact?days=7`),
      ]);

      const hourlyData = await hourlyRes.json();
      const hotspotsData = await hotspotsRes.json();
      const weatherData = await weatherRes.json();

      setHourlyPattern(hourlyData.data || []);
      setHotspots(hotspotsData.data || []);
      setWeatherImpact(weatherData.data || []);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

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

      <Tabs defaultValue="patterns" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
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
            Impacto Clima
          </TabsTrigger>
        </TabsList>

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
      </Tabs>
    </div>
  );
}
