# Arquitetura do Projeto

## Visão Geral

O RazaiSystem é um sistema completo de gerenciamento de tecidos, cores e estampas com integração ao marketplace Shopee. A arquitetura é totalmente baseada em Firebase, utilizando Cloud Functions para o backend e Hosting para o frontend.

## Arquitetura de Alto Nível

### Produção (Firebase)

```
┌──────────────────────┐
│   Usuários           │
│   (Navegador/Mobile) │
└──────────┬───────────┘
           │
           │ HTTPS
           │
┌──────────▼───────────┐
│  Firebase Hosting    │
│  (Frontend React)    │
└──────────┬───────────┘
           │
           │ /api/** rewrites
           │
┌──────────▼───────────┐         ┌─────────────────┐
│  Cloud Functions     │────────►│  Shopee API     │
│  (Express Backend)   │         │  (OAuth, CRUD)  │
└──────────┬───────────┘         └─────────────────┘
           │
           │ Admin SDK
           │
┌──────────▼───────────┐
│   Firebase Services  │
│   - Firestore        │
│   - Cloud Storage    │
│   - Authentication   │
│   - Scheduled Funcs  │
└──────────────────────┘
```

### Desenvolvimento Local

```
┌────────────────┐          ┌────────────────┐
│   Frontend     │          │  Backend Local │
│   Vite:3000    │◄────────►│  Express:5000  │
└────────┬───────┘          └────────┬───────┘
         │                           │
         │                           │
         │    ┌──────────────────────┘
         │    │
         │    │ Admin/Client SDK
         │    │
┌────────▼────▼─────┐
│  Firebase Services│
│  (Cloud)          │
└───────────────────┘
```

## Cloud Functions

### Estrutura

O backend é executado como Cloud Functions do Firebase:

```
functions/src/
├── index.ts          # Entry point - exporta functions
├── routes/           # 11 arquivos de rotas Express
│   ├── tecidos.routes.ts
│   ├── cores.routes.ts
│   ├── tamanhos.routes.ts
│   ├── shopee.routes.ts (OAuth, integração principal)
│   ├── shopee-webhook.routes.ts
│   ├── shopee-products.routes.ts
│   ├── shopee-categories.routes.ts
│   ├── shopee-logistics.routes.ts
│   ├── shopee-preferences.routes.ts
│   ├── shopee-templates.routes.ts
│   └── shopee-item-limit.routes.ts
├── services/         # Lógica de negócio (11 arquivos)
├── scheduled/        # Funções agendadas (cron)
│   ├── maintain-disabled-colors.ts
│   └── sync-shopee-products.ts
├── middleware/       # Auth middleware
└── types/            # TypeScript types
```

### Funções Exportadas

**HTTP Functions (API)**:
- `api`: Express app com todas as rotas em `/api/**`

**Scheduled Functions (Cron)**:
- `maintainDisabledColors`: Executa diariamente para manter cores desabilitadas
- `scheduledSyncShopeeProducts`: Sincroniza produtos Shopee periodicamente

### Deployment

Cloud Functions são automaticamente deployadas quando há push para produção:

```powershell
cd functions
npm run build
cd ..
firebase deploy --only functions
```

## Fluxo de Dados

### Autenticação

```
1. Usuário clica "Entrar com Google"
   ↓
2. Firebase Client SDK abre popup Google
   ↓
3. Usuário autentica
   ↓
4. Token ID retornado
   ↓
5. Frontend armazena token
   ↓
6. Requisições ao backend incluem token no header Authorization
   ↓
7. Backend valida token com Firebase Admin SDK
   ↓
8. Verifica se email está autorizado
   ↓
9. Permite ou bloqueia acesso
```

### Integração Shopee (OAuth + Publicação)

