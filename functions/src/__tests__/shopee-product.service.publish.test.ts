const mockTimestampNow = jest.fn(() => ({ toMillis: () => Date.now() }));
const mockTimestampFromMillis = jest.fn((ms: number) => ({ toMillis: () => ms }));
const mockFieldDeleteSentinel = '__DELETE__';
const mockFieldValueDelete = jest.fn(() => mockFieldDeleteSentinel);

let mockProductState: Record<string, any> = {};

const mockProductDocRef = {
  get: jest.fn(async () => ({
    exists: true,
    id: 'prod-1',
    data: () => mockProductState,
  })),
  update: jest.fn(async (payload: Record<string, unknown>) => {
    mockProductState = { ...mockProductState, ...payload };
  }),
};

const mockTransactionUpdate = jest.fn((_docRef: unknown, payload: Record<string, unknown>) => {
  mockProductState = { ...mockProductState, ...payload };
});

const mockRunTransaction = jest.fn(async (callback: (tx: any) => Promise<unknown>) => {
  const tx = {
    get: jest.fn(async () => ({
      exists: true,
      id: 'prod-1',
      data: () => mockProductState,
    })),
    update: mockTransactionUpdate,
  };
  return callback(tx);
});

const mockFirestoreInstance = {
  collection: jest.fn((collectionName: string) => {
    if (collectionName === 'shopee_products') {
      return {
        doc: jest.fn(() => mockProductDocRef),
      };
    }

    if (collectionName === 'tecidos') {
      return {
        doc: jest.fn(() => ({
          get: jest.fn(async () => ({
            exists: true,
            data: () => ({
              nome: 'Viscolinho',
              composicao: '100% Viscose',
              largura: 1.6,
            }),
          })),
        })),
      };
    }

    return {
      doc: jest.fn(() => ({ get: jest.fn(async () => ({ exists: false })) })),
    };
  }),
  runTransaction: mockRunTransaction,
};

