/**
 * OpenAPI 3.0 specification for VíaBaq Node Network API
 * Serves at GET /api/docs
 */

export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'VíaBaq Node Network API',
    version: '1.0.0',
    description: `
## Urban Mobility Intelligence Platform — Barranquilla, Colombia

REST API for real-time traffic monitoring, ML-powered predictions, routing,
alert management, and geospatial data for the city of Barranquilla.

### Features
- **Real-time traffic data** with WebSocket support (Socket.IO)
- **ML predictions** with SHAP explanations and multi-horizon forecasting
- **Arroyo flood risk** assessment for Barranquilla's drainage system
- **Smart routing** avoiding congestion, arroyos, and events
- **Executive analytics** with trend comparisons

### Authentication
No authentication required for this portfolio API. Rate limits apply.

### Rate Limits
| Namespace | Limit |
|-----------|-------|
| Insights/Analytics | 60 req/min |
| Routing | 30 req/min |
| Alerts | 120 req/min |
| Geo/Weather | 300 req/min |
| Metrics | 60 req/min |
| General | 100 req/min (prod) |
    `.trim(),
    contact: {
      name: 'VíaBaq API',
      url: 'https://github.com/your-repo/viabaq-node-network',
    },
    license: {
      name: 'MIT',
    },
  },
  servers: [
    {
      url: 'http://localhost:4000',
      description: 'Local development server',
    },
    {
      url: 'https://viabaq-backend.up.railway.app',
      description: 'Production server (Railway)',
    },
  ],
  tags: [
    { name: 'Health', description: 'Service health and status' },
    { name: 'Geo', description: 'Geospatial data: zones, roads, arroyos, POIs' },
    { name: 'Traffic', description: 'Real-time and historical traffic data' },
    { name: 'Weather', description: 'Weather conditions and forecast' },
    { name: 'Events', description: 'City events that affect traffic' },
    { name: 'Analytics', description: 'Traffic patterns, hotspots, weather impact' },
    { name: 'Insights', description: 'Executive summaries and comparative metrics' },
    { name: 'Alerts', description: 'Active traffic and risk alerts' },
    { name: 'Predictions', description: 'ML-powered traffic speed predictions' },
    { name: 'Routes', description: 'Optimal route calculation' },
    { name: 'Metrics', description: 'Runtime observability metrics' },
    { name: 'ML', description: 'ML model management: features, retraining, versioning' },
  ],
  components: {
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['success', 'error'] },
          data: { type: 'object' },
          timestamp: { type: 'string', format: 'date-time' },
          cached: { type: 'boolean', description: 'True when response was served from cache' },
        },
        required: ['status', 'timestamp'],
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['error'] },
          message: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
        },
        required: ['status', 'message', 'timestamp'],
      },
      Zone: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string', example: 'El Prado' },
          type: { type: 'string', example: 'residential' },
          geometry: { type: 'object', description: 'GeoJSON geometry' },
          congestion_level: { type: 'string', enum: ['low', 'moderate', 'high', 'critical'] },
          avg_speed: { type: 'number', description: 'Average speed in km/h' },
          active_alerts: { type: 'integer' },
          arroyo_risk_level: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        },
      },
      ArroyoZone: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          risk_level: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          geometry: { type: 'object', description: 'GeoJSON geometry' },
        },
      },
      Road: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          type: { type: 'string' },
          geometry: { type: 'object' },
        },
      },
      POI: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          category: { type: 'string' },
          lat: { type: 'number' },
          lng: { type: 'number' },
        },
      },
      Alert: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: {
            type: 'string',
            enum: ['arroyo_flood_risk', 'severe_congestion', 'weather_traffic_impact', 'event_traffic_impact'],
          },
          severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          title: { type: 'string' },
          description: { type: 'string' },
          zone_id: { type: 'integer', nullable: true },
          road_id: { type: 'integer', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
          expires_at: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      Prediction: {
        type: 'object',
        properties: {
          road_id: { type: 'integer' },
          predicted_speed: { type: 'number', description: 'Speed in km/h' },
          confidence_interval: {
            type: 'object',
            properties: {
              lower: { type: 'number' },
              upper: { type: 'number' },
            },
          },
          horizon_minutes: { type: 'integer', enum: [15, 30, 60, 120] },
          model_version: { type: 'string', example: '20260221_030000' },
          predicted_at: { type: 'string', format: 'date-time' },
        },
      },
      ExplanationData: {
        type: 'object',
        properties: {
          road_id: { type: 'integer' },
          shap_values: { type: 'object', additionalProperties: { type: 'number' } },
          feature_importance: { type: 'object', additionalProperties: { type: 'number' } },
          top_factors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                feature: { type: 'string' },
                impact: { type: 'number' },
                direction: { type: 'string', enum: ['positive', 'negative'] },
              },
            },
          },
        },
      },
      ArroyoRiskData: {
        type: 'object',
        properties: {
          risk_zones: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                zone_id: { type: 'integer' },
                risk_level: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
                probability: { type: 'number', minimum: 0, maximum: 1 },
              },
            },
          },
          assessed_at: { type: 'string', format: 'date-time' },
        },
      },
      RouteRequest: {
        type: 'object',
        required: ['origin', 'destination'],
        properties: {
          origin: {
            type: 'object',
            required: ['lat', 'lng'],
            properties: {
              lat: { type: 'number', example: 10.9878 },
              lng: { type: 'number', example: -74.7889 },
            },
          },
          destination: {
            type: 'object',
            required: ['lat', 'lng'],
            properties: {
              lat: { type: 'number', example: 10.9634 },
              lng: { type: 'number', example: -74.7964 },
            },
          },
          preferences: {
            type: 'object',
            properties: {
              avoid_arroyos: { type: 'boolean', default: true },
              avoid_congestion: { type: 'boolean', default: true },
              avoid_events: { type: 'boolean', default: false },
              max_routes: { type: 'integer', minimum: 1, maximum: 5, default: 3 },
            },
          },
        },
      },
      Route: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          distance_km: { type: 'number' },
          estimated_duration_min: { type: 'number' },
          traffic_score: { type: 'number', description: '0-100, higher is better' },
          arroyo_risk: { type: 'string', enum: ['none', 'low', 'medium', 'high'] },
          warnings: { type: 'array', items: { type: 'string' } },
          waypoints: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                lat: { type: 'number' },
                lng: { type: 'number' },
              },
            },
          },
        },
      },
      ExecutiveSummary: {
        type: 'object',
        properties: {
          total_zones: { type: 'integer' },
          active_alerts: { type: 'integer' },
          critical_alerts: { type: 'integer' },
          avg_city_speed: { type: 'number' },
          congestion_breakdown: {
            type: 'object',
            properties: {
              low: { type: 'integer' },
              moderate: { type: 'integer' },
              high: { type: 'integer' },
              critical: { type: 'integer' },
            },
          },
          trend: { type: 'string', enum: ['improving', 'stable', 'worsening'] },
          generated_at: { type: 'string', format: 'date-time' },
        },
      },
      ModelVersion: {
        type: 'object',
        properties: {
          version: { type: 'string', example: '20260221_030000' },
          trained_at: { type: 'string', format: 'date-time' },
          mae: { type: 'number' },
          rmse: { type: 'number' },
          r2: { type: 'number' },
          is_active: { type: 'boolean' },
        },
      },
    },
    responses: {
      BadRequest: {
        description: 'Invalid request parameters',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
      MLServiceUnavailable: {
        description: 'ML service is unavailable',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
      InternalError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
    },
  },
  paths: {
    // ──────────────────────────────
    // HEALTH
    // ──────────────────────────────
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Service health check',
        description: 'Returns status of backend, database, Redis, and Socket.IO connections.',
        responses: {
          200: {
            description: 'Service status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['ok', 'degraded'] },
                    timestamp: { type: 'string', format: 'date-time' },
                    uptime: { type: 'number', description: 'Uptime in seconds' },
                    environment: { type: 'string' },
                    services: {
                      type: 'object',
                      properties: {
                        database: { type: 'string', enum: ['connected', 'disconnected'] },
                        redis: { type: 'string', enum: ['connected', 'disconnected'] },
                        socket: {
                          type: 'object',
                          properties: {
                            status: { type: 'string' },
                            connections: { type: 'integer' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ──────────────────────────────
    // GEO
    // ──────────────────────────────
    '/api/v1/metrics': {
      get: {
        tags: ['Metrics'],
        summary: 'Runtime metrics',
        description: 'Returns uptime, memory, request throughput, cache hit ratio, and DB pool usage.',
        responses: {
          200: {
            description: 'Metrics response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    uptime_seconds: { type: 'number' },
                    memory_mb: {
                      type: 'object',
                      properties: {
                        used: { type: 'number' },
                        total: { type: 'number' },
                      },
                    },
                    requests: {
                      type: 'object',
                      properties: {
                        total: { type: 'number' },
                        per_minute: { type: 'number' },
                      },
                    },
                    cache: {
                      type: 'object',
                      properties: {
                        hits: { type: 'number' },
                        misses: { type: 'number' },
                        hit_rate: { type: 'number' },
                      },
                    },
                    db: {
                      type: 'object',
                      properties: {
                        pool_size: { type: 'number' },
                        active_connections: { type: 'number' },
                      },
                    },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/geo/zones': {
      get: {
        tags: ['Geo'],
        summary: 'List all city zones',
        description: 'Returns all traffic zones with current congestion data merged from insights.',
        responses: {
          200: {
            description: 'List of zones',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { type: 'array', items: { $ref: '#/components/schemas/Zone' } },
                      },
                    },
                  ],
                },
              },
            },
          },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/api/v1/geo/zones/{id}': {
      get: {
        tags: ['Geo'],
        summary: 'Get zone by ID',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Zone ID' },
        ],
        responses: {
          200: {
            description: 'Zone details',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: { data: { $ref: '#/components/schemas/Zone' } },
                    },
                  ],
                },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/v1/geo/zones/bounds': {
      get: {
        tags: ['Geo'],
        summary: 'Get zones within bounding box',
        parameters: [
          { name: 'sw_lng', in: 'query', required: true, schema: { type: 'number' }, example: -74.86 },
          { name: 'sw_lat', in: 'query', required: true, schema: { type: 'number' }, example: 10.91 },
          { name: 'ne_lng', in: 'query', required: true, schema: { type: 'number' }, example: -74.76 },
          { name: 'ne_lat', in: 'query', required: true, schema: { type: 'number' }, example: 11.05 },
        ],
        responses: {
          200: {
            description: 'Zones within bounds',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { type: 'array', items: { $ref: '#/components/schemas/Zone' } },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/api/v1/geo/arroyos': {
      get: {
        tags: ['Geo'],
        summary: 'Get arroyo flood zones',
        description: 'Returns Barranquilla\'s arroyo drainage zones with optional risk level filter.',
        parameters: [
          {
            name: 'risk_level',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          },
        ],
        responses: {
          200: {
            description: 'Arroyo zones',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { type: 'array', items: { $ref: '#/components/schemas/ArroyoZone' } },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/geo/roads': {
      get: {
        tags: ['Geo'],
        summary: 'Get road network',
        parameters: [
          { name: 'type', in: 'query', required: false, schema: { type: 'string' }, description: 'Filter by road type' },
        ],
        responses: {
          200: {
            description: 'Road list',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { type: 'array', items: { $ref: '#/components/schemas/Road' } },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/geo/pois': {
      get: {
        tags: ['Geo'],
        summary: 'Get points of interest',
        parameters: [
          { name: 'category', in: 'query', required: false, schema: { type: 'string' }, description: 'Filter by category' },
        ],
        responses: {
          200: {
            description: 'POI list',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { type: 'array', items: { $ref: '#/components/schemas/POI' } },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },

    // ──────────────────────────────
    // INSIGHTS
    // ──────────────────────────────
    '/api/v1/insights/summary': {
      get: {
        tags: ['Insights'],
        summary: 'Executive summary',
        description: 'City-wide traffic KPIs: alert counts, avg speed, congestion breakdown, trend. Cached 5 min.',
        responses: {
          200: {
            description: 'Executive summary data',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: { data: { $ref: '#/components/schemas/ExecutiveSummary' } },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/insights/zones': {
      get: {
        tags: ['Insights'],
        summary: 'All zone insights',
        description: 'Per-zone traffic metrics for all zones. Cached 5 min.',
        responses: {
          200: {
            description: 'Zone insights',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { type: 'array', items: { type: 'object' } },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/insights/zones/{zone_id}': {
      get: {
        tags: ['Insights'],
        summary: 'Zone insights by ID',
        parameters: [
          { name: 'zone_id', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          200: { description: 'Zone insight data', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/v1/insights/comparative': {
      get: {
        tags: ['Insights'],
        summary: 'Comparative metrics',
        description: 'Traffic comparison over N days. Cached 10 min.',
        parameters: [
          {
            name: 'days',
            in: 'query',
            required: false,
            schema: { type: 'integer', minimum: 1, maximum: 90, default: 30 },
            description: 'Number of days to compare',
          },
        ],
        responses: {
          200: { description: 'Comparative metrics', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/api/v1/insights/departure-advice': {
      get: {
        tags: ['Insights'],
        summary: 'Best departure window advice',
        description: 'Recommends the best departure window based on traffic history, weather forecast, and active alerts.',
        parameters: [
          {
            in: 'query',
            name: 'hours',
            required: false,
            schema: { type: 'integer', minimum: 1, maximum: 12, default: 3 },
            description: 'How many hours ahead to analyze.',
          },
          {
            in: 'query',
            name: 'interval',
            required: false,
            schema: { type: 'integer', enum: [15, 30, 60], default: 30 },
            description: 'Window granularity in minutes.',
          },
        ],
        responses: {
          200: { description: 'Departure advice', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/api/v1/insights/clear-cache': {
      post: {
        tags: ['Insights'],
        summary: 'Clear insights cache',
        responses: {
          200: { description: 'Cache cleared', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        },
      },
    },

    // ──────────────────────────────
    // ALERTS
    // ──────────────────────────────
    '/api/v1/alerts/active': {
      get: {
        tags: ['Alerts'],
        summary: 'Active alerts',
        description: 'All currently active traffic alerts. Cached 2 min.',
        responses: {
          200: {
            description: 'Active alerts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    timestamp: { type: 'string', format: 'date-time' },
                    count: { type: 'integer' },
                    alerts: { type: 'array', items: { $ref: '#/components/schemas/Alert' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/alerts/critical': {
      get: {
        tags: ['Alerts'],
        summary: 'Critical alerts only',
        description: 'Alerts with severity=critical. Cached 1 min.',
        responses: {
          200: {
            description: 'Critical alerts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    count: { type: 'integer' },
                    alerts: { type: 'array', items: { $ref: '#/components/schemas/Alert' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/alerts/summary': {
      get: {
        tags: ['Alerts'],
        summary: 'Alert summary',
        description: 'Aggregate count of alerts grouped by severity and type.',
        responses: {
          200: {
            description: 'Alert summary',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    summary: {
                      type: 'object',
                      properties: {
                        total: { type: 'integer' },
                        bySeverity: { type: 'object', additionalProperties: { type: 'integer' } },
                        byType: { type: 'object', additionalProperties: { type: 'integer' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/alerts/by-severity/{severity}': {
      get: {
        tags: ['Alerts'],
        summary: 'Alerts filtered by severity',
        parameters: [
          {
            name: 'severity',
            in: 'path',
            required: true,
            schema: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          },
        ],
        responses: {
          200: { description: 'Filtered alerts', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/api/v1/alerts/by-type/{type}': {
      get: {
        tags: ['Alerts'],
        summary: 'Alerts filtered by type',
        parameters: [
          {
            name: 'type',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              enum: ['arroyo_flood_risk', 'severe_congestion', 'weather_traffic_impact', 'event_traffic_impact'],
            },
          },
        ],
        responses: {
          200: { description: 'Filtered alerts', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
        },
      },
    },

    // ──────────────────────────────
    // PREDICTIONS
    // ──────────────────────────────
    '/api/v1/predictions/health': {
      get: {
        tags: ['Predictions'],
        summary: 'ML service health',
        description: 'Check if the Python ML service is reachable.',
        responses: {
          200: {
            description: 'ML service status',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            ml_service_available: { type: 'boolean' },
                            checked_at: { type: 'string', format: 'date-time' },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/predictions/all': {
      get: {
        tags: ['Predictions'],
        summary: 'Predictions for all roads',
        parameters: [
          { name: 'timestamp', in: 'query', required: false, schema: { type: 'string', format: 'date-time' } },
        ],
        responses: {
          200: { description: 'All road predictions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
          503: { $ref: '#/components/responses/MLServiceUnavailable' },
        },
      },
    },
    '/api/v1/predictions/arroyo-risk': {
      get: {
        tags: ['Predictions'],
        summary: 'Arroyo flood risk prediction',
        description: 'ML-powered flood risk assessment for all arroyo zones.',
        responses: {
          200: {
            description: 'Arroyo risk data',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: { data: { $ref: '#/components/schemas/ArroyoRiskData' } },
                    },
                  ],
                },
              },
            },
          },
          503: { $ref: '#/components/responses/MLServiceUnavailable' },
        },
      },
    },
    '/api/v1/predictions/road/{id}': {
      get: {
        tags: ['Predictions'],
        summary: 'Traffic prediction for a road',
        description: 'Predict traffic speed for a specific road at a given horizon. Cached 15 min.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Road ID' },
          { name: 'timestamp', in: 'query', required: false, schema: { type: 'string', format: 'date-time' } },
          { name: 'horizon', in: 'query', required: false, schema: { type: 'integer', enum: [15, 30, 60, 120], default: 30 }, description: 'Forecast horizon in minutes' },
        ],
        responses: {
          200: {
            description: 'Road prediction',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: { data: { $ref: '#/components/schemas/Prediction' } },
                    },
                  ],
                },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          503: { $ref: '#/components/responses/MLServiceUnavailable' },
        },
      },
    },
    '/api/v1/predictions/road/{id}/timeline': {
      get: {
        tags: ['Predictions'],
        summary: 'Multi-horizon prediction timeline',
        description: 'Returns predictions for horizons 15, 30, 60, 120 min for a road.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'timestamp', in: 'query', required: false, schema: { type: 'string', format: 'date-time' } },
        ],
        responses: {
          200: { description: 'Timeline predictions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
          503: { $ref: '#/components/responses/MLServiceUnavailable' },
        },
      },
    },
    '/api/v1/predictions/road/{id}/explanation': {
      get: {
        tags: ['Predictions'],
        summary: 'SHAP explanation for road prediction',
        description: 'Returns SHAP feature importance values explaining the ML prediction.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'timestamp', in: 'query', required: false, schema: { type: 'string', format: 'date-time' } },
        ],
        responses: {
          200: {
            description: 'SHAP explanation',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: { data: { $ref: '#/components/schemas/ExplanationData' } },
                    },
                  ],
                },
              },
            },
          },
          503: { $ref: '#/components/responses/MLServiceUnavailable' },
        },
      },
    },
    '/api/v1/predictions/batch': {
      post: {
        tags: ['Predictions'],
        summary: 'Batch predictions for multiple roads',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['road_ids'],
                properties: {
                  road_ids: {
                    type: 'array',
                    items: { type: 'integer' },
                    maxItems: 50,
                    example: [1, 2, 3, 4, 5],
                  },
                  timestamp: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Batch predictions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          503: { $ref: '#/components/responses/MLServiceUnavailable' },
        },
      },
    },

    // ──────────────────────────────
    // ROUTES
    // ──────────────────────────────
    '/api/v1/routes/calculate': {
      post: {
        tags: ['Routes'],
        summary: 'Calculate route options',
        description: 'Returns up to 3 route alternatives considering traffic, arroyos, and events. Rate limit: 30 req/min. Cached 10 min.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RouteRequest' },
              example: {
                origin: { lat: 10.9878, lng: -74.7889 },
                destination: { lat: 10.9634, lng: -74.7964 },
                preferences: { avoid_arroyos: true, avoid_congestion: true },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Route options',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { type: 'array', items: { $ref: '#/components/schemas/Route' } },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/api/v1/routes/optimal': {
      post: {
        tags: ['Routes'],
        summary: 'Get optimal route',
        description: 'Returns the single best route based on traffic score.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RouteRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Optimal route',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: { data: { $ref: '#/components/schemas/Route' } },
                    },
                  ],
                },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/api/v1/routes/example': {
      get: {
        tags: ['Routes'],
        summary: 'Example route (for testing)',
        description: 'Returns a pre-calculated example route to demonstrate the API.',
        responses: {
          200: { description: 'Example route response', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        },
      },
    },
    '/api/v1/routes/clear-cache': {
      post: {
        tags: ['Routes'],
        summary: 'Clear routes cache',
        responses: {
          200: { description: 'Cache cleared', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        },
      },
    },

    // ──────────────────────────────
    // ML
    // ──────────────────────────────
    '/api/v1/ml/retrain': {
      post: {
        tags: ['ML'],
        summary: 'Trigger model retraining',
        description: 'Queues a BullMQ job to retrain the traffic prediction model. Returns 202 immediately.',
        responses: {
          202: {
            description: 'Retraining job queued',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            job_id: { type: 'string' },
                            status: { type: 'string', enum: ['queued'] },
                            note: { type: 'string' },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          503: { $ref: '#/components/responses/MLServiceUnavailable' },
        },
      },
    },
    '/api/v1/ml/model-history': {
      get: {
        tags: ['ML'],
        summary: 'Model version history',
        description: 'Returns all trained model versions with their performance metrics.',
        responses: {
          200: {
            description: 'Model history',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { type: 'array', items: { $ref: '#/components/schemas/ModelVersion' } },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/ml/rollback/{version}': {
      post: {
        tags: ['ML'],
        summary: 'Rollback to a previous model version',
        description: 'Restores a previously trained model version. Version format: YYYYMMDD_HHMMSS.',
        parameters: [
          {
            name: 'version',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: '20260221_030000',
          },
        ],
        responses: {
          200: { description: 'Model rolled back', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
          404: { $ref: '#/components/responses/NotFound' },
          503: { $ref: '#/components/responses/MLServiceUnavailable' },
        },
      },
    },
    '/api/v1/ml/evaluation': {
      get: {
        tags: ['ML'],
        summary: 'Prediction quality evaluation',
        description: 'Returns temporal error metrics (MAE, MAPE, RMSE, p95) for prediction feedback.',
        parameters: [
          {
            name: 'days',
            in: 'query',
            required: false,
            schema: { type: 'integer', minimum: 1, maximum: 90, default: 14 },
            description: 'Evaluation window in days',
          },
        ],
        responses: {
          200: {
            description: 'Evaluation metrics',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiResponse' },
              },
            },
          },
        },
      },
    },
    '/api/v1/ml/evaluation/sync-actuals': {
      post: {
        tags: ['ML'],
        summary: 'Sync prediction feedback with observed traffic',
        description: 'Fills actual values and computes errors by matching feedback rows with nearest traffic history samples.',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  lookback_hours: { type: 'integer', minimum: 1, maximum: 720, default: 72 },
                  tolerance_minutes: { type: 'integer', minimum: 1, maximum: 180, default: 30 },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Sync summary',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiResponse' },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/api/v1/ml/drift-status': {
      get: {
        tags: ['ML'],
        summary: 'Model drift status',
        description: 'Compares recent prediction error metrics against a historical baseline and classifies drift level.',
        parameters: [
          {
            name: 'recent_hours',
            in: 'query',
            required: false,
            schema: { type: 'integer', minimum: 1, maximum: 336, default: 24 },
          },
          {
            name: 'baseline_days',
            in: 'query',
            required: false,
            schema: { type: 'integer', minimum: 1, maximum: 365, default: 30 },
          },
          {
            name: 'min_samples',
            in: 'query',
            required: false,
            schema: { type: 'integer', minimum: 1, maximum: 10000, default: 40 },
          },
        ],
        responses: {
          200: {
            description: 'Drift status response',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiResponse' },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/api/v1/ml/features': {
      get: {
        tags: ['ML'],
        summary: 'Get stored ML features',
        parameters: [
          { name: 'road_id', in: 'query', required: false, schema: { type: 'integer' } },
          { name: 'start_time', in: 'query', required: false, schema: { type: 'string', format: 'date-time' } },
          { name: 'end_time', in: 'query', required: false, schema: { type: 'string', format: 'date-time' } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', maximum: 10000, default: 100 } },
        ],
        responses: {
          200: { description: 'Feature records', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        },
      },
    },
    '/api/v1/ml/features/stats': {
      get: {
        tags: ['ML'],
        summary: 'Feature dataset statistics',
        description: 'Returns metadata about the ML training dataset.',
        responses: {
          200: {
            description: 'Feature stats',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            total_records: { type: 'integer' },
                            unique_roads: { type: 'integer' },
                            earliest_record: { type: 'string', format: 'date-time' },
                            latest_record: { type: 'string', format: 'date-time' },
                            labeling_percentage: { type: 'number' },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/ml/features/extract': {
      post: {
        tags: ['ML'],
        summary: 'Extract features for a road',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['road_id'],
                properties: {
                  road_id: { type: 'integer' },
                  timestamp: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Extracted features', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/api/v1/ml/features/batch': {
      post: {
        tags: ['ML'],
        summary: 'Batch feature extraction for all roads',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  timestamp: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Batch started', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        },
      },
    },
  },
} as const;
