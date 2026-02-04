import axios from 'axios';

// Mock do firebase admin - DEVE vir antes de qualquer import que use firebase
const mockDoc = {
  get: jest.fn().mockResolvedValue({ exists: false, data: () => null }),
  set: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
};
const mockCollection = {
  doc: jest.fn(() => mockDoc),
  get: jest.fn().mockResolvedValue({ docs: [] }),
};
const mockFirestore = {
  collection: jest.fn(() => mockCollection),
};

jest.mock('../src/config/firebase', () => ({
  __esModule: true,
  default: {
    firestore: jest.fn(() => mockFirestore),
  },
}));

// Mock do axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Shopee Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAuthUrl', () => {
    it('deve retornar URL de autorização', async () => {
      const { getAuthUrl } = await import('../src/services/shopee.service');
      const url = getAuthUrl();

      expect(url).toBeTruthy();
      expect(typeof url).toBe('string');
      expect(url).toContain('auth_partner');
    });
  });

  describe('getAccessToken', () => {
    it('deve trocar código por tokens com sucesso', async () => {
      // Importar dinamicamente para evitar problemas de mock
      const { getAccessToken } = await import('../src/services/shopee.service');

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'test_access_token',
          refresh_token: 'test_refresh_token',
          expire_in: 14400,
          request_id: 'req_123',
          error: '',
          message: '',
        },
      });

      const result = await getAccessToken('test_code', 12345);

      expect(result.access_token).toBe('test_access_token');
      expect(result.refresh_token).toBe('test_refresh_token');
      expect(result.expire_in).toBe(14400);
    });

    it('deve lançar erro quando API retorna erro', async () => {
      const { getAccessToken } = await import('../src/services/shopee.service');

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          error: 'error_auth',
          message: 'Invalid code',
          access_token: '',
          refresh_token: '',
          expire_in: 0,
          request_id: 'req_123',
        },
      });

      await expect(getAccessToken('invalid_code', 12345)).rejects.toThrow('Shopee API Error');
    });

    it('deve lançar erro quando requisição falha', async () => {
      const { getAccessToken } = await import('../src/services/shopee.service');

      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));

      await expect(getAccessToken('test_code', 12345)).rejects.toThrow('Network error');
    });
  });

  describe('refreshAccessToken', () => {
    it('deve renovar token com sucesso', async () => {
      const { refreshAccessToken } = await import('../src/services/shopee.service');

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'new_access_token',
          refresh_token: 'new_refresh_token',
          expire_in: 14400,
          request_id: 'req_456',
          error: '',
          message: '',
        },
      });

      const result = await refreshAccessToken(12345, 'old_refresh_token');

      expect(result.access_token).toBe('new_access_token');
      expect(result.refresh_token).toBe('new_refresh_token');
    });

    it('deve lançar erro quando refresh token inválido', async () => {
      const { refreshAccessToken } = await import('../src/services/shopee.service');

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          error: 'error_auth',
          message: 'Invalid refresh token',
          access_token: '',
          refresh_token: '',
          expire_in: 0,
          request_id: 'req_789',
        },
      });

      await expect(refreshAccessToken(12345, 'invalid_token')).rejects.toThrow('Shopee API Error');
    });
  });
});
