type RequestSample = {
  timestamp: number;
  durationMs: number;
};

type RouteAggregate = {
  count: number;
  errorCount: number;
  totalDurationMs: number;
  maxDurationMs: number;
  samples: RequestSample[];
  lastSeenAt: string | null;
  lastStatusCode: number | null;
};

type ChannelSubscriptionAggregate = {
  active: number;
  subscribes: number;
  unsubscribes: number;
};

type JobAggregate = {
  scheduled: number;
  completed: number;
  failed: number;
  lastScheduledAt: string | null;
  lastCompletedAt: string | null;
  lastFailedAt: string | null;
  lastError: string | null;
};

const ONE_MINUTE_MS = 60_000;
const SAMPLE_RETENTION_MS = 15 * ONE_MINUTE_MS;
const MAX_REQUEST_SAMPLES = 500;

function trimSamples(samples: RequestSample[], now: number) {
  const cutoff = now - SAMPLE_RETENTION_MS;
  while (samples.length > 0 && samples[0].timestamp < cutoff) {
    samples.shift();
  }
}

function percentileFromSamples(samples: RequestSample[], percentile: number) {
  if (samples.length === 0) {
    return 0;
  }

  const sorted = [...samples].sort((a, b) => a.durationMs - b.durationMs);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1)
  );

  return Number(sorted[index].durationMs.toFixed(2));
}

function averageFromSamples(samples: RequestSample[]) {
  if (samples.length === 0) {
    return 0;
  }

  const total = samples.reduce((sum, sample) => sum + sample.durationMs, 0);
  return Number((total / samples.length).toFixed(2));
}

