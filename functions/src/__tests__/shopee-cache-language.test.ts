let mockStore: Record<string, Record<string, any>> = {};

const mockTimestampNow = jest.fn(() => ({
  toMillis: () => Date.now(),
}));

const mockFirestoreInstance = {
  collection: jest.fn((collectionName: string) => ({
    doc: jest.fn((docId: string) => ({
      get: jest.fn(async () => {
        const data = mockStore[collectionName]?.[docId];
        return {
          exists: !!data,
          data: () => data,
        };
      }),
      set: jest.fn(async (payload: Record<string, unknown>) => {
        if (!mockStore[collectionName]) {
          mockStore[collectionName] = {};
        }
        mockStore[collectionName][docId] = payload;
      }),
    })),
  })),
};

const mockFirestore = Object.assign(
  jest.fn(() => mockFirestoreInstance),
  {
    Timestamp: {
      now: mockTimestampNow,
    },
  }
);

jest.mock('../config/firebase', () => ({
  __esModule: true,
  default: {
    firestore: mockFirestore,
  },
}));

const mockEnsureValidToken = jest.fn();
const mockCallShopeeApi = jest.fn();

jest.mock('../services/shopee.service', () => ({
  ensureValidToken: (...args: unknown[]) => mockEnsureValidToken(...args),
  callShopeeApi: (...args: unknown[]) => mockCallShopeeApi(...args),
}));

import { getCategories } from '../services/shopee-category.service';
import { getLogisticsChannels } from '../services/shopee-logistics.service';

describe('cache por loja e idioma (categorias/logistica)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore = {};
    mockEnsureValidToken.mockResolvedValue('token-ok');
  });

  it('separa cache de categorias por shop_id + language', async () => {
    mockCallShopeeApi.mockImplementation(async (request: any) => {
      if (request.path !== '/api/v2/product/get_category') {
        throw new Error(`path inesperado: ${request.path}`);
      }

      const language = String(request.query?.language || 'pt-BR');
      return {
        error: '',
        response: {
          category_list: [
            {
              category_id: language === 'en-US' ? 200 : 100,
              parent_category_id: 0,
              original_category_name: language === 'en-US' ? 'Fabric' : 'Tecido',
              display_category_name: language === 'en-US' ? 'Fabric' : 'Tecido',
              has_children: false,
            },
          ],
        },
      };
    });

    const ptFirst = await getCategories(10, false, 'pt-BR');
    const ptSecond = await getCategories(10, false, 'pt-BR');
    const enFirst = await getCategories(10, false, 'en-US');

    expect(ptFirst[0].id).toBe(100);
    expect(ptSecond[0].id).toBe(100);
    expect(enFirst[0].id).toBe(200);
    expect(mockCallShopeeApi).toHaveBeenCalledTimes(2);
    expect(Object.keys(mockStore.shopee_categories_cache || {})).toEqual(
      expect.arrayContaining(['10_pt-br', '10_en-us'])
    );
  });

  it('separa cache de logistica por shop_id + language', async () => {
    mockCallShopeeApi.mockImplementation(async (request: any) => {
      if (request.path !== '/api/v2/logistics/get_channel_list') {
        throw new Error(`path inesperado: ${request.path}`);
      }

      const language = String(request.query?.language || 'pt-BR');
      return {
        error: '',
        response: {
          logistics_channel_list: [
            {
              logistics_channel_id: language === 'en-US' ? 20 : 10,
              logistics_channel_name: language === 'en-US' ? 'Express' : 'Padrao',
              cod_enabled: false,
              enabled: true,
              fee_type: 'SIZE',
            },
          ],
        },
      };
    });

    const ptFirst = await getLogisticsChannels(77, false, 'pt-BR');
    const ptSecond = await getLogisticsChannels(77, false, 'pt-BR');
    const enFirst = await getLogisticsChannels(77, false, 'en-US');

    expect(ptFirst[0].logistics_channel_id).toBe(10);
    expect(ptSecond[0].logistics_channel_id).toBe(10);
    expect(enFirst[0].logistics_channel_id).toBe(20);
    expect(mockCallShopeeApi).toHaveBeenCalledTimes(2);
    expect(Object.keys(mockStore.shopee_logistics_cache || {})).toEqual(
      expect.arrayContaining(['77_pt-br', '77_en-us'])
    );
  });
});
