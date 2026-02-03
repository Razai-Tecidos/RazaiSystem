---
name: test
description: Cria testes unitários ou de integração para o código. Acionado pelo usuário via /test.
---

Analise o código fornecido ou os arquivos indicados e crie testes apropriados.

## Diretrizes

- **Backend**: Use frameworks como Jest ou Vitest
- **Frontend**: Use Vitest + React Testing Library
- Crie testes que cubram casos de sucesso e erro
- Use mocks quando necessário (especialmente para Firebase)
- Mantenha testes simples e focados

## Estrutura de Testes

### Backend
- Criar em `backend/src/**/*.test.ts` ou `backend/tests/`
- Testar rotas, middlewares, funções utilitárias
- Mockar Firebase Admin SDK quando necessário

### Frontend
- Criar em `frontend/src/**/*.test.tsx` ou `frontend/src/**/*.spec.tsx`
- Testar componentes, hooks, funções utilitárias
- Mockar Firebase Client SDK quando necessário

## Exemplos

### Teste de Rota (Backend)

```typescript
import request from 'supertest';
import app from '../index';

describe('GET /api/health', () => {
  it('deve retornar status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
```

### Teste de Componente (Frontend)

```typescript
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('deve renderizar corretamente', () => {
    render(<MyComponent />);
    expect(screen.getByText('Texto esperado')).toBeInTheDocument();
  });
});
```

### Teste de Hook (Frontend)

```typescript
import { renderHook } from '@testing-library/react';
import { useCollection } from './useCollection';

describe('useCollection', () => {
  it('deve buscar dados do Firestore', async () => {
    const { result } = renderHook(() => useCollection('items'));
    // ... assertions
  });
});
```

## Quando Criar Testes

- Para novas funcionalidades críticas
- Para bugs corrigidos (regressão)
- Para funções utilitárias importantes
- Para componentes reutilizáveis

Sempre forneça testes que sejam úteis e manteníveis.
