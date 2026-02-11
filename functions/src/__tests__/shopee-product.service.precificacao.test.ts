const addMock = jest.fn();
const updateMock = jest.fn();
const nowTimestamp = { seconds: 1700000000, nanoseconds: 0 };

const tecidoDocMock = {
  exists: true,
  data: () => ({
    nome: 'Tecido Teste',
    sku: 'TST-01',
    largura: 1.5,
    composicao: '100% poliester',
    descricao: 'Descricao teste',
    imagemUrl: 'https://example.com/tecido.jpg',
  }),
};

const corTecidoSnapshotMock = {
  size: 1,
  docs: [
    {
      id: 'vinculo-1',
      data: () => ({
        tecidoId: 'tecido-1',
        corId: 'cor-1',
        corNome: 'Azul',
        corSku: 'AZL',
        imagemGerada: 'https://example.com/azul.jpg',
      }),
    },
  ],
};

const existingProduct = {
  created_by: 'user-1',
  status: 'draft',
  item_id: null,
  tecido_id: 'tecido-1',
  preco_base: 49.9,
  estoque_padrao: 10,
  modelos: [],
};

let updatedProductData: Record<string, unknown> = { ...existingProduct };
let getProductCallCount = 0;

const productDocRefMock = {
  get: jest.fn().mockImplementation(() => {
    getProductCallCount += 1;
    if (getProductCallCount === 1) {
      return Promise.resolve({ exists: true, data: () => existingProduct });
    }
    return Promise.resolve({ exists: true, id: 'prod-1', data: () => updatedProductData });
  }),
  update: updateMock,
};

const firestoreInstanceMock = {
  collection: jest.fn((collectionName: string) => {
    if (collectionName === 'tecidos') {
      return {
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue(tecidoDocMock),
        })),
      };
    }

    if (collectionName === 'cor_tecido') {
      return {
        where: jest.fn(() => ({
          get: jest.fn().mockResolvedValue(corTecidoSnapshotMock),
        })),
      };
    }

    if (collectionName === 'shopee_products') {
      return {
        add: addMock,
        doc: jest.fn(() => productDocRefMock),
      };
    }

    return {
      doc: jest.fn(() => ({ get: jest.fn().mockResolvedValue({ exists: false }) })),
    };
  }),
};

jest.mock('../config/firebase', () => {
  const firestoreFn = Object.assign(
    jest.fn(() => firestoreInstanceMock),
    {
      Timestamp: {
        now: jest.fn(() => nowTimestamp),
      },
    }
  );

  return {
    __esModule: true,
    default: {
      firestore: firestoreFn,
    },
  };
});

jest.mock('../services/shopee-preferences.service', () => ({
  getUserPreferences: jest.fn().mockResolvedValue(null),
}));

import { createProduct, updateProduct } from '../services/shopee-product.service';

describe('shopee-product.service precificacao', () => {
  beforeEach(() => {
    addMock.mockReset();
    updateMock.mockReset();
    productDocRefMock.get.mockClear();
    getProductCallCount = 0;
    updatedProductData = { ...existingProduct };

    addMock.mockResolvedValue({ id: 'prod-1' });
    updateMock.mockResolvedValue(undefined);
  });

  it('persiste precificacao no createProduct sem quebrar payload atual', async () => {
    const precificacao = {
      custo_metro: 10,
      margem_liquida_percentual: 20,
      comissao_percentual: 20,
      taxa_fixa_item: 4,
      valor_minimo_baixo_valor: 8,
      adicional_baixo_valor: 1,
      teto_comissao: 100,
      aplicar_teto: true,
      aplicar_baixo_valor: true,
    };

    await createProduct('user-1', {
      shop_id: 123,
      tecido_id: 'tecido-1',
      cores: [{ cor_id: 'cor-1', estoque: 10 }],
      tamanhos: ['1'],
      precos_por_tamanho: { '1': 79.9 },
      preco_base: 79.9,
      precificacao,
      estoque_padrao: 10,
      categoria_id: 1000,
      peso: 0.3,
      dimensoes: { comprimento: 30, largura: 30, altura: 10 },
    });

    expect(addMock).toHaveBeenCalledWith(expect.objectContaining({
      preco_base: 79.9,
      precificacao,
      precos_por_tamanho: { '1': 79.9 },
    }));
  });

  it('persiste precificacao no updateProduct sem exigir campos legados extras', async () => {
    const newPrecificacao = {
      custo_metro: 12,
      margem_liquida_percentual: 22,
      comissao_percentual: 20,
      taxa_fixa_item: 4,
      valor_minimo_baixo_valor: 8,
      adicional_baixo_valor: 1,
      teto_comissao: 90,
      aplicar_teto: true,
      aplicar_baixo_valor: true,
    };

    updatedProductData = {
      ...existingProduct,
      precificacao: newPrecificacao,
      updated_at: nowTimestamp,
    };

    await updateProduct('prod-1', 'user-1', {
      precificacao: newPrecificacao,
    });

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      precificacao: newPrecificacao,
    }));
  });
});