```
1. Usuário clica "Conectar Shopee"
   ↓
2. Frontend chama /api/shopee/auth-url (Cloud Function)
   ↓
3. Backend gera URL OAuth Shopee com shop_id + redirect_uri
   ↓
4. Usuário redireciona para Shopee e autentica
   ↓
5. Shopee retorna com auth code para callback URL
   ↓
6. Frontend envia code para /api/shopee/callback
   ↓
7. Backend troca code por access_token + refresh_token
   ↓
8. Tokens salvos em shopee_shops (collection backend-only)
   ↓
9. Frontend recebe confirmação de sucesso

**Publicação de Produto:**

1. Usuário cria rascunho em CriarAnuncioShopee.tsx
   ↓
2. Salva em shopee_products (status: "draft")
   ↓
3. Usuário clica "Publicar"
   ↓
4. Frontend chama /api/shopee/products/:id/publish
   ↓
5. Backend (shopee-product.service.ts):
   - Carrega imagens do tecido e cores
   - Comprime imagens com Sharp
   - Upload imagens para Shopee (multipart/form-data)
   ↓
6. Backend monta payload add_item (limpa undefined)
   ↓
7. Chama Shopee API add_item
   ↓
8. Atualiza shopee_products:
   - status: "created"
   - item_id: ID retornado pela Shopee
   ↓
9. Scheduled function sincroniza estoque periodicamente
```

### Captura de Cor (Bluetooth)

```
1. Usuário abre CapturaCor.tsx e clica "Conectar Colorímetro"
   ↓
2. Web Bluetooth API busca dispositivo LS173
   ↓
3. Usuário pareia dispositivo no dialog do navegador
   ↓
4. Frontend subscreve à characteristic (notify)
   ↓
5. Usuário pressiona botão físico do colorímetro
   ↓
6. Colorímetro envia pacote 64 bytes (header AB 44 + L/a/b)
   ↓
7. Frontend parse LAB (int16 little-endian ÷ 100)
   ↓
8. Calcula Delta E 2000 vs cores existentes
   ↓
9. Se Delta E < 3: mostra dialog de conflito
   - Opção 1: Usar cor existente
   - Opção 2: Criar nova cor
   ↓
10. Converte LAB → RGB → HEX
    ↓
11. Salva cor em Firestore (nome temporário)
    ↓
12. Cria vínculo cor-tecido (cor_tecido collection)
    ↓
13. Aplica Reinhard algorithm (frontend)
    ↓
14. Upload imagem tingida PNG para Storage
```

### Operações CRUD (Tecidos)

#### Create (Criar)

```
1. Usuário preenche formulário
   ↓
2. Validação no frontend
   ↓
3. UI Otimista: adiciona tecido temporário à lista
   ↓
4. Gera SKU único (useSku)
   ↓
5. Cria documento no Firestore (obtém ID real)
   ↓
6. Upload imagem para Storage usando ID real
   ↓
7. Atualiza documento com URL da imagem
   ↓
8. Substitui tecido temporário pelo real
   ↓
   [Se erro] Remove documento e invalida SKU
```

#### Read (Ler)

```
1. Hook useTecidos carrega ao montar componente
   ↓
2. Busca documentos em Firestore (onde deletedAt == null)
   ↓
3. Converte arrays antigos de composição para string
   ↓
4. Atualiza estado React
   ↓
5. Componente renderiza lista
```

#### Update (Atualizar)

```
1. Usuário edita tecido existente
   ↓
2. Validação no frontend
   ↓
3. UI Otimista: atualiza tecido na lista
   ↓
4. Se nova imagem: upload para Storage
   ↓
5. Atualiza documento no Firestore
   ↓
6. Recarrega lista para sincronização
   ↓
   [Se erro] Reverte para estado original
```

#### Delete (Excluir)

```
1. Usuário confirma exclusão
   ↓
2. UI Otimista: remove da lista imediatamente
   ↓
3. Invalida SKU (adiciona ao array invalidatedSkus)
   ↓
4. Soft delete: marca deletedAt no Firestore
   ↓
5. (Opcional) Remove imagem do Storage
   ↓
   [Se erro] Restaura tecido na lista
```

## Padrões de Design

### UI Otimista

O projeto implementa UI otimista em todas as operações CRUD:

**Vantagens**:
- Feedback imediato ao usuário
- Percepção de velocidade
- Melhor experiência do usuário

**Implementação**:
- Atualiza estado React antes da operação assíncrona
- Mostra estados visuais (loading, saving, deleting)
- Reverte automaticamente em caso de erro
- Usa toasts para feedback

