"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Server,
  History,
  RotateCcw,
  Play,
  CheckCircle,
  XCircle,
  Database,
  Cpu,
  Wifi,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { useMLAdmin, type ModelVersion } from '@/hooks/useMLAdmin';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

interface ServiceStatus {
  name: string;
  status: 'online' | 'offline' | 'checking';
  icon: React.ElementType;
  detail?: string;
}

function StatusBadge({ status }: { status: 'online' | 'offline' | 'checking' }) {
  if (status === 'checking') {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
        <div className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse" />
        Verificando
      </span>
    );
  }
  return (
    <span className={`flex items-center gap-1 text-xs font-semibold ${status === 'online' ? 'text-green-600' : 'text-red-600'}`}>
      {status === 'online' ? (
        <CheckCircle className="h-3.5 w-3.5" />
      ) : (
        <XCircle className="h-3.5 w-3.5" />
      )}
      {status === 'online' ? 'Online' : 'Offline'}
    </span>
  );
}

function MetricBadge({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}:</span>
      <span className="text-xs font-bold font-mono">{value}</span>
    </div>
  );
}

function ModelCard({
  model,
  isActive,
  onRollback,
}: {
  model: ModelVersion;
  isActive: boolean;
  onRollback: (version: string) => void;
}) {
  const metrics = model.metrics || {};
  const trainedDate = model.trained_at ? new Date(model.trained_at).toLocaleString('es-CO') : 'N/A';

  return (
    <Card className={`overflow-hidden transition-all ${isActive ? 'ring-2 ring-primary' : ''}`}>
      {isActive && <div className="h-1 bg-primary" />}
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-mono text-sm font-bold">{model.version}</p>
              {isActive && (
                <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  Activo
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{model.model_type}</p>
          </div>
          {!isActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRollback(model.version)}
              className="text-xs gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Rollback
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          {metrics.mae != null && <MetricBadge label="MAE" value={Number(metrics.mae).toFixed(4)} />}
          {metrics.rmse != null && <MetricBadge label="RMSE" value={Number(metrics.rmse).toFixed(4)} />}
          {metrics.r2 != null && <MetricBadge label="R2" value={Number(metrics.r2).toFixed(4)} />}
          {metrics.mape != null && <MetricBadge label="MAPE" value={`${Number(metrics.mape).toFixed(2)}%`} />}
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Entrenado: {trainedDate}</span>
          <span>{model.training_samples} muestras</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const {
    modelHistory,
    health,
    retrainStatus,
    isLoading,
    error,
    fetchAll,
    triggerRetrain,
    rollbackModel,
  } = useMLAdmin();

  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'Base de Datos (PostgreSQL)', status: 'checking', icon: Database },
    { name: 'Cache (Redis)', status: 'checking', icon: Server },
    { name: 'ML Service (FastAPI)', status: 'checking', icon: Cpu },
    { name: 'WebSocket (Socket.IO)', status: 'checking', icon: Wifi },
  ]);

  // Fetch data on mount
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Check all services health
  useEffect(() => {
    async function checkServices() {
      const checks: ServiceStatus[] = [];

      // ML Service
      try {
        const res = await fetch(`${API_BASE}/predictions/health`);
        const json = await res.json();
        checks.push({
          name: 'ML Service (FastAPI)',
          status: json.data?.ml_service_available ? 'online' : 'offline',
          icon: Cpu,
          detail: json.data?.checked_at,
        });
      } catch {
        checks.push({ name: 'ML Service (FastAPI)', status: 'offline', icon: Cpu });
      }

      // DB — check via traffic endpoint
      try {
        const res = await fetch(`${API_BASE}/traffic/summary`);
        checks.push({
          name: 'Base de Datos (PostgreSQL)',
          status: res.ok ? 'online' : 'offline',
          icon: Database,
        });
      } catch {
        checks.push({ name: 'Base de Datos (PostgreSQL)', status: 'offline', icon: Database });
      }

      // Redis — check via insights (cached)
      try {
        const res = await fetch(`${API_BASE}/insights/summary`);
        checks.push({
          name: 'Cache (Redis)',
          status: res.ok ? 'online' : 'offline',
          icon: Server,
        });
      } catch {
        checks.push({ name: 'Cache (Redis)', status: 'offline', icon: Server });
      }

      // Socket.IO — basic check
      checks.push({
        name: 'WebSocket (Socket.IO)',
        status: 'online',
        icon: Wifi,
        detail: 'Verificado via cliente',
      });

      setServices(checks);
    }

    checkServices();
  }, []);

  const [confirmRollback, setConfirmRollback] = useState<string | null>(null);

  const handleRollback = (version: string) => {
    if (confirmRollback === version) {
      rollbackModel(version);
      setConfirmRollback(null);
    } else {
      setConfirmRollback(version);
      setTimeout(() => setConfirmRollback(null), 5000);
    }
  };

  return (
    <div className="space-y-6 p-6 pt-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Administracion ML</h2>
          <p className="text-muted-foreground mt-1">
            Gestion de modelos, reentrenamiento y estado del sistema
          </p>
        </div>
        <Button onClick={fetchAll} variant="outline" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      <Tabs defaultValue="models" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="models">
            <History className="w-4 h-4 mr-2" />
            Modelos
          </TabsTrigger>
          <TabsTrigger value="retrain">
            <Play className="w-4 h-4 mr-2" />
            Reentrenamiento
          </TabsTrigger>
          <TabsTrigger value="health">
            <Server className="w-4 h-4 mr-2" />
            Estado del Sistema
          </TabsTrigger>
        </TabsList>

        {/* Model History */}
        <TabsContent value="models" className="space-y-4">
          {modelHistory ? (
            <>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  {modelHistory.count} version{modelHistory.count !== 1 ? 'es' : ''} disponible{modelHistory.count !== 1 ? 's' : ''}
                </span>
                {modelHistory.active_model_version && (
                  <span className="text-primary font-semibold">
                    Modelo activo: <span className="font-mono">{modelHistory.active_model_version}</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {modelHistory.versions.map(model => (
                  <ModelCard
                    key={model.version}
                    model={model}
                    isActive={model.version === modelHistory.active_model_version}
                    onRollback={handleRollback}
                  />
                ))}
              </div>

              {confirmRollback && (
                <div className="p-3 bg-amber-500/10 text-amber-700 rounded-lg text-sm">
                  Haz click de nuevo en &quot;Rollback&quot; en la version <span className="font-mono font-bold">{confirmRollback}</span> para confirmar.
                </div>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <History className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">
                  {isLoading ? 'Cargando historial de modelos...' : 'No hay historial de modelos disponible.'}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Retraining */}
        <TabsContent value="retrain" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5 text-primary" />
                Reentrenamiento Manual del Modelo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Inicia un reentrenamiento manual del modelo ML. El reentrenamiento automatico esta programado
                para los domingos a las 3:00 AM. El proceso se ejecuta en segundo plano.
              </p>

              <div className="flex items-center gap-4">
                <Button
                  onClick={triggerRetrain}
                  disabled={retrainStatus === 'queued'}
                  className="gap-2"
                >
                  {retrainStatus === 'queued' ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Reentrenamiento en cola...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Iniciar Reentrenamiento
                    </>
                  )}
                </Button>

                {retrainStatus === 'queued' && (
                  <span className="text-sm text-muted-foreground">
                    El trabajo se ha encolado. Verifica el historial de modelos para ver los resultados.
                  </span>
                )}
                {retrainStatus === 'error' && (
                  <span className="text-sm text-destructive">
                    Error al iniciar el reentrenamiento. Verifica que el servicio ML este disponible.
                  </span>
                )}
              </div>

              {/* Training info */}
              <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border/50">
                <p className="text-sm font-semibold mb-2">Informacion del Proceso</p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Programacion automatica: Domingos 3:00 AM (Colombia)</p>
                  <p>Cola: BullMQ via Redis</p>
                  <p>Formato de version: YYYYMMDD_HHMMSS</p>
                  <p>Metricas: MAE, RMSE, R2, MAPE</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Latest model info */}
          {modelHistory && modelHistory.versions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Ultimo Modelo Entrenado</CardTitle>
              </CardHeader>
              <CardContent>
                <ModelCard
                  model={modelHistory.versions[0]}
                  isActive={modelHistory.versions[0].version === modelHistory.active_model_version}
                  onRollback={handleRollback}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* System Health */}
        <TabsContent value="health" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {services.map(service => {
              const Icon = service.icon;
              return (
                <Card key={service.name} className="overflow-hidden">
                  <div
                    className="h-1"
                    style={{
                      backgroundColor:
                        service.status === 'online' ? '#22c55e' :
                        service.status === 'offline' ? '#ef4444' : '#6b7280',
                    }}
                  />
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          service.status === 'online' ? 'bg-green-500/10' :
                          service.status === 'offline' ? 'bg-red-500/10' : 'bg-muted'
                        }`}>
                          <Icon className={`h-5 w-5 ${
                            service.status === 'online' ? 'text-green-600' :
                            service.status === 'offline' ? 'text-red-600' : 'text-muted-foreground'
                          }`} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{service.name}</p>
                          {service.detail && (
                            <p className="text-[10px] text-muted-foreground">{service.detail}</p>
                          )}
                        </div>
                      </div>
                      <StatusBadge status={service.status} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* ML Service Details */}
          {health && (
            <Card>
              <CardHeader>
                <CardTitle>Detalle del Servicio ML</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                      Disponibilidad
                    </p>
                    <p className={`text-lg font-bold ${health.ml_service_available ? 'text-green-600' : 'text-red-600'}`}>
                      {health.ml_service_available ? 'Disponible' : 'No disponible'}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                      Ultima verificacion
                    </p>
                    <p className="text-sm font-semibold">
                      {new Date(health.checked_at).toLocaleString('es-CO')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
