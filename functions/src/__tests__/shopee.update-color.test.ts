import request from 'supertest';
import { app } from '../index';
import { callShopeeApi, ensureValidToken } from '../services/shopee.service';

jest.mock('../middleware/auth.middleware', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { uid: 'test-user', email: 'test@example.com' };
    next();
  },
}));

jest.mock('../services/shopee.service', () => ({
  ensureValidToken: jest.fn(),
  callShopeeApi: jest.fn(),
}));

const mockedEnsureValidToken = ensureValidToken as jest.Mock;
const mockedCallShopeeApi = callShopeeApi as jest.Mock;

describe('POST /api/shopee/update-color-availability', () => {
  beforeEach(() => {
    mockedEnsureValidToken.mockReset();
    mockedCallShopeeApi.mockReset();
  });

  it('deve atualizar status e estoque para targets', async () => {
    mockedEnsureValidToken.mockResolvedValue('access-token');
    mockedCallShopeeApi.mockResolvedValue({});

    const res = await request(app)
      .post('/api/shopee/update-color-availability')
      .send({
        shop_id: 803215808,
        model_status: 'NORMAL',
        stock: 500,
        targets: [
          { item_id: 111, model_ids: [1, 2] },
          { item_id: 222, model_ids: [3] },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockedEnsureValidToken).toHaveBeenCalledWith(803215808);
    expect(mockedCallShopeeApi).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/api/v2/product/update_model' })
    );
    expect(mockedCallShopeeApi).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/api/v2/product/update_stock' })
    );
  });

  it('deve retornar 400 sem campos obrigatórios', async () => {
    const res = await request(app)
      .post('/api/shopee/update-color-availability')
      .send({ shop_id: 803215808 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('deve retornar 500 se update_model falhar', async () => {
    mockedEnsureValidToken.mockResolvedValue('access-token');
    mockedCallShopeeApi.mockResolvedValueOnce({ error: 'invalid' });

    const res = await request(app)
      .post('/api/shopee/update-color-availability')
      .send({
        shop_id: 803215808,
        model_status: 'UNAVAILABLE',
        targets: [
          { item_id: 111, model_ids: [1] },
        ],
      });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
