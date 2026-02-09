---
name: backend-development
description: Guia para desenvolvimento backend no RazaiSystem. Use quando trabalhar em arquivos do functions/src/, criar rotas API, serviços, middlewares, ou trabalhar com Firebase Admin SDK, Express ou validações.
---

# Desenvolvimento Backend - RazaiSystem

## Stack

- **Runtime**: Node.js + Express + TypeScript (Firebase Cloud Functions)
- **Firebase**: Admin SDK (Firestore, Auth, Storage)
- **Deploy**: `npx firebase deploy --only functions`
- **Build**: `cd functions; npm run build` (saída em `functions/lib/`)

## Estrutura de Pastas

```
functions/src/
├── routes/           # 11 arquivos de rotas Express
├── services/         # 11 serviços (lógica de negócio)
├── types/            # 6 arquivos de tipos TypeScript
├── scheduled/        # Funções agendadas (Cloud Scheduler)
├── middleware/        # auth.middleware.ts
├── config/           # firebase.ts, shopee.ts, authorizedEmails.ts
├── utils/            # shopee-validation.ts
├── __tests__/        # Testes (Jest)
└── index.ts          # Entry point (Express app + exports Cloud Functions)
```

## Convenções

### Rotas
- Arquivo: `routes/[nome].routes.ts`
- Registrar em `index.ts` com `app.use('/api/[nome]', routes)`
- Rotas duplicadas sem `/api/` para compatibilidade: `app.use('/[nome]', routes)`

### Serviços
- Arquivo: `services/[nome].service.ts`
- Toda lógica de negócio fica no serviço, não na rota
- Rota chama serviço, serviço faz operações no Firestore/APIs

### Tipos
- Arquivo: `types/[nome].types.ts`
- Interfaces para requests, responses e models Firestore

### Funções Agendadas
- Arquivo: `scheduled/[nome].ts`
- Exportar em `index.ts`: `export { funcao } from './scheduled/[nome]'`

## Firebase Admin SDK

```typescript
import admin from '../config/firebase';
const db = admin.firestore();

// Timestamps
admin.firestore.FieldValue.serverTimestamp()
admin.firestore.Timestamp.now()

// NUNCA usar undefined em documentos Firestore - usar null ou omitir
```

## Padrão de Rota

```typescript
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await meuServico();
    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Erro:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
```

## Padrão de Serviço

```typescript
import admin from '../config/firebase';
const db = admin.firestore();

export async function criarItem(data: CriarItemData): Promise<string> {
  const docData: Record<string, unknown> = {
    nome: data.nome,
    deletedAt: null,  // OBRIGATÓRIO para soft-delete
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Campos opcionais: incluir SOMENTE se tem valor (nunca undefined)
  if (data.descricao) {
    docData.descricao = data.descricao;
  }

  const docRef = await db.collection('items').add(docData);
  return docRef.id;
}
```

## Padrão de Resposta

```typescript
// Sucesso
res.json({ success: true, data: { /* dados */ } });

// Erro de validação
res.status(400).json({ success: false, error: 'Mensagem' });

// Não autorizado
res.status(401).json({ success: false, error: 'Token inválido' });

// Erro interno
res.status(500).json({ success: false, error: error.message });
```

## Shopee API

Para endpoints Shopee, usar `callShopeeApi()` de `services/shopee.service.ts`:
```typescript
import { callShopeeApi, ensureValidToken } from '../services/shopee.service';

const accessToken = await ensureValidToken(shopId);
const data = await callShopeeApi({
  path: '/api/v2/product/get_item_list',
  method: 'GET',
  shopId,
  accessToken,
  query: { offset: 0, page_size: 50, item_status: 'NORMAL' },
});
```

**Exceção**: Upload de imagem usa `uploadImageToShopeeMultipart()` (multipart/form-data).
