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

import { getAllCategoryBrands } from '../services/shopee-category.service';

describe('shopee-category.service brands pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore = {};
    mockEnsureValidToken.mockResolvedValue('token-ok');
  });

  it('busca todas as paginas de get_brand_list', async () => {
    mockCallShopeeApi.mockImplementation(async (request: any) => {
      const offset = Number(request.query?.offset || 0);
      if (offset === 0) {
        return {
          error: '',
          response: {
            brand_list: [
              { brand_id: 1, display_brand_name: 'Marca A', original_brand_name: 'Marca A' },
              { brand_id: 2, display_brand_name: 'Marca B', original_brand_name: 'Marca B' },
            ],
            has_next_page: true,
            next_offset: 2,
          },
        };
      }

      return {
        error: '',
        response: {
          brand_list: [
            { brand_id: 3, display_brand_name: 'Marca C', original_brand_name: 'Marca C' },
          ],
          has_next_page: false,
          next_offset: 3,
        },
      };
    });

    const result = await getAllCategoryBrands(1, 100, 1, 2, 'pt-BR');

    expect(result.brands).toHaveLength(3);
    expect(result.hasMore).toBe(false);
    expect(result.pagesFetched).toBe(2);
    expect(mockCallShopeeApi).toHaveBeenCalledTimes(2);
  });
});
