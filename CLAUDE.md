# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

RazaiSystem is a full-stack fabric management system with Shopee marketplace integration, built on Firebase.

### Stack
- **Backend**: Firebase Cloud Functions (Express + TypeScript) in `functions/src/`
- **Frontend**: React 18 + Vite + TypeScript + shadcn/ui + Tailwind CSS in `frontend/src/`
- **Database**: Firestore (NoSQL document database)
- **Auth**: Firebase Authentication (Google Sign-In)
- **Storage**: Firebase Storage (images and files)
- **External API**: Shopee Open Platform v2

### Deployment Architecture
- **Frontend**: Firebase Hosting serves static build from `frontend/dist/`
- **Backend**: Cloud Functions expose Express API at `/api/**` via Firebase Hosting rewrite
- **Single Firebase Project**: All services (Hosting, Functions, Firestore, Storage, Auth) in one project

## Development Commands

### Initial Setup
```bash
# Install all dependencies (root, backend, frontend)
npm run install:all

# Or install separately
cd backend && npm install
cd frontend && npm install
cd functions && npm install
```

### Running Locally
```bash
# Run both backend and frontend simultaneously (recommended)
npm run dev

# Or run separately
npm run dev:backend   # Backend on http://localhost:5000
npm run dev:frontend  # Frontend on http://localhost:3000
```

### Building
```bash
# Build everything
npm run build

# Build separately
npm run build:backend
npm run build:frontend
cd functions && npm run build
```

### Testing
```bash
# Backend tests (in backend/ directory)
npm test              # Run tests once
npm run test:watch    # Watch mode
npm run test:coverage # With coverage

# Frontend tests (in frontend/ directory)
npm test              # Run tests once
npm run test:watch    # Watch mode
npm run test:coverage # With coverage

# Cloud Functions tests (in functions/ directory)
npm test
```

### Deployment (Firebase)
```bash
# Deploy everything
firebase deploy

# Deploy specific services
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage:rules

# Combined deployments
firebase deploy --only firestore:rules,firestore:indexes
```

**Note for Windows/PowerShell**: Use `;` to chain commands, NOT `&&`:
```powershell
cd functions; npm run build; cd ..; firebase deploy --only functions
```

## Critical Technical Rules

### Firestore Rules
1. **NEVER send `undefined` to Firestore**: Use `null` or omit the field entirely. Firestore will reject `undefined` values.
2. **Soft-delete pattern**: Always include `deletedAt: null` when creating documents. To delete, set `deletedAt: serverTimestamp()`.
3. **Composite indexes required**: Queries with `where` + `orderBy` on different fields need composite indexes defined in `firestore.indexes.json`.

