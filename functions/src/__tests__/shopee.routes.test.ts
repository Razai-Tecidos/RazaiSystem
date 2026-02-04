import request from 'supertest';
import { app } from '../index';

describe('Rotas Shopee (Functions)', () => {
  it('retorna 401 sem token em /api/shopee/status', async () => {
    const res = await request(app).get('/api/shopee/status');
    expect(res.status).toBe(401);
    expect(res.body?.success).toBe(false);
  });

  it('retorna 401 sem token em /shopee/status', async () => {
    const res = await request(app).get('/shopee/status');
    expect(res.status).toBe(401);
    expect(res.body?.success).toBe(false);
  });
});
