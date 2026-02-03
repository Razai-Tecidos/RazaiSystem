---
name: backend-development
description: Guia para desenvolvimento backend no RazaiSystem. Use quando trabalhar em arquivos do backend/, criar rotas API, middlewares, ou trabalhar com Firebase Admin SDK, Express ou validações.
---

# Desenvolvimento Backend - RazaiSystem

## Stack

- **Runtime**: Node.js + Express + TypeScript
- **Firebase**: Admin SDK (Firestore, Auth, Storage)
- **Validação**: (adicionar conforme necessário)
- **CORS**: Configurado para frontend

## Estrutura de Pastas

```
backend/src/
├── routes/        # Rotas da API
├── middleware/    # Middlewares (auth, error handling)
├── types/         # Tipos TypeScript compartilhados
├── config/        # Configurações (firebase.ts)
└── index.ts       # Entry point do servidor
```

## Convenções

### Rotas

- Criar arquivos em `routes/[nome].routes.ts`
- Exportar router do Express
- Registrar em `index.ts` com prefixo `/api/[nome]`
- Usar async/await para operações assíncronas

### Middlewares

- Criar em `middleware/[nome].middleware.ts`
- Usar para autenticação, validação, error handling
- Aplicar globalmente ou em rotas específicas

### Tipos

- Criar interfaces/types em `types/[nome].types.ts`
- Exportar tipos compartilhados
- Usar para tipar requests, responses, models

### Firebase Admin SDK

```typescript
import admin from '../config/firebase';
// ou
import admin from '@/config/firebase';

const db = admin.firestore();
const auth = admin.auth();
```

## Workflows Comuns

### Criar Nova Rota

1. Criar arquivo `routes/[nome].routes.ts`
2. Definir rotas com Express Router
3. Registrar em `index.ts`:
   ```typescript
   import [nome]Routes from './routes/[nome].routes';
   app.use('/api/[nome]', [nome]Routes);
   ```

### Criar Middleware

1. Criar arquivo `middleware/[nome].middleware.ts`
2. Exportar função middleware
3. Aplicar em `index.ts` ou nas rotas

### Validar Dados

- Validar entrada de dados nas rotas
- Retornar erros apropriados (400, 401, 404, 500)
- Usar try/catch para tratamento de erros

### Usar Firebase Admin SDK

```typescript
// Firestore
const docRef = db.collection('collection').doc('id');
const snapshot = await docRef.get();

// Auth
const user = await auth.getUser(uid);
await auth.createUser({ email, password });

// Storage (se necessário)
const bucket = admin.storage().bucket();
```

## Padrões de Resposta

### Sucesso

```typescript
res.status(200).json({
  success: true,
  data: { /* dados */ }
});
```

### Erro

```typescript
res.status(400).json({
  success: false,
  error: 'Mensagem de erro'
});
```

## Exemplos

### Rota Básica

```typescript
import { Router } from 'express';
import admin from '../config/firebase';

const router = Router();
const db = admin.firestore();

router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('items').get();
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao buscar itens' 
    });
  }
});

export default router;
```

### Middleware de Autenticação

```typescript
import { Request, Response, NextFunction } from 'express';
import admin from '../config/firebase';

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
}
```

### Tratamento de Erros

```typescript
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Erro interno do servidor' 
      : err.message
  });
});
```

### Tipos TypeScript

```typescript
// types/user.types.ts
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
}
```

### Rota com Validação e Tipos

```typescript
import { Router, Request, Response } from 'express';
import admin from '../config/firebase';
import { CreateUserRequest } from '../types/user.types';

const router = Router();
const db = admin.firestore();
const auth = admin.auth();

router.post('/users', async (req: Request<{}, {}, CreateUserRequest>, res: Response) => {
  try {
    const { email, password, name } = req.body;

    // Validação básica
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email, senha e nome são obrigatórios'
      });
    }

    // Criar usuário no Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name
    });

    // Salvar dados adicionais no Firestore
    await db.collection('users').doc(userRecord.uid).set({
      email,
      name,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(201).json({
      success: true,
      data: { uid: userRecord.uid, email, name }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao criar usuário'
    });
  }
});

export default router;
```
