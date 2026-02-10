# RazaiSystem

Sistema completo de gerenciamento de tecidos, cores e estampas com integração ao marketplace Shopee. Desenvolvido com Firebase, TypeScript e React.

## Stack Tecnológica

- **Backend**: Firebase Cloud Functions + Express + TypeScript
- **Frontend**: React 18 + Vite + TypeScript + shadcn/ui + Tailwind CSS
- **Banco de Dados**: Cloud Firestore
- **Autenticação**: Firebase Authentication (Google Sign-In)
- **Storage**: Firebase Cloud Storage
- **Processamento de Imagens**: Sharp (Node.js)
- **Integração Externa**: Shopee Open Platform API v2

## Estrutura do Projeto

```
RazaiSystem/
├── functions/         # Firebase Cloud Functions (Backend API)
│   └── src/
│       ├── routes/    # 11 arquivos de rotas Express
│       ├── services/  # Lógica de negócio
│       ├── scheduled/ # Funções agendadas
│       └── types/     # Tipos TypeScript
├── frontend/          # Aplicação React + Vite
│   └── src/
│       ├── pages/     # 19 páginas React
│       ├── components/# Componentes organizados por feature
│       ├── hooks/     # 24 custom hooks
│       └── lib/       # Utilitários e helpers
├── backend/           # Backend local (desenvolvimento)
├── docs/              # Documentação completa
├── .cursor/           # Configurações e skills do Cursor IDE
├── firestore.rules    # Regras de segurança Firestore
├── firestore.indexes.json  # Índices compostos
├── storage.rules      # Regras de segurança Storage
└── firebase.json      # Configuração Firebase
```

## Pré-requisitos

- Node.js (versão 18 ou superior)
- npm ou yarn
- Firebase CLI instalado globalmente: `npm install -g firebase-tools`
- Conta Google para autenticação

## Instalação

### 1. Instalar Firebase CLI (Global)

```bash
npm install -g firebase-tools
firebase login
```

### 2. Instalar Dependências

```bash
# Instalar dependências de todos os projetos
npm run install:all
```

Ou instalar separadamente:

```powershell
# Cloud Functions (Backend)
cd functions; npm install; cd ..

# Frontend
cd frontend; npm install; cd ..

# Backend local (desenvolvimento)
cd backend; npm install; cd ..
```

### 3. Rodar o Projeto

**Desenvolvimento Local (Recomendado)**

```bash
# Na raiz do projeto - inicia backend e frontend simultaneamente
npm run dev
```

Isso iniciará:
- **Backend local**: `http://localhost:5000`
- **Frontend**: `http://localhost:3000`

**Desenvolvimento com Cloud Functions (Emulador)**

```powershell
# Terminal 1 - Emulador de Cloud Functions
cd functions; npm run serve

# Terminal 2 - Frontend
cd frontend; npm run dev
```

**Rodar separadamente**

```powershell
# Backend local
cd backend; npm run dev

# Frontend
cd frontend; npm run dev
```

### 4. Configurar Firebase

