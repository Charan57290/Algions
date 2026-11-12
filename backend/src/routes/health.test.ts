import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

describe('GET /api/health', () => {
  it('should return 200 OK with healthy status payload', async () => {
    const app = createApp();
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('healthy');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('database');
  });

  it('should return 404 for unknown routes', async () => {
    const app = createApp();
    const res = await request(app).get('/api/unknown-endpoint-test');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
