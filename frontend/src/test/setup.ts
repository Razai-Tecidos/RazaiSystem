import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock do Firebase
vi.mock('@/config/firebase', () => ({
  auth: {
    currentUser: {
      uid: 'test-user-123',
      email: 'test@example.com',
      getIdToken: vi.fn().mockResolvedValue('mock-token-123'),
    },
    onAuthStateChanged: vi.fn((callback) => {
      callback({ uid: 'test-user-123', email: 'test@example.com' });
      return vi.fn();
    }),
  },
  db: {},
  storage: {},
}));

// Mock do fetch global
global.fetch = vi.fn();

// Mock do window.location
const mockLocation = {
  href: 'http://localhost:3000',
  pathname: '/',
  search: '',
  hash: '',
  assign: vi.fn(),
  replace: vi.fn(),
  reload: vi.fn(),
};

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

// Mock do window.history
Object.defineProperty(window, 'history', {
  value: {
    replaceState: vi.fn(),
    pushState: vi.fn(),
  },
  writable: true,
});

// Mock do sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// Reset mocks entre testes
beforeEach(() => {
  vi.clearAllMocks();
  (global.fetch as any).mockReset();
});
