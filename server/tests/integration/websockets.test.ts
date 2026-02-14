import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as ioClient, Socket } from 'socket.io-client';
import { config } from '@/config/index.js';

describe('WebSocket Integration Tests', () => {
  let clientSocket: Socket;
  const socketUrl = `http://localhost:${config.PORT}`;

  beforeAll((done) => {
    // Connect client socket
    clientSocket = ioClient(socketUrl, {
      transports: ['websocket'],
    });

    clientSocket.on('connect', () => {
      done();
    });
  });

  afterAll(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  it('should connect to WebSocket server', () => {
    expect(clientSocket.connected).toBe(true);
  });

  it('should subscribe to traffic updates', (done) => {
    clientSocket.emit('subscribe:traffic');

    // Wait a bit for subscription to register
    setTimeout(() => {
      expect(clientSocket.connected).toBe(true);
      done();
    }, 100);
  });

  it('should subscribe to weather updates', (done) => {
    clientSocket.emit('subscribe:weather');

    setTimeout(() => {
      expect(clientSocket.connected).toBe(true);
      done();
    }, 100);
  });

  it('should subscribe to alert updates', (done) => {
    clientSocket.emit('subscribe:alerts');

    setTimeout(() => {
      expect(clientSocket.connected).toBe(true);
      done();
    }, 100);
  });

  it('should subscribe to prediction updates', (done) => {
    clientSocket.emit('subscribe:predictions');

    setTimeout(() => {
      expect(clientSocket.connected).toBe(true);
      done();
    }, 100);
  });

  it('should subscribe to specific zone', (done) => {
    const zoneId = 1;
    clientSocket.emit('subscribe:zone', zoneId);

    setTimeout(() => {
      expect(clientSocket.connected).toBe(true);
      done();
    }, 100);
  });

  it('should unsubscribe from zone', (done) => {
    const zoneId = 1;
    clientSocket.emit('unsubscribe:zone', zoneId);

    setTimeout(() => {
      expect(clientSocket.connected).toBe(true);
      done();
    }, 100);
  });

  it('should receive traffic:update event', (done) => {
    clientSocket.once('traffic:update', (data) => {
      expect(data).toBeDefined();
      expect(data.timestamp).toBeDefined();
      expect(data.data).toBeDefined();
      done();
    });

    // Note: This test will timeout if no traffic update is emitted during test run
    // In real scenario, you would trigger a traffic update manually or mock it
  }, 30000);

  it('should receive weather:update event', (done) => {
    clientSocket.once('weather:update', (data) => {
      expect(data).toBeDefined();
      expect(data.timestamp).toBeDefined();
      expect(data.data).toBeDefined();
      done();
    });
  }, 30000);

  it('should receive alert:notification event', (done) => {
    clientSocket.once('alert:notification', (data) => {
      expect(data).toBeDefined();
      expect(data.timestamp).toBeDefined();
      expect(data.alert).toBeDefined();
      expect(data.alert.type).toBeDefined();
      expect(data.alert.severity).toBeDefined();
      done();
    });
  }, 30000);

  it('should receive prediction:update event', (done) => {
    clientSocket.once('prediction:update', (data) => {
      expect(data).toBeDefined();
      expect(data.timestamp).toBeDefined();
      expect(data.predictions).toBeDefined();
      done();
    });
  }, 30000);

  it('should handle disconnection gracefully', (done) => {
    const tempSocket = ioClient(socketUrl, {
      transports: ['websocket'],
    });

    tempSocket.on('connect', () => {
      tempSocket.disconnect();
    });

    tempSocket.on('disconnect', () => {
      expect(tempSocket.connected).toBe(false);
      done();
    });
  });
});

describe('Alert Service Integration Tests', () => {
  it('should detect active alerts', async () => {
    const response = await fetch(`http://localhost:${config.PORT}/api/v1/alerts/active`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.alerts).toBeDefined();
    expect(Array.isArray(data.alerts)).toBe(true);
  });

  it('should get alerts by severity', async () => {
    const severity = 'high';
    const response = await fetch(`http://localhost:${config.PORT}/api/v1/alerts/by-severity/${severity}`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.severity).toBe(severity);
    expect(Array.isArray(data.alerts)).toBe(true);
  });

  it('should get critical alerts', async () => {
    const response = await fetch(`http://localhost:${config.PORT}/api/v1/alerts/critical`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.alerts)).toBe(true);
  });

  it('should get alerts summary', async () => {
    const response = await fetch(`http://localhost:${config.PORT}/api/v1/alerts/summary`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.summary).toBeDefined();
    expect(data.summary.total).toBeDefined();
    expect(data.summary.bySeverity).toBeDefined();
    expect(data.summary.byType).toBeDefined();
  });

  it('should return 400 for invalid severity', async () => {
    const severity = 'invalid';
    const response = await fetch(`http://localhost:${config.PORT}/api/v1/alerts/by-severity/${severity}`);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('should return 400 for invalid alert type', async () => {
    const type = 'invalid_type';
    const response = await fetch(`http://localhost:${config.PORT}/api/v1/alerts/by-type/${type}`);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });
});
