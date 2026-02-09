---
name: firebase-patterns
description: Padrões e armadilhas do Firebase no RazaiSystem. Use quando trabalhar com Firestore, criar queries, índices, regras de segurança, deploy, ou resolver erros de Firebase.
---

# Padrões Firebase - RazaiSystem

## Project ID: `razaisystem`

## Regra #1: NUNCA usar undefined no Firestore

```typescript
// ERRADO - Firestore lança FAILED_PRECONDITION
await db.collection('x').doc('y').set({
  nome: data.nome,
  descricao: data.descricao,  // Se undefined → ERRO
});

// CORRETO - Omitir campo ou usar null
const docData: Record<string, unknown> = { nome: data.nome };
if (data.descricao) {
  docData.descricao = data.descricao;
}
await db.collection('x').doc('y').set(docData);

// CORRETO - Para deletar campo existente
updateData.campo = admin.firestore.FieldValue.delete();
```

## Regra #2: Soft-delete SEMPRE com deletedAt: null na criação

```typescript
// Toda entidade com soft-delete DEVE ter deletedAt: null ao criar
const data = {
  nome: 'Exemplo',
  deletedAt: null,  // OBRIGATÓRIO na criação
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
};

// Para deletar (soft)
await doc.update({
  deletedAt: admin.firestore.FieldValue.serverTimestamp(),
});

// Query para itens ativos
db.collection('x').where('deletedAt', '==', null).orderBy('createdAt', 'desc')
```

## Regra #3: Queries com where + orderBy precisam de índice composto

Se a query usa `where('campo1', '==', valor)` + `orderBy('campo2')`, é **obrigatório** ter um índice composto em `firestore.indexes.json`.

### Índices Existentes

| Collection | Campos | Tipo |
|---|---|---|
| `tecidos` | deletedAt ASC, createdAt DESC | Composite |
| `cores` | deletedAt ASC, createdAt DESC | Composite |
| `cor_tecido` | deletedAt ASC, createdAt DESC | Composite |
| `cor_tecido` | corId ASC, deletedAt ASC | Composite |
| `cor_tecido` | corId ASC, createdAt DESC | Composite |
| `cor_tecido` | tecidoId ASC, createdAt DESC | Composite |
| `cor_tecido` | tecidoId ASC, deletedAt ASC | Composite |
| `cor_tecido` | corId ASC, tecidoId ASC, deletedAt ASC | Composite |
| `estampas` | deletedAt ASC, createdAt DESC | Composite |
| `tamanhos` | deletedAt ASC, ordem ASC | Composite |
| `tamanhos` | deletedAt ASC, ativo ASC, ordem ASC | Composite |
| `tamanhos` | deletedAt ASC, ordem DESC | Composite |
| `shopee_products` | shop_id ASC, updated_at DESC | Composite |
| `shopee_products` | shop_id ASC, status ASC, updated_at DESC | Composite |
| `shopee_products` | item_id ASC, shop_id ASC | Composite |
| `shopee_product_templates` | created_by ASC, uso_count DESC | Composite |
| `shopee_sku_sales` | shop_id ASC, item_sku ASC, coletadoEm DESC | Composite |
| `ml_training_examples` | corId ASC, timestamp DESC | Composite |

### Adicionando Novo Índice

Editar `firestore.indexes.json`:
```json
{
  "collectionGroup": "nova_collection",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "campo1", "order": "ASCENDING" },
    { "fieldPath": "campo2", "order": "DESCENDING" }
  ]
}
```

Deploy: `npx firebase deploy --only firestore:indexes`

## Regras de Segurança (firestore.rules)

### Padrão: read/write para autenticados
```
match /collection/{docId} {
  allow read, write: if request.auth != null;
}
```
Coleções: `tecidos`, `cores`, `cor_tecido`, `estampas`, `tamanhos`, `shopee_products`, `shopee_user_preferences`, `shopee_product_templates`, `shopee_sku_sales`, `sku_control`, `sku_control_cor`, `ml_training_examples`, `ml_model_metadata`, `system_config`

### Padrão: read auth, write backend-only
```
match /collection/{docId} {
  allow read: if request.auth != null;
  allow write: if false;
}
```
Coleções: `shopee_shops`, `shopee_categories_cache`, `shopee_logistics_cache`, `shopee_webhook_logs`, `shopee_order_events`, `disabled_colors`

### Especial: catálogos (leitura pública)
```
match /catalogos/{catalogoId} {
  allow read: if true;
  allow write: if request.auth != null;
}
```

### Deny-all padrão
```
match /{document=**} {
  allow read, write: if false;
}
```

## Deploy

### PowerShell (Windows) - Usar `;` não `&&`
```powershell
# ERRADO
cd functions && npm run build && cd .. && npx firebase deploy

# CORRETO
cd functions; npm run build; cd ..; npx firebase deploy --only functions,hosting
```

### Comandos de Deploy
```powershell
# Backend (Cloud Functions)
cd functions; npm run build; cd ..; npx firebase deploy --only functions

# Frontend (Hosting)
cd frontend; npm run build; cd ..; npx firebase deploy --only hosting

# Tudo
cd functions; npm run build; cd ..; cd frontend; npm run build; cd ..; npx firebase deploy --only functions,hosting

# Apenas regras e índices
npx firebase deploy --only firestore:rules,firestore:indexes

# Storage rules
npx firebase deploy --only storage
```

### Build Backend
```powershell
cd functions; npm run build
# Saída em functions/lib/
```

### Build Frontend
```powershell
cd frontend; npm run build
# Saída em frontend/dist/
```

## Padrões de Código

### Backend (Admin SDK)
```typescript
import admin from '../config/firebase';
const db = admin.firestore();

// Timestamps
const now = admin.firestore.FieldValue.serverTimestamp();

// Batch writes (até 500 operações)
const batch = db.batch();
batch.set(ref, data);
await batch.commit();
```

### Frontend (Client SDK)
```typescript
import { db, auth, storage } from '@/config/firebase';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';

// Listener realtime
const q = query(collection(db, 'items'), where('deletedAt', '==', null));
const unsubscribe = onSnapshot(q, (snapshot) => { /* ... */ });
// SEMPRE limpar: return () => unsubscribe();
```

## Erros Comuns e Soluções

| Erro | Causa | Solução |
|---|---|---|
| `Cannot use "undefined" as a Firestore value` | Campo com valor undefined | Omitir campo ou usar null |
| `FAILED_PRECONDITION: missing index` | Query sem índice composto | Adicionar em firestore.indexes.json e deploy |
| `PERMISSION_DENIED` | Regra de segurança bloqueando | Verificar firestore.rules |
| `Token 'XX' não é separador válido` | PowerShell não aceita `&&` | Usar `;` para encadear |
| `@types/sharp in dependencies` | Tipo em dependencies ao invés de devDependencies | Manter em dependencies (Cloud Functions precisa) |