const mockFirestore = Object.assign(
  jest.fn(() => mockFirestoreInstance),
  {
    Timestamp: {
      now: mockTimestampNow,
      fromMillis: mockTimestampFromMillis,
    },
    FieldValue: {
      delete: mockFieldValueDelete,
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
const mockUploadImageToShopeeMultipart = jest.fn();

jest.mock('../services/shopee.service', () => ({
  ensureValidToken: (...args: unknown[]) => mockEnsureValidToken(...args),
  callShopeeApi: (...args: unknown[]) => mockCallShopeeApi(...args),
  uploadImageToShopeeMultipart: (...args: unknown[]) => mockUploadImageToShopeeMultipart(...args),
}));

const mockUpdateLastUsedValues = jest.fn();
const mockSaveUserPreferences = jest.fn();
jest.mock('../services/shopee-preferences.service', () => ({
  updateLastUsedValues: (...args: unknown[]) => mockUpdateLastUsedValues(...args),
  saveUserPreferences: (...args: unknown[]) => mockSaveUserPreferences(...args),
}));

const mockDownloadAndCompressImage = jest.fn();
const mockCompressImageToTarget = jest.fn();
jest.mock('../services/image-compressor.service', () => ({
  downloadAndCompressImage: (...args: unknown[]) => mockDownloadAndCompressImage(...args),
  compressImageToTarget: (...args: unknown[]) => mockCompressImageToTarget(...args),
}));

const mockBuildLogisticInfoForProduct = jest.fn();
jest.mock('../services/shopee-logistics.service', () => ({
  buildLogisticInfoForProduct: (...args: unknown[]) => mockBuildLogisticInfoForProduct(...args),
}));

const mockGetMandatoryAttributes = jest.fn();
const mockIsBrandMandatory = jest.fn();
jest.mock('../services/shopee-category.service', () => ({
  getMandatoryAttributes: (...args: unknown[]) => mockGetMandatoryAttributes(...args),
  isBrandMandatory: (...args: unknown[]) => mockIsBrandMandatory(...args),
}));

jest.mock('../services/shopee-item-limit.service', () => ({
  checkSizeChartSupport: jest.fn(),
  getSizeCharts: jest.fn(),
}));

const mockValidateProductForPublish = jest.fn();
const mockFormatItemName = jest.fn();
const mockFormatDescription = jest.fn();
jest.mock('../utils/shopee-validation', () => ({
  validateProductForPublish: (...args: unknown[]) => mockValidateProductForPublish(...args),
  formatItemName: (...args: unknown[]) => mockFormatItemName(...args),
  formatDescription: (...args: unknown[]) => mockFormatDescription(...args),
}));

import { publishProduct } from '../services/shopee-product.service';

describe('shopee-product.service publish rollback', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockProductState = {
      created_by: 'user-1',
      status: 'draft',
      item_id: null,
      shop_id: 123,
      tecido_id: 'tecido-1',
      tecido_nome: 'Viscolinho',
      tecido_sku: 'VSC-001',
      descricao: 'Descricao valida para publicacao.',
      preco_base: 79.9,
      estoque_padrao: 100,
      categoria_id: 1000,
      peso: 0.5,
      dimensoes: {
        comprimento: 30,
        largura: 25,
        altura: 4,
      },
      imagens_principais: ['https://cdn.example.com/main-image.jpg'],
      tier_variations: [
        {
          tier_name: 'Cor',
          options: [{ option_name: 'Azul' }],
        },
      ],
      modelos: [
        {
          tier_index: [0],
          model_sku: 'VSC-001-AZUL',
          preco: 79.9,
          estoque: 100,
        },
      ],
      logistic_info: [{ logistic_id: 1, enabled: true }],
      usar_imagens_publicas: false,
    };

    mockValidateProductForPublish.mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
    });
    mockFormatItemName.mockReturnValue('Titulo valido');
    mockFormatDescription.mockReturnValue('Descricao valida formatada');
    mockGetMandatoryAttributes.mockResolvedValue([]);
    mockIsBrandMandatory.mockResolvedValue(false);
    mockBuildLogisticInfoForProduct.mockResolvedValue([
      { logistic_id: 1, enabled: true, shipping_fee: 0 },
    ]);
    mockDownloadAndCompressImage.mockResolvedValue({
      buffer: Buffer.from('fake-image'),
      wasCompressed: false,
      originalSize: 100,
      finalSize: 100,
    });
    mockCompressImageToTarget.mockResolvedValue({
      buffer: Buffer.from('fake-image'),
      wasCompressed: false,
      originalSize: 100,
      finalSize: 100,
    });
    mockUploadImageToShopeeMultipart.mockResolvedValue({
      error: '',
      message: '',
      response: {
        image_info: {
          image_id: 'image-main-1',
        },
      },
    });
    mockEnsureValidToken.mockResolvedValue('token-ok');
    mockCallShopeeApi
      .mockResolvedValueOnce({
        error: '',
        message: '',
        response: { item_id: 987654321 },
      })
      .mockResolvedValueOnce({
        error: 'system_error',
        message: 'init_tier_variation falhou',
      })
      .mockResolvedValueOnce({
        error: '',
        message: '',
        response: {},
      });
  });

  it('executa delete_item e persiste status de erro quando init_tier_variation falha', async () => {
    jest.useFakeTimers();
    try {
      const publishPromise = publishProduct('prod-1', 'user-1');
      const capturedErrorPromise = publishPromise.then(() => null).catch((error: Error) => error);
      await jest.advanceTimersByTimeAsync(5000);

      const capturedError = await capturedErrorPromise;
      expect(capturedError).toBeInstanceOf(Error);
      expect(capturedError?.message).toContain('rollback add_item concluido');

      expect(mockCallShopeeApi).toHaveBeenNthCalledWith(1, expect.objectContaining({
        path: '/api/v2/product/add_item',
        method: 'POST',
      }));
      expect(mockCallShopeeApi).toHaveBeenNthCalledWith(2, expect.objectContaining({
        path: '/api/v2/product/init_tier_variation',
        method: 'POST',
      }));
      expect(mockCallShopeeApi).toHaveBeenNthCalledWith(3, expect.objectContaining({
        path: '/api/v2/product/delete_item',
        method: 'POST',
        body: { item_id: 987654321 },
      }));

      expect(mockEnsureValidToken).toHaveBeenCalledTimes(2);
      expect(mockUpdateLastUsedValues).not.toHaveBeenCalled();
      expect(mockSaveUserPreferences).not.toHaveBeenCalled();

      const hasPublishingUpdate = mockTransactionUpdate.mock.calls.some(([, payload]) =>
        (payload as Record<string, unknown>).status === 'publishing'
      );
      const errorUpdateCall = mockTransactionUpdate.mock.calls.find(([, payload]) =>
        (payload as Record<string, unknown>).status === 'error'
      );

      expect(hasPublishingUpdate).toBe(true);
      expect(errorUpdateCall).toBeDefined();
      expect((errorUpdateCall?.[1] as Record<string, unknown>).error_message).toContain('rollback add_item concluido');
      expect((errorUpdateCall?.[1] as Record<string, unknown>).publish_lock).toBe(mockFieldDeleteSentinel);
    } finally {
      jest.useRealTimers();
    }
  });
});