1. Acesse o [Firebase Console](https://console.firebase.google.com/)
2. Crie um novo projeto ou use um existente
3. Configure os serviços:
   - **Authentication** → Habilite Google Sign-In
   - **Firestore Database** → Crie banco de dados
   - **Storage** → Ative o Cloud Storage
4. Baixe as credenciais:
   - **Frontend**: Copie as configurações web para `.env` no frontend
   - **Backend**: Baixe `firebase-adminsdk.json` e coloque em `backend/config/`

### 5. Deploy de Regras e Índices

```bash
# Deploy regras de segurança e índices
firebase deploy --only firestore:rules,firestore:indexes,storage:rules
```

### 6. Configurar Email Autorizado

A autenticação é restrita por email. Configure emails autorizados no Firebase Console ou via código (detalhes em produção).

## Scripts

### Na Raiz do Projeto

- `npm run dev` - Inicia backend local e frontend simultaneamente
- `npm run dev:backend` - Inicia apenas o backend local
- `npm run dev:frontend` - Inicia apenas o frontend
- `npm run build` - Compila backend e frontend
- `npm run build:backend` - Compila apenas o backend
- `npm run build:frontend` - Compila apenas o frontend
- `npm run install:all` - Instala dependências de todos os projetos

### Cloud Functions (dentro de `functions/`)

- `npm run build` - Compila TypeScript para Cloud Functions
- `npm run serve` - Inicia emulador local de Cloud Functions
- `npm run deploy` - Deploy das functions para produção
- `npm test` - Executa testes

### Backend Local (dentro de `backend/`)

- `npm run dev` - Inicia servidor em modo desenvolvimento
- `npm run build` - Compila TypeScript
- `npm start` - Inicia servidor em produção
- `npm test` - Executa testes
- `npm run test:watch` - Testes em modo watch
- `npm run test:coverage` - Testes com cobertura

### Frontend (dentro de `frontend/`)

- `npm run dev` - Inicia servidor de desenvolvimento Vite
- `npm run build` - Build de produção
- `npm run preview` - Preview do build
- `npm test` - Executa testes
- `npm run test:watch` - Testes em modo watch
- `npm run test:coverage` - Testes com cobertura

## Autenticação

O sistema usa **Google Sign-In** através do Firebase Authentication. Apenas emails autorizados podem acessar o sistema.

### Fluxo de Autenticação

1. Usuário clica em "Entrar com Google"
2. Firebase abre popup de autenticação Google
3. Usuário seleciona conta Google
4. Sistema verifica se o email está autorizado
5. Se autorizado, permite acesso
6. Se não autorizado, bloqueia acesso

### Rotas Protegidas

Rotas que requerem autenticação devem usar o middleware `authMiddleware`:

```typescript
import { authMiddleware } from './middleware/auth.middleware';

app.get('/api/rota-protegida', authMiddleware, (req, res) => {
  // req.user contém informações do usuário autenticado
  res.json({ user: req.user });
});
```

## Variáveis de Ambiente

### Backend Local (.env em `backend/`)

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### Frontend (.env em `frontend/`)

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=razaisystem
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

### Cloud Functions

Variáveis de ambiente configuradas via Firebase Console ou Firebase CLI:
- Configurações Shopee (partner_id, partner_key, shop_id)
- URLs de callback OAuth
- Outras configurações sensíveis

**Nota**: Cloud Functions não usa arquivo `.env`, use `firebase functions:config:set`

## Segurança

⚠️ **IMPORTANTE**: 
- Nunca commite arquivos de credenciais Firebase no repositório
- O arquivo `backend/config/firebase-adminsdk.json` está no `.gitignore`
- Configure sempre pelo menos um email autorizado em produção
- Emails não autorizados serão bloqueados automaticamente

## Desenvolvimento

O projeto está configurado com:
- TypeScript para tipagem forte
- CORS configurado para comunicação frontend-backend
- Proxy no Vite para desenvolvimento
- Paths/aliases TypeScript para imports organizados (@/components, @/lib, etc)
- Autenticação Firebase com restrição de acesso por email

## Estrutura Detalhada

### Cloud Functions (Backend Principal)
```
functions/
├── src/
│   ├── routes/         # Rotas Express (11 arquivos)
│   │   ├── tecidos.routes.ts         # CRUD de tecidos
│   │   ├── cores.routes.ts           # CRUD de cores
│   │   ├── tamanhos.routes.ts        # CRUD de tamanhos
│   │   ├── shopee.routes.ts          # API Shopee (OAuth, produtos)
│   │   ├── shopee-webhook.routes.ts  # Webhooks Shopee
│   │   ├── shopee-products.routes.ts # Gerenciamento produtos
│   │   ├── shopee-categories.routes.ts
│   │   ├── shopee-logistics.routes.ts
│   │   ├── shopee-preferences.routes.ts
│   │   ├── shopee-templates.routes.ts
│   │   └── shopee-item-limit.routes.ts
│   ├── services/       # Lógica de negócio (11 arquivos)
│   │   ├── shopee.service.ts         # Cliente API Shopee
│   │   ├── shopee-product.service.ts # Gestão produtos
│   │   ├── shopee-sync.service.ts    # Sincronização
│   │   ├── shopee-webhook.service.ts # Processamento webhooks
│   │   ├── image-compressor.service.ts # Compressão Sharp
│   │   └── tamanho.service.ts
│   ├── scheduled/      # Funções agendadas (cron)
│   │   ├── maintain-disabled-colors.ts
│   │   └── sync-shopee-products.ts
│   ├── middleware/     # Middlewares Express
│   │   └── auth.middleware.ts
│   ├── types/          # Tipos TypeScript (6 arquivos)
│   ├── config/         # Configurações Firebase e Shopee
│   └── index.ts        # Entry point e export de functions
└── package.json
```

### Frontend
```
frontend/
├── src/
│   ├── pages/          # Páginas React (19 arquivos)
│   │   ├── Login.tsx
│   │   ├── Home.tsx
│   │   ├── Tecidos.tsx
│   │   ├── Cores.tsx
│   │   ├── EditarCor.tsx
│   │   ├── Vinculos.tsx            # Gestão vínculos cor-tecido
│   │   ├── GestaoImagens.tsx       # Gestão de imagens e mosaicos
│   │   ├── EditarVinculo.tsx       # Editor Reinhard
│   │   ├── CapturaCor.tsx          # Bluetooth colorímetro
│   │   ├── Estampas.tsx
│   │   ├── Tamanhos.tsx
│   │   ├── Catalogo.tsx
│   │   ├── CatalogoPublico.tsx
│   │   ├── Shopee.tsx              # OAuth Shopee
│   │   ├── AnunciosShopee.tsx      # Listagem anúncios
│   │   ├── CriarAnuncioShopee.tsx  # Criar anúncio
│   │   ├── PreferenciasShopee.tsx
│   │   ├── TemplatesShopee.tsx
│   │   ├── MLDiagnostico.tsx       # Diagnóstico ML
│   ├── components/     # Componentes organizados por feature
│   │   ├── Layout/     # Header, BreadcrumbNav
│   │   ├── Tecidos/    # Componentes tecidos
│   │   ├── Cores/      # Componentes cores
│   │   ├── Estampas/   # Componentes estampas
│   │   ├── Shopee/     # Componentes integração Shopee
│   │   ├── Catalogo/   # Componentes catálogo
│   │   └── ui/         # shadcn/ui (18 componentes locais)
│   ├── hooks/          # Custom hooks (24 arquivos)
│   │   ├── useAuth.ts
│   │   ├── useTecidos.ts
│   │   ├── useCores.ts
│   │   ├── useEstampas.ts
│   │   ├── useTamanhos.ts
│   │   ├── useColorimetro.ts       # Bluetooth colorímetro
│   │   ├── useShopee.ts            # Integração Shopee
│   │   ├── useCatalogos.ts
│   │   └── use-toast.ts
│   ├── lib/            # Utilitários
│   │   ├── firebase/   # CRUD Firestore
│   │   ├── utils.ts    # Helpers gerais
│   │   ├── colorUtils.ts  # Conversões RGB/LAB/HEX
│   │   └── deltaE.ts   # Delta E 2000
│   ├── context/        # React Context
│   │   └── AuthContext.tsx
│   ├── types/          # Tipos TypeScript (10 arquivos)
│   ├── config/         # Configuração Firebase
│   └── docs/           # Documentação features
│       ├── TECIDOS.md
│       ├── ESTAMPAS.md
│       ├── CAPTURA_COR.md
│       ├── REINHARD.md
│       ├── VINCULOS.md
│       └── GESTAO_IMAGENS.md
└── package.json
```

### Backend Local (Desenvolvimento)
```
backend/
├── config/
│   └── firebase-adminsdk.json  # Credenciais (gitignored)
├── src/
│   ├── config/         # Firebase e autorizações
│   ├── routes/         # Rotas API
│   ├── middleware/     # Auth middleware
│   ├── services/       # Lógica de negócio
│   └── types/          # Tipos compartilhados
└── package.json
```

## Módulos Principais

### 1. Gerenciamento de Tecidos

Sistema completo de CRUD de tecidos:
- Tipos: Liso e Estampado
- Upload de imagens para Firebase Storage
- SKU automático sequencial (T001, T002...)
- Formatação brasileira (vírgula para decimais, largura em metros)
- Soft-delete (deletedAt)

**Documentação**: `frontend/src/docs/TECIDOS.md`

### 2. Sistema de Cores e Vínculos

**Captura de Cor via Bluetooth**
- Integração com colorímetro LS173 via Web Bluetooth API
- Captura automática de valores LAB
- Validação de duplicatas com Delta E 2000
- Resolução de conflitos (usar existente ou criar nova)

**Gestão de Cores**
- CRUD de cores (nome, HEX, LAB, SKU)
- SKU automático por família (ex: "Azul Royal" → "AZ001")
- Validação de nomes duplicados

**Vínculos Cor-Tecido**
- Relacionamento N:N entre cores e tecidos
- SKU do vínculo: `TecidoSKU-CorSKU` (ex: "T007-AZ001")
- Editor de tingimento Reinhard com sliders ajustáveis
- Preview ampliado em modal (lightbox) ao clicar na imagem
- Exportação XLSX com imagens embedded
- Download ZIP de previews
- Geração em lote de SKUs

**Documentação**: `frontend/src/docs/CAPTURA_COR.md`, `frontend/src/docs/VINCULOS.md`, `frontend/src/docs/REINHARD.md`

### 3. Gestão de Imagens

Novo módulo dedicado para pipeline de imagens dos vínculos:
- Geração de imagem final por vínculo (`imagemGerada`) com persistência no Firebase
- Upload de foto de modelo por vínculo (`imagemModelo`)
- Área de mosaico com 3 templates pré-definidos
- Salvamento de mosaicos em Firestore + Storage para reaproveitar no fluxo Shopee

**Documentação**: `frontend/src/docs/GESTAO_IMAGENS.md`

### 4. Estampas

Sistema de gerenciamento de padrões estampados:
- Cadastro individual ou em lote
- SKU automático por família
- Vinculação com tecidos estampados
- Upload de imagens

**Documentação**: `frontend/src/docs/ESTAMPAS.md`

### 5. Tamanhos e Preços

- Definição de tamanhos personalizados (largura × altura)
- Preços por tamanho (não por cor!)
- Usado na criação de anúncios Shopee

### 6. Integração Shopee

**OAuth e Conexão**
- Fluxo OAuth 2.0 completo
- Refresh automático de tokens
- Suporte multi-loja

**Gerenciamento de Produtos**
- Criação de anúncios com múltiplas variações
- Campo de título customizado no fluxo de criação (`titulo_anuncio`)
- Uso de mosaicos salvos como imagem de capa
- Prioridade para imagens geradas na variação (fallback para imagem tingida)
- Upload automático de imagens (compressão Sharp)
- Sincronização de estoque
- Webhooks para atualizações em tempo real
- Templates de anúncios reutilizáveis

**Funções Agendadas**
- Sincronização diária de produtos
- Manutenção de cores desabilitadas

**Documentação**: `docs/SHOPEE*.md`

### 7. Catálogos Públicos

- Geração de catálogos compartilháveis
- Links públicos (sem autenticação)
- Preview de tecidos com cores tingidas

### 8. Sistema de Navegação e UX

- Header compartilhado com informações do usuário
- Breadcrumb navegação hierárquica
- Sidebar desktop persistente em todas as telas autenticadas
- Troca de módulo em 1 clique sem voltar para Home
- Sincronização de módulo com URL hash (`#/modulo`)
- Atalhos de teclado (`Alt+H`, `Alt+1..7`) e seção de recentes
- UI otimista para feedback instantâneo
- Toasts para notificações
- Responsividade mobile

**Documentação**: `docs/COMPONENTS.md`, `docs/HOOKS.md`, `docs/UX_RESPONSIVIDADE.md`

## Troubleshooting

### Erro: Firestore "Cannot write 'undefined' to Firestore"
- **Causa**: Firestore não aceita valores `undefined`
- **Solução**: Use `null` ou omita o campo completamente
- **Prevenção**: Use helper `removeUndefinedValues()` antes de salvar

### Erro: "Missing Index" ao fazer query Firestore
- **Causa**: Query com `where` + `orderBy` em campos diferentes exige índice composto
- **Solução**: Copie o link do erro e crie o índice no Firebase Console, ou adicione em `firestore.indexes.json`

### Cloud Functions não fazem deploy
```powershell
# Certifique-se de compilar primeiro
cd functions
npm run build
cd ..
firebase deploy --only functions
```

### Frontend não conecta ao backend
- **Desenvolvimento local**: Backend deve estar em `http://localhost:5000`
- **Produção**: API é servida via Cloud Functions em `/api/**`
- Verifique o proxy no `vite.config.ts`
- Verifique CORS nas Cloud Functions

### Shopee OAuth não funciona
- Verifique se as URLs de callback estão corretas no Partner Portal Shopee
- Verifique se partner_id e partner_key estão configurados
- Verifique logs das Cloud Functions para erros de API

### Colorímetro Bluetooth não conecta
- **Requisito**: Navegador com suporte Web Bluetooth (Chrome/Edge)
- **HTTPS**: Web Bluetooth exige HTTPS (ou localhost)
- Verifique se o dispositivo está ligado e em modo de pareamento
- Verifique permissões do navegador

### Erro "Acesso negado" ao fazer login
- Verifique se Google Sign-In está habilitado no Firebase Console
- Verifique configuração de emails autorizados
- Verifique regras do Firestore (`firestore.rules`)

### Erros de import com paths (@/components, @/lib)
- Verifique `tsconfig.json` com paths configurados
- Verifique `vite.config.ts` com alias `@` configurado
- Reinicie o servidor de desenvolvimento (`npm run dev`)

### Imagens não carregam do Storage
- Verifique regras do Storage (`storage.rules`)
- Verifique se usuário está autenticado
- Verifique estrutura de pastas no Storage (ex: `tecidos/{id}/...`)

## Documentação Adicional

### Arquitetura e Padrões
- **[CLAUDE.md](CLAUDE.md)** - Guia completo para Claude Code (comandos, arquitetura, regras críticas)
- **[CONTEXT.md](CONTEXT.md)** - Contexto técnico e decisões de design
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Arquitetura detalhada do sistema

### Componentes e Código
- **[COMPONENTS.md](docs/COMPONENTS.md)** - Documentação de componentes React
- **[HOOKS.md](docs/HOOKS.md)** - Custom hooks React (24 hooks)
- **[UX_RESPONSIVIDADE.md](docs/UX_RESPONSIVIDADE.md)** - Padrões de UX e responsividade

### Features
- **[TECIDOS.md](frontend/src/docs/TECIDOS.md)** - Módulo de tecidos
- **[ESTAMPAS.md](frontend/src/docs/ESTAMPAS.md)** - Módulo de estampas
- **[CAPTURA_COR.md](frontend/src/docs/CAPTURA_COR.md)** - Captura Bluetooth e gestão de cores
- **[VINCULOS.md](frontend/src/docs/VINCULOS.md)** - Vínculos cor-tecido
- **[GESTAO_IMAGENS.md](frontend/src/docs/GESTAO_IMAGENS.md)** - Gestão de imagens e mosaicos
- **[REINHARD.md](frontend/src/docs/REINHARD.md)** - Algoritmo de tingimento

### Shopee
- **[SHOPEE.md](docs/SHOPEE.md)** - Visão geral da integração
- **[SHOPEE_API_REFERENCIA.md](docs/SHOPEE_API_REFERENCIA.md)** - Referência completa da API
- **[SHOPEE_ANUNCIOS.md](docs/SHOPEE_ANUNCIOS.md)** - Sistema de anúncios
- **[SHOPEE_WEBHOOK_SETUP.md](docs/SHOPEE_WEBHOOK_SETUP.md)** - Configuração de webhooks
- **[SHOPEE_STOCK_REVIEW.md](docs/SHOPEE_STOCK_REVIEW.md)** - Gestão de estoque

### Deploy
- **[DEPLOY_FIREBASE.md](docs/DEPLOY_FIREBASE.md)** - Guia completo de deploy Firebase
- **[DEPLOY.md](docs/DEPLOY.md)** - Instruções gerais de deploy

## Regras de Segurança Firebase

O projeto inclui arquivos de regras de segurança versionados:

### firestore.rules
Controla acesso ao Firestore:
- **Collections com autenticação**: `tecidos`, `cores`, `cor_tecido`, `estampas`, `tamanhos`, `shopee_products`, `sku_control`, `gestao_imagens_mosaicos`
- **Collections backend-only**: `shopee_shops`, `shopee_categories_cache`, `shopee_logistics_cache`
- **Collections públicas**: `catalogos` (read-only)
- **Soft-delete**: Todas as queries filtram `deletedAt == null`

### storage.rules
Controla acesso ao Cloud Storage:
- Usuários autenticados podem upload/download em:
  - `tecidos/{tecidoId}/**`
  - `cores/{corId}/**`
  - `cor-tecido/{vinculoId}/**`
  - `estampas/{estampaId}/**`
  - `mosaicos/{tecidoId}/**`
  - `shopee-anuncios/{productId}/**`
  - `ml-models/{modelId}/**`

### firestore.indexes.json
Define índices compostos necessários para queries complexas.

**Deploy de regras:**
```bash
firebase deploy --only firestore:rules,firestore:indexes,storage:rules
```

## Deploy em Produção

O projeto é totalmente hospedado no **Firebase**:

- **Frontend**: Firebase Hosting (`frontend/dist/`)
- **Backend**: Cloud Functions (Node.js 20)
- **Banco de Dados**: Cloud Firestore
- **Storage**: Cloud Storage
- **Auth**: Firebase Authentication

### Deploy Completo

```powershell
# 1. Build do frontend
cd frontend
npm run build
cd ..

# 2. Build das Cloud Functions
cd functions
npm run build
cd ..

# 3. Deploy tudo
firebase deploy

# Ou deploy seletivo
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only storage:rules
```

### Primeira Configuração

1. Crie projeto no Firebase Console
2. Configure domínio personalizado (opcional)
3. Configure Shopee OAuth callbacks para domínio de produção
4. Deploy de regras e índices primeiro
5. Deploy de functions e hosting

**Documentação completa**: [docs/DEPLOY_FIREBASE.md](docs/DEPLOY_FIREBASE.md)

## Links Úteis

- [Firebase Console](https://console.firebase.google.com/)
- [Documentação Firebase](https://firebase.google.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)

## Notas Importantes

### Ambiente Windows/PowerShell
Este projeto é desenvolvido em ambiente Windows com PowerShell. Ao encadear comandos:
- ✅ **Use ponto-e-vírgula**: `cd functions; npm run build; cd ..`
- ❌ **NÃO use &&**: `cd functions && npm run build && cd ..` (sintaxe Bash)

### Collections Firestore
Todas as collections usam **soft-delete**:
- Ao criar: `deletedAt: null`
- Ao deletar: `deletedAt: serverTimestamp()`
- Queries sempre filtram `where('deletedAt', '==', null)`

### Valores no Firestore
⚠️ **CRÍTICO**: Firestore rejeita valores `undefined`
- Use `null` ou omita o campo
- Use helper `removeUndefinedValues()` em payloads

### SKU System
- **Tecidos**: T001, T002, ... (sequencial simples)
- **Cores**: AZ001, VE001, ... (família + sequencial)
- **Vínculos**: T007-AZ001 (tecidoSKU-corSKU)
- **Estampas**: Primeira palavra do nome + sequencial

### Formatação Brasileira
- **Decimais**: Vírgula para exibição, ponto para storage
- **Largura**: Sempre em metros (não cm)
- **Preços**: Por tamanho, não por cor

## Licença

ISC License