function incrementCounter(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

function ensureJobAggregate(target: Record<string, JobAggregate>, type: string): JobAggregate {
  if (!target[type]) {
    target[type] = {
      scheduled: 0,
      completed: 0,
      failed: 0,
      lastScheduledAt: null,
      lastCompletedAt: null,
      lastFailedAt: null,
      lastError: null,
    };
  }

  return target[type];
}

function ensureChannelAggregate(
  target: Record<string, ChannelSubscriptionAggregate>,
  channel: string
): ChannelSubscriptionAggregate {
  if (!target[channel]) {
    target[channel] = {
      active: 0,
      subscribes: 0,
      unsubscribes: 0,
    };
  }

  return target[channel];
}

export class ObservabilityService {
  private static requestSamples: RequestSample[] = [];
  private static requestTimestamps: number[] = [];
  private static requestStatusCodes: Record<string, number> = {};
  private static routeAggregates = new Map<string, RouteAggregate>();
  private static totalRequests = 0;
  private static inflightRequests = 0;
  private static serverErrorRequests = 0;

  private static socketChannels: Record<string, ChannelSubscriptionAggregate> = {};
  private static socketSubscriptions = new Map<string, Set<string>>();
  private static socketConnectedClients = 0;
  private static socketPeakConnections = 0;
  private static socketTotalConnections = 0;
  private static socketTotalDisconnections = 0;
  private static socketAuthFailures = 0;
  private static socketErrors = 0;
  private static socketEmittedEvents: Record<string, number> = {};

  private static jobStats: Record<string, JobAggregate> = {};
  private static schedulerStatus: 'idle' | 'starting' | 'running' | 'stopped' | 'error' = 'idle';
  private static schedulerStartCount = 0;
  private static schedulerStopCount = 0;
  private static schedulerLastStartedAt: string | null = null;
  private static schedulerLastStoppedAt: string | null = null;
  private static schedulerLastErrorAt: string | null = null;
  private static schedulerLastError: string | null = null;

  private static trimRequestWindows(now: number) {
    const cutoff = now - ONE_MINUTE_MS;

    while (this.requestTimestamps.length > 0 && this.requestTimestamps[0] < cutoff) {
      this.requestTimestamps.shift();
    }

    trimSamples(this.requestSamples, now);

    for (const aggregate of this.routeAggregates.values()) {
      trimSamples(aggregate.samples, now);
    }
  }

  static recordRequestStart() {
    const now = Date.now();
    this.totalRequests += 1;
    this.inflightRequests += 1;
    this.requestTimestamps.push(now);
    this.trimRequestWindows(now);
  }

  static recordRequestComplete(input: {
    method: string;
    route: string;
    statusCode: number;
    durationMs: number;
  }) {
    const now = Date.now();
    this.inflightRequests = Math.max(0, this.inflightRequests - 1);
    const durationMs = Number(input.durationMs.toFixed(2));
    const sample = { timestamp: now, durationMs };

    this.requestSamples.push(sample);
    if (this.requestSamples.length > MAX_REQUEST_SAMPLES) {
      this.requestSamples.shift();
    }

    const statusKey = String(input.statusCode);
    incrementCounter(this.requestStatusCodes, statusKey);

    if (input.statusCode >= 500) {
      this.serverErrorRequests += 1;
    }

    const routeKey = `${input.method.toUpperCase()} ${input.route}`;
    const aggregate = this.routeAggregates.get(routeKey) ?? {
      count: 0,
      errorCount: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
      samples: [],
      lastSeenAt: null,
      lastStatusCode: null,
    };

    aggregate.count += 1;
    aggregate.totalDurationMs += durationMs;
    aggregate.maxDurationMs = Math.max(aggregate.maxDurationMs, durationMs);
    aggregate.lastSeenAt = new Date(now).toISOString();
    aggregate.lastStatusCode = input.statusCode;

    if (input.statusCode >= 500) {
      aggregate.errorCount += 1;
    }

    aggregate.samples.push(sample);
    if (aggregate.samples.length > MAX_REQUEST_SAMPLES) {
      aggregate.samples.shift();
    }

    this.routeAggregates.set(routeKey, aggregate);
    this.trimRequestWindows(now);
  }

  static getRequestMetrics() {
    const now = Date.now();
    this.trimRequestWindows(now);

    const routes = [...this.routeAggregates.entries()]
      .map(([route, aggregate]) => ({
        route,
        count: aggregate.count,
        errors: aggregate.errorCount,
        error_rate: aggregate.count === 0 ? 0 : Number(((aggregate.errorCount / aggregate.count) * 100).toFixed(2)),
        latency_ms: {
          avg: aggregate.count === 0 ? 0 : Number((aggregate.totalDurationMs / aggregate.count).toFixed(2)),
          p95: percentileFromSamples(aggregate.samples, 95),
          max: Number(aggregate.maxDurationMs.toFixed(2)),
        },
        last_seen_at: aggregate.lastSeenAt,
        last_status_code: aggregate.lastStatusCode,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total: this.totalRequests,
      inFlight: this.inflightRequests,
      perMinute: this.requestTimestamps.length,
      serverErrors: this.serverErrorRequests,
      statusCodes: this.requestStatusCodes,
      latencyMs: {
        avg: averageFromSamples(this.requestSamples),
        p95: percentileFromSamples(this.requestSamples, 95),
        max: this.requestSamples.length === 0
          ? 0
          : Number(Math.max(...this.requestSamples.map((sample) => sample.durationMs)).toFixed(2)),
      },
      routes,
    };
  }

  static recordSocketConnection(socketId: string) {
    this.socketTotalConnections += 1;
    this.socketConnectedClients += 1;
    this.socketPeakConnections = Math.max(this.socketPeakConnections, this.socketConnectedClients);
    this.socketSubscriptions.set(socketId, new Set());
  }

  static recordSocketDisconnection(socketId: string) {
    this.socketTotalDisconnections += 1;
    this.socketConnectedClients = Math.max(0, this.socketConnectedClients - 1);

    const channels = this.socketSubscriptions.get(socketId);
    if (channels) {
      for (const channel of channels) {
        const aggregate = ensureChannelAggregate(this.socketChannels, channel);
        aggregate.active = Math.max(0, aggregate.active - 1);
      }
    }

    this.socketSubscriptions.delete(socketId);
  }

  static recordSocketAuthFailure() {
    this.socketAuthFailures += 1;
  }

  static recordSocketError() {
    this.socketErrors += 1;
  }

  static recordSocketSubscription(socketId: string, channel: string) {
    const channels = this.socketSubscriptions.get(socketId) ?? new Set<string>();
    const aggregate = ensureChannelAggregate(this.socketChannels, channel);

    if (!channels.has(channel)) {
      channels.add(channel);
      aggregate.active += 1;
      aggregate.subscribes += 1;
      this.socketSubscriptions.set(socketId, channels);
    }
  }

  static recordSocketUnsubscription(socketId: string, channel: string) {
    const channels = this.socketSubscriptions.get(socketId);
    if (!channels || !channels.has(channel)) {
      return;
    }

    channels.delete(channel);
    const aggregate = ensureChannelAggregate(this.socketChannels, channel);
    aggregate.active = Math.max(0, aggregate.active - 1);
    aggregate.unsubscribes += 1;
  }

  static recordSocketEmission(eventName: string) {
    incrementCounter(this.socketEmittedEvents, eventName);
  }

  static getSocketMetrics() {
    return {
      connectedClients: this.socketConnectedClients,
      peakConnections: this.socketPeakConnections,
      totalConnections: this.socketTotalConnections,
      totalDisconnections: this.socketTotalDisconnections,
      authFailures: this.socketAuthFailures,
      errors: this.socketErrors,
      emittedEvents: this.socketEmittedEvents,
      channels: this.socketChannels,
    };
  }

  static recordSchedulerStarting() {
    this.schedulerStatus = 'starting';
  }

  static recordSchedulerStarted() {
    this.schedulerStatus = 'running';
    this.schedulerStartCount += 1;
    this.schedulerLastStartedAt = new Date().toISOString();
    this.schedulerLastError = null;
  }

  static recordSchedulerStopped() {
    this.schedulerStatus = 'stopped';
    this.schedulerStopCount += 1;
    this.schedulerLastStoppedAt = new Date().toISOString();
  }

  static recordSchedulerError(error: unknown) {
    this.schedulerStatus = 'error';
    this.schedulerLastErrorAt = new Date().toISOString();
    this.schedulerLastError = error instanceof Error ? error.message : String(error);
  }

  static recordJobScheduled(type: string) {
    const aggregate = ensureJobAggregate(this.jobStats, type);
    aggregate.scheduled += 1;
    aggregate.lastScheduledAt = new Date().toISOString();
  }

  static recordJobCompleted(type: string) {
    const aggregate = ensureJobAggregate(this.jobStats, type);
    aggregate.completed += 1;
    aggregate.lastCompletedAt = new Date().toISOString();
  }

  static recordJobFailed(type: string, error?: unknown) {
    const aggregate = ensureJobAggregate(this.jobStats, type);
    aggregate.failed += 1;
    aggregate.lastFailedAt = new Date().toISOString();
    aggregate.lastError = error instanceof Error ? error.message : error ? String(error) : aggregate.lastError;
  }

  static getJobMetrics() {
    return {
      scheduler: {
        status: this.schedulerStatus,
        starts: this.schedulerStartCount,
        stops: this.schedulerStopCount,
        last_started_at: this.schedulerLastStartedAt,
        last_stopped_at: this.schedulerLastStoppedAt,
        last_error_at: this.schedulerLastErrorAt,
        last_error: this.schedulerLastError,
      },
      jobs: this.jobStats,
    };
  }

  static toPrometheusSnapshot(snapshot: {
    uptimeSeconds: number;
    cache: { hits: number; misses: number; hitRate: number };
    db: { poolSize: number; activeConnections: number };
    requests: ReturnType<typeof ObservabilityService.getRequestMetrics>;
    sockets: ReturnType<typeof ObservabilityService.getSocketMetrics>;
    jobs: ReturnType<typeof ObservabilityService.getJobMetrics>;
  }) {
    const lines = [
      '# HELP viabaq_uptime_seconds Process uptime in seconds',
      '# TYPE viabaq_uptime_seconds gauge',
      `viabaq_uptime_seconds ${snapshot.uptimeSeconds}`,
      '# HELP viabaq_requests_total Total HTTP requests observed',
      '# TYPE viabaq_requests_total counter',
      `viabaq_requests_total ${snapshot.requests.total}`,
      '# HELP viabaq_requests_per_minute Requests observed in the trailing minute',
      '# TYPE viabaq_requests_per_minute gauge',
      `viabaq_requests_per_minute ${snapshot.requests.perMinute}`,
      '# HELP viabaq_request_latency_avg_ms Average request latency in milliseconds',
      '# TYPE viabaq_request_latency_avg_ms gauge',
      `viabaq_request_latency_avg_ms ${snapshot.requests.latencyMs.avg}`,
      '# HELP viabaq_request_latency_p95_ms P95 request latency in milliseconds',
      '# TYPE viabaq_request_latency_p95_ms gauge',
      `viabaq_request_latency_p95_ms ${snapshot.requests.latencyMs.p95}`,
      '# HELP viabaq_request_server_errors_total Total HTTP 5xx responses observed',
      '# TYPE viabaq_request_server_errors_total counter',
      `viabaq_request_server_errors_total ${snapshot.requests.serverErrors}`,
      '# HELP viabaq_cache_hits_total Total cache hits',
      '# TYPE viabaq_cache_hits_total counter',
      `viabaq_cache_hits_total ${snapshot.cache.hits}`,
      '# HELP viabaq_cache_misses_total Total cache misses',
      '# TYPE viabaq_cache_misses_total counter',
      `viabaq_cache_misses_total ${snapshot.cache.misses}`,
      '# HELP viabaq_socket_connected_clients Current connected Socket.IO clients',
      '# TYPE viabaq_socket_connected_clients gauge',
      `viabaq_socket_connected_clients ${snapshot.sockets.connectedClients}`,
      '# HELP viabaq_socket_peak_connections Peak concurrent Socket.IO clients',
      '# TYPE viabaq_socket_peak_connections gauge',
      `viabaq_socket_peak_connections ${snapshot.sockets.peakConnections}`,
      '# HELP viabaq_socket_auth_failures_total Rejected Socket.IO auth attempts',
      '# TYPE viabaq_socket_auth_failures_total counter',
      `viabaq_socket_auth_failures_total ${snapshot.sockets.authFailures}`,
      '# HELP viabaq_db_pool_size Database pool size',
      '# TYPE viabaq_db_pool_size gauge',
      `viabaq_db_pool_size ${snapshot.db.poolSize}`,
      '# HELP viabaq_db_active_connections Active database connections',
      '# TYPE viabaq_db_active_connections gauge',
      `viabaq_db_active_connections ${snapshot.db.activeConnections}`,
      '# HELP viabaq_scheduler_running Scheduler running status (1 running, 0 otherwise)',
      '# TYPE viabaq_scheduler_running gauge',
      `viabaq_scheduler_running ${snapshot.jobs.scheduler.status === 'running' ? 1 : 0}`,
    ];

    for (const [statusCode, count] of Object.entries(snapshot.requests.statusCodes)) {
      lines.push(`viabaq_request_status_total{status_code="${statusCode}"} ${count}`);
    }

    for (const [channel, aggregate] of Object.entries(snapshot.sockets.channels)) {
      lines.push(`viabaq_socket_channel_active{channel="${channel}"} ${aggregate.active}`);
      lines.push(`viabaq_socket_channel_subscribes_total{channel="${channel}"} ${aggregate.subscribes}`);
      lines.push(`viabaq_socket_channel_unsubscribes_total{channel="${channel}"} ${aggregate.unsubscribes}`);
    }

    for (const [jobType, aggregate] of Object.entries(snapshot.jobs.jobs)) {
      lines.push(`viabaq_job_scheduled_total{job_type="${jobType}"} ${aggregate.scheduled}`);
      lines.push(`viabaq_job_completed_total{job_type="${jobType}"} ${aggregate.completed}`);
      lines.push(`viabaq_job_failed_total{job_type="${jobType}"} ${aggregate.failed}`);
    }

    return `${lines.join('\n')}\n`;
  }
}