### Shopee API Integration (Validated in Production 2026-02-09)
1. **seller_stock at TWO levels**: `seller_stock: [{ stock: N }]` required BOTH at item top-level AND inside each model. Do NOT use `stock_info_v2` (that's for update_stock only)
2. **brand requires BOTH fields**: `{ brand_id: 0, original_brand_name: "No Brand" }` — omitting `original_brand_name` causes error
3. **Image uses image_id, NOT URL**: Item: `image_id_list`, variation: `image_id` (IDs from upload endpoint)
4. **Image upload**: `multipart/form-data` via `/api/v2/mediaspace/upload_image` (no underscore). Max 2MB, compress with Sharp first
5. **Payload cleaning**: Always run `removeUndefinedValues()` before calling `add_item` API
6. **Price by size**: Prices defined per SIZE (`precos_por_tamanho`), not per color
7. **Nonexistent endpoints**: `get_attributes` → use `get_attribute_tree`; `media_space/upload_image` → use `mediaspace/upload_image`
8. **Full reference**: See `docs/SHOPEE_API_REFERENCIA.md` for validated payload and all endpoint paths

### Data Formatting (Brazilian Standards)
1. **Decimal separator**: Use comma (`,`) for display, convert to period (`.`) for storage
2. **Width units**: Always in meters (e.g., `1,50` meters, not centimeters)
3. **SKU format**:
   - Tecidos: `T001`, `T002`, etc.
   - Cores: `AZ001` (family prefix + sequential number)
   - Vínculos (cor-tecido): `T007-AZ001` (TecidoSKU-CorSKU)

### UI/UX Patterns
1. **Optimistic UI**: Update UI immediately, rollback on error
2. **Toast notifications**: Provide feedback for all user actions
3. **Composition field**: Free-text textarea, not structured fields
4. **Loading states**: Show visual feedback during async operations

## Code Structure

### Backend (functions/src/)
```
functions/src/
├── routes/          # 11 Express Router files
│   ├── tecidos.routes.ts
│   ├── cores.routes.ts
│   ├── shopee.routes.ts (main Shopee routes)
│   ├── shopee-webhook.routes.ts (webhook handling)
│   ├── shopee-products.routes.ts
│   ├── shopee-categories.routes.ts
│   ├── shopee-logistics.routes.ts
│   ├── shopee-preferences.routes.ts
│   ├── shopee-templates.routes.ts
│   ├── shopee-item-limit.routes.ts
│   └── tamanhos.routes.ts
├── services/        # Business logic layer
│   ├── shopee.service.ts (core Shopee API client)
│   ├── shopee-product.service.ts
│   ├── shopee-category.service.ts
│   ├── shopee-logistics.service.ts
│   ├── shopee-preferences.service.ts
│   ├── shopee-template.service.ts
│   ├── shopee-sync.service.ts
│   ├── shopee-webhook.service.ts
│   ├── shopee-item-limit.service.ts
│   ├── tamanho.service.ts
│   └── image-compressor.service.ts
├── scheduled/       # Scheduled Cloud Functions
│   ├── maintain-disabled-colors.ts
│   └── sync-shopee-products.ts
├── middleware/      # Express middleware
│   └── auth.middleware.ts
├── types/           # TypeScript type definitions
├── config/          # Firebase and Shopee configuration
└── index.ts         # Express app setup and function exports
```

### Frontend (frontend/src/)
```
frontend/src/
├── pages/           # 18 React pages (one per route)
│   ├── Login.tsx
│   ├── Home.tsx
│   ├── Tecidos.tsx
│   ├── Cores.tsx
│   ├── EditarCor.tsx
│   ├── Vinculos.tsx
│   ├── EditarVinculo.tsx
│   ├── CapturaCor.tsx (Bluetooth colorimeter integration)
│   ├── Estampas.tsx
│   ├── Tamanhos.tsx
│   ├── Catalogo.tsx
│   ├── CatalogoPublico.tsx
│   ├── Shopee.tsx (OAuth flow)
│   ├── AnunciosShopee.tsx
│   ├── CriarAnuncioShopee.tsx
│   ├── PreferenciasShopee.tsx
│   ├── TemplatesShopee.tsx
│   ├── MLDiagnostico.tsx
│   └── Funcionarios/ (folder with employee pages)
├── components/      # React components organized by feature
│   ├── Layout/      # Header, BreadcrumbNav
│   ├── Tecidos/     # Fabric components
│   ├── Cores/       # Color components
│   ├── Estampas/    # Pattern components
│   ├── Shopee/      # Shopee integration components
│   ├── Catalogo/    # Catalog components
│   └── ui/          # shadcn/ui components
├── hooks/           # 22 custom React hooks
│   ├── useAuth.ts
│   ├── useTecidos.ts
│   ├── useCores.ts
│   ├── useEstampas.ts
│   ├── useTamanhos.ts
│   ├── useShopee.ts
│   ├── useCapturaCor.ts (Bluetooth colorimeter)
│   └── use-toast.ts
├── lib/             # Utilities and helpers
│   ├── firebase/    # Firebase CRUD operations
│   ├── utils.ts     # General utilities
│   ├── colorUtils.ts # Color conversion (RGB, LAB, HEX)
│   └── deltaE.ts    # Delta E 2000 color difference calculation
├── context/         # React Context API
│   └── AuthContext.tsx
├── types/           # TypeScript type definitions
└── config/          # Firebase client configuration
```

## Key Firestore Collections

- **tecidos**: Fabrics (nome, tipo, largura, composicao, gramatura, SKU, imagem)
- **cores**: Colors (nome, hex, lab, sku)
- **cor_tecido**: Color-fabric links (sku, imagemTingida, ajustesReinhard, denormalized fields)
- **estampas**: Patterns (nome, sku, imagemUrl, tecidoEstampadoId)
- **tamanhos**: Sizes (largura, altura, preco for fabric cuts)
- **shopee_products**: Draft and published Shopee listings
- **shopee_shops**: OAuth tokens (backend write-only)
- **shopee_categories_cache**: Cached Shopee categories (backend write-only)
- **shopee_logistics_cache**: Cached Shopee logistics (backend write-only)
- **catalogos**: Public shareable catalogs (read-only URLs)

All collections use soft-delete pattern with `deletedAt` field.

## Authentication & Authorization

### Firebase Authentication
- **Provider**: Google Sign-In only
- **Authorized emails**: Configured in backend (not in code for security)
- **Token validation**: All protected routes use `authMiddleware` which verifies Firebase ID tokens

### Protected Routes Pattern
```typescript
import { authMiddleware } from './middleware/auth.middleware';

router.get('/protected', authMiddleware, (req, res) => {
  // req.user contains authenticated user info (uid, email, name)
  res.json({ user: req.user });
});
```

## Image Processing

### Reinhard Color Transfer Algorithm
- **Purpose**: Apply captured color to fabric image (dyeing simulation)
- **Input**: Fabric image + target LAB color
- **Output**: PNG image at original resolution (no compression)
- **Adjustable parameters**: Sliders in EditarVinculo.tsx for fine-tuning
- **Storage**: Final PNG saved to Firebase Storage

### Colorimeter Integration (CapturaCor.tsx)
- **Device**: LS173 colorimeter via Web Bluetooth API
- **Protocol**: 64-byte packets, header `AB 44`, L/a/b values as int16 little-endian ÷ 100
- **Validation**: Delta E 2000 color difference to detect duplicates
- **Conflict resolution**: User chooses to use existing color or create new

## Shopee Integration Architecture

### OAuth Flow
1. User clicks "Conectar Shopee" → redirects to Shopee authorization page
2. Shopee redirects back with auth code → backend exchanges for access/refresh tokens
3. Tokens stored in `shopee_shops` collection (backend only)
4. Scheduled function refreshes tokens before expiry

### Product Publishing Flow (3 API calls)
1. Draft created in `shopee_products` (status: "draft")
2. Read draft, verify permission (`created_by === userId`)
3. Fetch fabric data, validate payload (pre-publish checks)
4. Acquire transactional lock (`publish_lock` with TTL)
5. Status → "publishing", ensure valid OAuth token
6. Fetch logistics channels, compress images (Sharp, max 2MB)
7. Upload main images + variation color images → get `image_id`s
8. Build payload with `seller_stock` at BOTH levels, `brand`, `removeUndefinedValues()`
9. POST `/api/v2/product/add_item` (item base, NO tier/model)
10. Wait 5 seconds (Shopee processing time)
11. POST `/api/v2/product/init_tier_variation` (tiers + models)
12. Wait 5 seconds, then POST `/api/v2/product/update_item` for 3:4 images (with retry on "not_found")
13. Persist `item_id`, status → "created", `published_at`
14. On partial failure: rollback via `delete_item`
- **Dry-run**: `POST /:id/publish?dry_run=true` — runs steps 1-8, returns payload without API calls

### Attribute Auto-Fill (CategoryAttributes)
- Component: `frontend/src/components/Shopee/CategoryAttributes.tsx`
- Auto-fills attributes from fabric data via `tecidoData` prop:
  - **Material**: Extracted from `composicao` (e.g., "Poliester e Elastano")
  - **Estampa/Pattern**: Based on `tipo` ("liso" → "Lisa", "estampado" → "Estampada")
  - **Largura/Width**: From `largura` with `value_unit: "m"`
  - **Comprimento/Length**: From selected tamanhos with `value_unit: "m"` (multi-value)
- Uses `ATTR_UNITS` map for attributes requiring `value_unit`
- COMBO_BOX free-text: `value_id: 0` + `original_value_name` + optional `value_unit`
- Auto-fill runs once when attributes load (guarded by `autoFilledRef`)

### Webhook Handling
- **Endpoint**: `/api/shopee/webhook`
- **Events**: Order updates, stock changes, product updates
- **Signature verification**: Validates Shopee signature before processing
- **Processing**: Updates local Firestore collections based on webhook data

### Scheduled Functions
1. **maintainDisabledColors**: Runs daily, manages color availability
2. **scheduledSyncShopeeProducts**: Syncs Shopee inventory with local database

## Common Patterns

### Optimistic UI Updates
```typescript
// 1. Update UI immediately
setItems([...items, newItem]);

// 2. Attempt server operation
try {
  await saveToFirestore(newItem);
  toast({ title: "Salvo com sucesso" });
} catch (error) {
  // 3. Rollback on error
  setItems(items);
  toast({ title: "Erro ao salvar", variant: "destructive" });
}
```

### Brazilian Number Formatting
```typescript
// Display: Use comma
<input placeholder="Ex: 1,50" />

// Storage: Convert to period
const value = inputValue.replace(',', '.');
await firestore.collection('tecidos').add({ largura: parseFloat(value) });

// Read: Convert back to comma
<span>{largura.toString().replace('.', ',')}</span>
```

### Firestore Safe Writes
```typescript
// ❌ WRONG - undefined will cause error
const data = {
  name: 'Tecido',
  optional: undefined  // ERROR!
};

// ✅ CORRECT - use null or omit
const data = {
  name: 'Tecido',
  optional: null  // or just don't include it
};

// Use helper to clean payloads
function removeUndefinedValues(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (_, v) => v === undefined ? null : v));
}
```

## Environment Variables

### Backend (.env in backend/)
```
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### Frontend (.env in frontend/)
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=razaisystem
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

### Cloud Functions (.env in functions/)
```
SHOPEE_PARTNER_ID=...
SHOPEE_PARTNER_KEY=...
SHOPEE_REDIRECT_URL=...
```
**Windows `.env` gotcha**: `.env` files on Windows have `\r\n` line endings. Manual parsing must split on `/\r?\n/` and `.trim()` values, or `\r` gets appended to values and silently breaks API credentials.

## Documentation Files

- **CONTEXT.md**: Technical decisions and patterns (critical reference)
- **README.md**: Project overview and setup instructions
- **docs/ARCHITECTURE.md**: Detailed architecture documentation
- **docs/COMPONENTS.md**: Component documentation
- **docs/HOOKS.md**: Custom hooks documentation
- **docs/DEPLOY_FIREBASE.md**: Deployment guide
- **docs/SHOPEE_*.md**: Shopee API reference and guides
- **frontend/src/docs/*.md**: Feature-specific documentation (TECIDOS.md, ESTAMPAS.md, CAPTURA_COR.md, REINHARD.md)

## Important Notes

1. **Read CONTEXT.md first**: Contains critical technical decisions and patterns that prevent repeating past mistakes
2. **Compatibility**: Handle legacy data formats (e.g., `composicao` was array, now string)
3. **Windows environment**: Project runs on Windows, use PowerShell conventions
4. **No test coverage**: Tests exist but may not be comprehensive
5. **Authorized emails**: Not stored in code - configured separately for security
6. **Firebase config files**: `backend/config/firebase-adminsdk.json` is gitignored
7. **SKU generation**: Sequential per family, never reuse deleted SKUs
8. **Image quality**: PNG format, original resolution, no compression for color accuracy
