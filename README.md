# RazaiSystem

Projeto full-stack desenvolvido com Node.js, TypeScript, Firebase e React.

## Stack Tecnológica

- **Backend**: Node.js + Express + TypeScript + Firebase Admin SDK
- **Frontend**: React + Vite + TypeScript + Firebase Client SDK + shadcn/ui + Tailwind CSS
- **Banco de Dados**: Firestore
- **Autenticação**: Firebase Authentication (Google Sign-In)
- **Storage**: Firebase Storage

## Estrutura do Projeto

```
RazaiSystem/
├── frontend/          # Aplicação React com Vite + shadcn/ui
├── backend/          # API Node.js + Express + TypeScript
│   └── config/       # Arquivos de configuração
├── .cursor/         # Configurações do Cursor
└── README.md
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
# Instalar dependências de todos os projetos (raiz, backend e frontend)
npm run install:all
```

Ou instalar separadamente:

```bash
# Backend
cd backend && npm install && cd ..

# Frontend
cd frontend && npm install && cd ..
```

### 3. Rodar o Projeto

**Opção 1: Rodar tudo junto (Recomendado)**

```bash
# Na raiz do projeto
npm run dev
```

Isso iniciará backend e frontend simultaneamente:
- Backend: `http://localhost:5000`
- Frontend: `http://localhost:3000`

**Opção 2: Rodar separadamente**

```bash
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend
npm run dev:frontend
```

### 4. Configurar Autenticação Google