### Separação de Responsabilidades

**Frontend**:
- UI/UX
- Validação de formulários
- Gerenciamento de estado local
- Comunicação com Firebase Client SDK

**Backend**:
- Validação de negócio
- Autenticação e autorização
- Operações administrativas (Firebase Admin SDK)
- API REST (opcional, para operações complexas)

**Firebase**:
- Armazenamento de dados (Firestore)
- Armazenamento de arquivos (Storage)
- Autenticação de usuários (Auth)

### Gerenciamento de Estado

**Context API**:
- `AuthContext`: Estado global de autenticação
- Observa mudanças no Firebase Auth
- Fornece funções de login/logout

**Hooks Customizados**:
- `useTecidos`: Estado e operações CRUD de tecidos
- `useSku`: Gerenciamento de SKUs
- `useAuth`: Acesso ao contexto de autenticação

**Estado Local**:
- Componentes gerenciam estado específico (modais, formulários)
- Navegação entre páginas via estado local

## Estrutura de Dados

### Firestore Collections

#### `tecidos`
```typescript
{
  id: string;              // Document ID
  nome: string;
  largura: number;         // Em metros
  composicao: string;      // Texto livre
  imagemPadrao: string;    // URL do Storage
  descricao?: string;
  sku: string;             // T001, T002, etc.
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp;   // Soft delete
}
```

#### `sku_control` (documento único para tecidos)
```typescript
{
  lastSkuNumber: number;   // Último número usado
  invalidatedSkus: string[]; // SKUs excluídos
}
```

#### `cores`
```typescript
{
  id: string;              // Document ID
  nome: string;
  hex: string;             // #RRGGBB
  lab?: { L, a, b };       // Valores LAB originais
  sku?: string;            // MA001, AZ002, etc. (por família)
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp;   // Soft delete
}
```

#### `sku_control_cor` (documento único para cores)
```typescript
{
  familias: {              // Contadores por família de cor
    MA: number;            // Marrom
    AZ: number;            // Azul
    // ...
  },
  prefixosReservados: {    // Prefixos já usados
    MA: string[];          // ["MA001", "MA002"]
    // ...
  }
}
```

#### `cor_tecido` (Vínculos Cor-Tecido)
```typescript
{
  id: string;              // Document ID
  sku?: string;            // TecidoSKU-CorSKU (ex: T007-MA001)
  corId: string;           // Referência à cor
  corNome: string;         // Denormalizado
  corHex?: string;         // Denormalizado
  corSku?: string;         // Denormalizado
  tecidoId: string;        // Referência ao tecido
  tecidoNome: string;      // Denormalizado
  tecidoSku?: string;      // Denormalizado
  imagemTingida?: string;  // URL PNG (resolução original)
  imagemComMarca?: string; // URL PNG com logo (cacheada)
  ajustesReinhard?: {      // Config do algoritmo Reinhard
    L, a, b, stdL, stdA, stdB, hueShift
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp;
}
```

#### `estampas` (Padrões Estampados)
```typescript
{
  id: string;
  nome: string;
  sku?: string;              // Primeira palavra + sequencial (ex: FLOR001)
  imagemUrl?: string;        // URL no Storage
  tecidoEstampadoId: string; // Referência ao tecido estampado
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp;
}
```

#### `tamanhos` (Tamanhos de Corte)
```typescript
{
  id: string;
  largura: number;           // Em metros
  altura: number;            // Em metros
  preco: number;             // Preço para este tamanho
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp;
}
```

