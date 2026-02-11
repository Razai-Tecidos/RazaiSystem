import request from 'supertest';
import { app } from '../index';
import { callShopeeApi, ensureValidToken, getShopTokens } from '../services/shopee.service';

jest.mock('../middleware/auth.middleware', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { uid: 'test-user', email: 'test@example.com' };
    next();
  },
}));

jest.mock('../services/shopee.service', () => ({
  ensureValidToken: jest.fn(),
  callShopeeApi: jest.fn(),
  getShopTokens: jest.fn(),
}));

const mockedEnsureValidToken = ensureValidToken as jest.Mock;
const mockedCallShopeeApi = callShopeeApi as jest.Mock;
const mockedGetShopTokens = getShopTokens as jest.Mock;

describe('POST /api/shopee/update-color-availability', () => {
  beforeEach(() => {
    mockedEnsureValidToken.mockReset();
    mockedCallShopeeApi.mockReset();
    mockedGetShopTokens.mockReset();
    mockedGetShopTokens.mockResolvedValue({
      shopId: 803215808,
      connectedBy: 'test-user',
    });
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
    expect(mockedCallShopeeApi).not.toHaveBeenCalledWith(
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

  it('deve retornar 500 se update_stock falhar no fluxo NORMAL', async () => {
    mockedEnsureValidToken.mockResolvedValue('access-token');
    mockedCallShopeeApi
      .mockResolvedValueOnce({ response: { item_list: [{ item_sku: 'SKU-1' }] } }) // get_item_base_info
      .mockResolvedValueOnce({
        response: {
          tier_variation: [{ option_list: [{ option: 'Azul' }] }],
          model: [{ model_id: 1, tier_index: [0] }],
        },
      }) // get_model_list (color option)
      .mockResolvedValueOnce({ error: 'invalid_stock' }); // update_stock

    const res = await request(app)
      .post('/api/shopee/update-color-availability')
      .send({
        shop_id: 803215808,
        model_status: 'NORMAL',
        stock: 500,
        targets: [
          { item_id: 111, model_ids: [1] },
        ],
      });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