1. Acesse o [Firebase Console](https://console.firebase.google.com/)
2. Vá em **Authentication** → **Sign-in method**
3. Habilite **Google** como provedor de autenticação
4. Configure o email autorizado em `backend/src/config/authorizedEmails.ts`

### 5. Adicionar Seu Email Autorizado

Edite o arquivo `backend/src/config/authorizedEmails.ts` e adicione seu email:

```typescript
const AUTHORIZED_EMAILS: string[] = [
  'seu-email@gmail.com'  // Adicione seu email aqui
];
```

## Scripts

### Na Raiz do Projeto

- `npm run dev` - Inicia backend e frontend simultaneamente
- `npm run dev:backend` - Inicia apenas o backend
- `npm run dev:frontend` - Inicia apenas o frontend
- `npm run build` - Compila backend e frontend
- `npm run install:all` - Instala dependências de todos os projetos

### Backend (dentro de `backend/`)

- `npm run dev` - Inicia servidor em modo desenvolvimento
- `npm run build` - Compila TypeScript
- `npm start` - Inicia servidor em produção

### Frontend (dentro de `frontend/`)

- `npm run dev` - Inicia servidor de desenvolvimento Vite
- `npm run build` - Build de produção
- `npm run preview` - Preview do build

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

### Backend (.env)

```
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### Frontend (.env)

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=razaisystem
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

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

### Backend
```
backend/
├── config/              # Arquivos de configuração
│   ├── firebase-adminsdk.json  # Credenciais Firebase (não commitado)
│   └── authorizedEmails.ts     # Lista de emails autorizados
├── src/
│   ├── config/         # Configurações (Firebase, etc)
│   │   ├── firebase.ts         # Inicialização Firebase Admin SDK
│   │   └── authorizedEmails.ts # Lista de emails autorizados
│   ├── routes/         # Rotas da API
│   │   └── tecidos.routes.ts  # Rotas CRUD de tecidos
│   ├── middleware/     # Middlewares
│   │   └── auth.middleware.ts # Middleware de autenticação
│   ├── types/          # Tipos TypeScript compartilhados
│   │   └── tecido.types.ts    # Tipos relacionados a tecidos
│   └── index.ts        # Entry point do servidor Express
├── .env                # Variáveis de ambiente
└── package.json
```

### Frontend
```
frontend/
├── src/
│   ├── components/     # Componentes React
│   │   ├── Layout/    # Componentes de layout
│   │   │   ├── Header.tsx      # Header compartilhado
│   │   │   └── BreadcrumbNav.tsx # Navegação breadcrumb
│   │   ├── Tecidos/  # Componentes do módulo Tecidos
│   │   │   ├── TecidosTable.tsx    # Tabela de tecidos
│   │   │   └── TecidoFormModal.tsx # Modal de formulário
│   │   └── ui/        # Componentes shadcn/ui
│   │       ├── button.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── table.tsx
│   │       ├── toast.tsx
│   │       └── breadcrumb.tsx
│   ├── pages/         # Páginas da aplicação
│   │   ├── Login.tsx  # Página de login
│   │   ├── Home.tsx   # Página inicial (protegida)
│   │   └── Tecidos.tsx # Página de gerenciamento de tecidos
│   ├── hooks/         # Custom hooks
│   │   ├── useAuth.ts      # Hook de autenticação
│   │   ├── useTecidos.ts   # Hook CRUD de tecidos
│   │   ├── useSku.ts       # Hook de gerenciamento de SKU
│   │   └── use-toast.ts   # Hook de notificações toast
│   ├── context/       # Context API
│   │   └── AuthContext.tsx  # Context de autenticação
│   ├── lib/           # Utilitários
│   │   ├── firebase/  # Funções Firebase
│   │   │   └── tecidos.ts  # CRUD de tecidos no Firestore/Storage
│   │   └── utils.ts   # Funções utilitárias
│   ├── config/        # Configurações
│   │   └── firebase.ts # Inicialização Firebase Client SDK
│   ├── types/         # Tipos TypeScript
│   │   └── tecido.types.ts # Tipos relacionados a tecidos
│   ├── docs/          # Documentação
│   │   └── TECIDOS.md # Documentação do módulo Tecidos
│   ├── App.tsx        # Componente principal (roteamento)
│   └── main.tsx       # Entry point
├── .env               # Variáveis de ambiente Firebase
└── package.json
```

## Módulos Principais

### Módulo de Tecidos

Sistema completo de gerenciamento de tecidos com:
- CRUD completo (Create, Read, Update, Delete)
- Tipos de tecido: Liso e Estampado
- UI otimista para feedback rápido
- Upload de imagens para Firebase Storage
- Sistema de SKU único e sequencial
- Validação de formulários
- Formatação brasileira (vírgula para decimais)

**Documentação completa**: `frontend/src/docs/TECIDOS.md`

### Módulo de Estampas

Sistema de gerenciamento de estampas vinculadas a tecidos estampados:
- Cadastro individual ou em lote
- SKU automático por família (primeira palavra do nome)
- Vinculação com tecidos do tipo "Estampado"
- Upload de imagens opcional
- Seleção de tecido via chips interativos
- Validação em tempo real no modo lote

**Documentação completa**: `frontend/src/docs/ESTAMPAS.md`

### Sistema de Navegação

- **Header**: Componente compartilhado com logo clicável, informações do usuário e logout
- **Breadcrumb**: Navegação hierárquica posicionada abaixo do header, na área cinza
- Navegação entre páginas através de estado local

**Documentação de componentes**: `docs/COMPONENTS.md`

### Sistema de Autenticação

- Login com Google através do Firebase Authentication
- Restrição de acesso por email autorizado
- Proteção de rotas no backend
- Context API para gerenciamento de estado de autenticação

**Documentação de hooks**: `docs/HOOKS.md`

## Troubleshooting

### Erro ao compilar frontend: "Property 'env' does not exist on type 'ImportMeta'"
- **Solução**: O arquivo `src/vite-env.d.ts` já está criado com os tipos necessários
- Se o erro persistir, verifique se o arquivo existe e está no lugar correto

### Backend não inicia
- Verifique se o arquivo `backend/config/firebase-adminsdk.json` existe
- Verifique se o arquivo `.env` do backend está configurado
- Verifique se a porta 5000 está disponível

### Frontend não conecta ao backend
- Verifique se o backend está rodando na porta 5000
- Verifique se o proxy no `vite.config.ts` está configurado corretamente
- Verifique o CORS no backend

### Firebase não inicializa
- **Backend**: Verifique se `backend/config/firebase-adminsdk.json` existe e é válido
- **Frontend**: Verifique se todas as variáveis `VITE_FIREBASE_*` estão no arquivo `.env`
- Verifique se as credenciais estão corretas no Firebase Console

### Erro "Acesso negado" ao fazer login
- Verifique se seu email está na lista de emails autorizados em `backend/src/config/authorizedEmails.ts`
- Verifique se o Google Sign-In está habilitado no Firebase Console

### Erros de import com paths (@/components)
- Verifique se o `tsconfig.json` tem os paths configurados
- Verifique se o `vite.config.ts` tem o alias `@` configurado
- Reinicie o servidor de desenvolvimento

## Documentação Adicional

- **[COMPONENTS.md](docs/COMPONENTS.md)** - Documentação de componentes React
- **[HOOKS.md](docs/HOOKS.md)** - Documentação de custom hooks
- **[TECIDOS.md](frontend/src/docs/TECIDOS.md)** - Documentação completa do módulo de Tecidos
- **[ESTAMPAS.md](frontend/src/docs/ESTAMPAS.md)** - Documentação do módulo de Estampas
- **[CAPTURA_COR.md](frontend/src/docs/CAPTURA_COR.md)** - Documentação do módulo de Captura de Cor
- **[REINHARD.md](frontend/src/docs/REINHARD.md)** - Documentação do algoritmo de tingimento
- **[CONTEXT.md](CONTEXT.md)** - Contexto técnico e padrões do projeto

## Regras de Segurança Firebase

O projeto inclui arquivos de regras de segurança:

- **firestore.rules**: Regras do Firestore
  - Usuários autenticados podem ler/escrever em `tecidos`, `cores`, `estampas` e `sku_control`
- **storage.rules**: Regras do Firebase Storage
  - Usuários autenticados podem fazer upload/download em:
    - `tecidos/{tecidoId}/...`
    - `cores/{corId}/...`
    - `estampas/{estampaId}/...`

**Importante**: Aplique essas regras no Firebase Console após configurar o projeto.

## Deploy em Produção

O projeto está configurado para deploy completo no **Firebase Hosting**:

- **Frontend**: Servido via Firebase Hosting
- **Backend**: Executado via Firebase Cloud Functions
- **Banco de Dados**: Firebase Firestore
- **Storage**: Firebase Storage

### Guia Completo de Deploy

Consulte **[docs/DEPLOY_FIREBASE.md](docs/DEPLOY_FIREBASE.md)** para instruções detalhadas de deploy.

**Comandos rápidos:**

```bash
# Build e deploy completo
npm run build:frontend
npm run build:functions
firebase deploy

# Ou apenas hosting
firebase deploy --only hosting

# Ou apenas functions
firebase deploy --only functions
```

## Links Úteis

- [Firebase Console](https://console.firebase.google.com/)
- [Documentação Firebase](https://firebase.google.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)

## Licença

[Adicione sua licença aqui]