#### `catalogos` (Catálogos Públicos)
```typescript
{
  id: string;
  nome: string;
  descricao?: string;
  tecidos: Array<{
    tecidoId: string;
    tecidoNome: string;
    cores: Array<{
      corId: string;
      corNome: string;
      imagemTingida: string;
    }>;
  }>;
  createdBy: string;         // UID do criador
  isPublic: boolean;         // true para acesso público
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `shopee_products` (Produtos/Rascunhos Shopee)
```typescript
{
  id: string;
  user_id: string;
  shop_id: number;
  item_id?: number;           // ID na Shopee (após publicação)
  tecido_id: string;
  tecido_nome: string;
  tecido_sku: string;
  imagens_principais: string[];
  tier_variations: TierVariation[];
  modelos: ProductModel[];    // Cada modelo pode ter tax_info { ncm, gtin, item_name_in_invoice }
  preco_base: number;
  estoque_padrao: number;
  categoria_id: number;
  peso: number;
  dimensoes: { comprimento, largura, altura };
  ncm_padrao?: string;        // NCM fiscal padrão
  status: 'draft' | 'publishing' | 'created' | 'error' | 'syncing';
  created_at: Timestamp;
  updated_at: Timestamp;
  deletedAt?: Timestamp;
}
```

#### `shopee_shops` (Tokens OAuth - Backend Only)
```typescript
{
  id: string;                // shop_id como string
  shop_id: number;
  access_token: string;
  refresh_token: string;
  expires_at: Timestamp;
  user_id: string;           // UID do proprietário
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

#### `shopee_categories_cache` (Cache de Categorias)
```typescript
{
  id: 'cache';               // Documento único
  categories: ShopeeCategory[];
  updated_at: Timestamp;     // TTL: 7 dias
}
```

#### `shopee_logistics_cache` (Cache de Logísticas)
```typescript
{
  id: 'cache';               // Documento único
  logistics: ShopeeLogistics[];
  updated_at: Timestamp;     // TTL: 7 dias
}
```

#### `shopee_user_preferences` (Preferências Shopee)
```typescript
{
  id: string;                 // UID do usuário
  preco_base_padrao?: number;
  estoque_padrao_padrao?: number;
  categoria_id_padrao?: number;
  categoria_nome_padrao?: string;
  peso_padrao?: number;
  dimensoes_padrao?: { comprimento, largura?, altura };
  ncm_padrao?: string;
  descricao_template?: string;
  ultimos_valores?: { preco_base, estoque_padrao, categoria_id, peso, dimensoes };
  updated_at: Timestamp;
}
```

#### `shopee_categories_cache` (Cache de Categorias)
```typescript
{
  categories: ShopeeCategory[];
  updated_at: Timestamp;       // Cache expira em 24h
}
```

#### `shopee_webhook_logs` (Logs de Webhook)
```typescript
{
  code: number;               // Código do evento (3, 8, 11, 16, 22, 27)
  event_name: string;
  shop_id: number;
  payload: object;
  processed: boolean;
  error?: string;
  received_at: Timestamp;
}
```

#### `ml_training_examples` (Exemplos de Treinamento ML)
```typescript
{
  id: string;
  features: number[];      // LAB + RGB + parâmetros
  label: number[];         // Ajustes corretos
  corId?: string;
  tecidoId?: string;
  createdAt: Timestamp;
}
```

### Firebase Storage

**Estrutura**:
```
tecidos/
  └── {tecidoId}/
      └── {timestamp}-{filename}

cor-tecido/
  └── {vinculoId}/
      ├── tingida_{timestamp}.png    # Imagem tingida (Reinhard)
      └── branded_{timestamp}.png    # Imagem com logo (removida)

estampas/
  └── {estampaId}/
      └── {timestamp}-{filename}

catalogos/
  └── {catalogoId}/
      └── preview_{timestamp}.png

shopee/
  └── compressed/
      └── {tecidoId}/
          └── {corId}_{timestamp}.jpg  # Imagens comprimidas para Shopee

ml_models/
  └── reinhard_model_{version}.json  # Modelos de ML treinados
```

**Exemplos**:
```
tecidos/MVdvaD8rVnzepSI36QvN/1770124976638-Branco-Neve.png
cor-tecido/abc123/tingida_1738784621234.png
estampas/xyz789/1738784621234-floral-primavera.png
shopee/compressed/MVdvaD8rVnzepSI36QvN/abc123_1738784621234.jpg
```

### Processamento de Imagens

**Frontend (Reinhard Algorithm)**:
- Algoritmo Reinhard para tingimento
- Output: PNG, resolução original, sem compressão
- Canvas API para processamento client-side
- Upload para Storage: `cor-tecido/{id}/tingida_{timestamp}.png`

**Backend (Sharp - Cloud Functions)**:
- Compressão para Shopee: JPEG 80% quality, max 2048px
- Serviço: `image-compressor.service.ts`
- Usado antes de upload para Shopee API

**Formato de Saída (Tingimento)**:
- PNG sempre (sem perda de qualidade)
- Resolução original preservada (sem limite de pixels)
- Sem compressão de qualidade
- Algoritmo Reinhard mantém textura de alta frequência

**Imagem com Marca (Removida)**:
- Funcionalidade foi removida por decisão de negócio
- Campo `imagemComMarca` ainda existe mas não é mais gerado

## Segurança

### Autenticação
- Firebase Authentication com Google Sign-In
- Validação de email autorizado nas Cloud Functions
- Tokens JWT (ID Token) para comunicação frontend-backend
- Middleware `authMiddleware` valida token em cada request

### Regras de Segurança Firestore

**Collections com autenticação obrigatória**:
```javascript
// tecidos, cores, cor_tecido, estampas, tamanhos
match /{collection}/{docId} {
  allow read: if request.auth != null && resource.data.deletedAt == null;
  allow create: if request.auth != null;
  allow update, delete: if request.auth != null;
}
```

**Collections backend-only (usuários não podem escrever)**:
```javascript
// shopee_shops, shopee_categories_cache, shopee_logistics_cache
match /shopee_shops/{shopId} {
  allow read: if request.auth != null;
  allow write: if false;  // Apenas Cloud Functions
}
```

**Collections públicas (read-only sem auth)**:
```javascript
// catalogos
match /catalogos/{catalogoId} {
  allow read: if true;  // Público
  allow write: if request.auth != null;
}
```

### Regras de Segurança Storage

```javascript
// Upload/download apenas autenticado
match /tecidos/{tecidoId}/{allPaths=**} {
  allow read, write: if request.auth != null;
}

// Catálogos públicos (apenas read)
match /catalogos/{catalogoId}/{allPaths=**} {
  allow read: if true;
  allow write: if request.auth != null;
}
```

### Segurança Shopee

**Webhooks**:
- Validação de assinatura obrigatória
- Endpoint: `/api/shopee/webhook` (sem authMiddleware)
- Valida HMAC SHA256 com partner_key

**OAuth Tokens**:
- Armazenados em `shopee_shops` (backend-only)
- Refresh automático antes de expirar
- Nunca expostos ao frontend

**API Calls**:
- Partner ID e Partner Key em environment variables
- Assinatura de todas as requests para Shopee
- Rate limiting via scheduled functions

### Validação

**Frontend**:
- Validação de formulários antes de enviar
- Validação de tipos de arquivo (imagens)
- Validação de tamanho de arquivo
- Validação de formato de cores (HEX, LAB)

**Cloud Functions**:
- `authMiddleware` em todas as rotas protegidas
- Validação de dados recebidos
- Sanitização de inputs
- Limpeza de valores `undefined` (Firestore rejeita)
- Validação de shop ownership (usuário só acessa suas lojas)

## Performance

### Otimizações Implementadas

1. **UI Otimista**: Reduz percepção de latência em todas as operações CRUD
2. **Lazy Loading**: Componentes React carregados sob demanda
3. **Índices Firestore**: Índices compostos para queries complexas (definidos em `firestore.indexes.json`)
4. **Cache de Categorias/Logísticas Shopee**: TTL de 7 dias, reduz chamadas à API Shopee
5. **Debounce em Processamento**: Evita processamento excessivo durante ajustes Reinhard
6. **Compressão de Imagens**: Sharp nas Cloud Functions para Shopee (JPEG 80%, max 2048px)
7. **Scheduled Functions**: Sincronização em background ao invés de real-time

### Cloud Functions Performance

**Cold Start**:
- Node.js 20 runtime
- Warm-up automático do Firebase
- Primeira request pode ter ~2-3s de latência
- Requests subsequentes: <500ms

**Otimizações**:
- Minimize dependencies para reduzir bundle size
- Evite imports desnecessários
- Use async/await para operações paralelas
- Cache de tokens Shopee em memória (dentro da function instance)

### Custos e Considerações

**Firestore**:
- Cobra por documento lido/escrito
- Soft-delete mantém histórico mas conta como storage
- Índices compostos não têm custo extra de leitura

**Storage**:
- Cobra por GB armazenado/mês
- Cobra por GB transferido (download)
- Imagens PNG tingidas podem ser grandes (sem compressão)

**Cloud Functions**:
- Cobra por invocações
- Cobra por GB-seconds (memória × tempo de execução)
- Scheduled functions executam mesmo sem tráfego

**Shopee API**:
- Rate limits por shop (calls/minuto)
- Penalidades por excesso de calls
- Cache recomendado para categorias/logísticas

### UI Otimista

UI otimista pode causar inconsistências temporárias:
- **Mitigação**: Rollback automático em caso de erro
- **Trade-off**: Melhor UX vs possível confusão temporária
- **Feedback**: Toasts claros sobre sucesso/erro

## Escalabilidade

### Pontos de Escala

**Frontend (Firebase Hosting)**:
- CDN global automático
- Componentes modulares e reutilizáveis
- Hooks customizados (22 hooks) para lógica compartilhada
- Separação clara de responsabilidades por feature

**Backend (Cloud Functions)**:
- Escala automática horizontal (instâncias sob demanda)
- Express app stateless (cada request independente)
- Middleware reutilizável (`authMiddleware`)
- Serviços isolados por responsabilidade (11 serviços)
- Scheduled functions para tarefas em background

**Firebase Services**:
- Firestore: Escala automaticamente até milhões de operações/dia
- Storage: Escala automaticamente de GB a TB
- Authentication: Suporta milhões de usuários
- Índices compostos para queries complexas

**Shopee Integration**:
- Múltiplas lojas suportadas
- Tokens por loja (isolamento)
- Cache de categorias/logísticas reduz load
- Scheduled sync ao invés de real-time (reduz custos)

### Limitações Atuais

**Frontend**:
- Navegação via estado local (não usa React Router)
- Sem paginação de listas (carrega tudo na memória)
- Sem cache local de dados (refetch sempre)
- Sem virtual scrolling para listas grandes

**Backend**:
- Sem rate limiting por usuário
- Sem retry automático em falhas de API Shopee
- Sem circuit breaker para APIs externas
- Sem queue system para operações em batch

**Dados**:
- Soft-delete cresce indefinidamente (sem purge automático)
- Sem compressão de imagens tingidas (PNGs grandes)
- Imagens Shopee comprimidas on-demand (poderia ser pré-comprimidas)

**Shopee**:
- Sincronização scheduled (não real-time via webhook)
- Sem retry exponencial backoff para API errors
- Rate limiting manual (não automático)

## Extensibilidade

### Adicionar Novos Módulos

1. Criar tipos em `types/`
2. Criar funções Firebase em `lib/firebase/`
3. Criar hook customizado em `hooks/`
4. Criar componentes em `components/`
5. Criar página em `pages/`
6. Adicionar rota de navegação em `Home.tsx`

### Adicionar Novas Funcionalidades

- Seguir padrões existentes
- Usar UI otimista para operações assíncronas
- Implementar validação adequada
- Adicionar feedback visual (toasts)
- Documentar em `docs/`

---

## Responsividade e UX Mobile

### Componentes de Layout Mobile
- **MobileBottomNav**: Navegação inferior em mobile (`md:hidden`)
- **EmptyState**: Estado vazio reutilizável com ícone, título e ação
- **ConfirmDialog**: Substitui `window.confirm()` com AlertDialog acessível

### Padrões Mobile
- **Tabelas**: Card view no mobile (`md:hidden`), tabela no desktop (`hidden md:block`)
- **Modais**: Fullscreen no mobile (`inset-0`), centrado no desktop (`sm:max-w-lg`)
- **Touch targets**: Mínimo 44px em botões interativos
- **Navegação**: Bottom nav com 4 itens fixos + menu expansível
- **Formulários**: 1 coluna no mobile, footer sticky com botões de ação

### Acessibilidade
- `aria-label` em todos os botões de ícone
- `role="navigation"` no MobileBottomNav
- `aria-current="page"` para item ativo
- Focus visible em elementos interativos
