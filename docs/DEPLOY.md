# Guia de Deploy - RazaiSystem

Este documento fornece um checklist completo e instruções detalhadas para fazer deploy do RazaiSystem em produção.

## 📋 Checklist de Deploy

### ✅ Backend

- [ ] Variáveis de ambiente de produção configuradas (`.env` ou variáveis da plataforma)
- [ ] Build compilado sem erros (`npm run build`)
- [ ] Credenciais Firebase Admin SDK configuradas (`firebase-adminsdk.json`)
- [ ] CORS configurado para domínio de produção (`FRONTEND_URL`)
- [ ] Emails autorizados configurados em `backend/src/config/authorizedEmails.ts`
- [ ] Process manager configurado (PM2, Docker, etc) - se necessário
- [ ] Logs e monitoramento configurados
- [ ] Porta configurada corretamente (padrão: 5000)

### ✅ Frontend

- [ ] Variáveis de ambiente de produção configuradas (`.env.production` ou variáveis da plataforma)
- [ ] Build de produção gerado (`npm run build`)
- [ ] Build testado localmente (`npm run preview`)
- [ ] Variáveis Firebase configuradas para produção
- [ ] Assets otimizados (imagens, etc)
- [ ] Verificar se todas as rotas estão funcionando
- [ ] Verificar se API está acessível do frontend
- [ ] Domínios autorizados configurados no Firebase Console

### ✅ Firebase

- [ ] Regras de segurança do Firestore aplicadas (`firestore.rules`)
- [ ] Regras de segurança do Storage aplicadas (`storage.rules`)
- [ ] Índices do Firestore criados (se necessário)
- [ ] Domínios autorizados configurados no Firebase Console (Authentication → Settings → Authorized domains)
- [ ] Google Sign-In habilitado no Firebase Console
- [ ] Firebase Hosting configurado (se usar)

### ✅ Geral

- [ ] `.gitignore` configurado corretamente (sem credenciais commitadas)
- [ ] Nenhuma credencial commitada no repositório
- [ ] README atualizado com instruções de deploy
- [ ] Versão atualizada no `package.json` (se necessário)
- [ ] Testes executados (se houver)

---

## 🚀 Comandos de Build

### Backend

```bash
cd backend
npm install
npm run build
npm start  # Testar build localmente antes de deploy
```

### Frontend

```bash
cd frontend
npm install
npm run build
npm run preview  # Testar build localmente antes de deploy
```

### Build Completo (Raiz)

```bash
npm run build  # Compila backend e frontend
```

---

## 🔧 Variáveis de Ambiente

### Backend (.env ou Variáveis da Plataforma)

```env
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://seu-dominio.com
```

**Importante**: 
- `FRONTEND_URL` deve ser o domínio completo do frontend em produção (ex: `https://razaisystem.vercel.app`)
- Isso é usado para configurar CORS corretamente

### Frontend (.env.production ou Variáveis da Plataforma)

```env
VITE_FIREBASE_API_KEY=sua-api-key
VITE_FIREBASE_AUTH_DOMAIN=razaisystem.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=razaisystem
VITE_FIREBASE_STORAGE_BUCKET=razaisystem.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=696290533431
VITE_FIREBASE_APP_ID=1:696290533431:web:95c194457310d78e375fb2
VITE_FIREBASE_MEASUREMENT_ID=G-ZC2SM2PLH5
```

**Nota**: No Vite, variáveis de ambiente devem começar com `VITE_` para serem expostas ao cliente.

---

## 📦 Plataformas Sugeridas

### Backend

#### Opção 1: Railway (Recomendado)
- **URL**: https://railway.app
- **Vantagens**: Simples, suporta Node.js nativamente, variáveis de ambiente fáceis
- **Passos**:
  1. Conecte seu repositório GitHub
  2. Selecione o diretório `backend/`
  3. Configure variáveis de ambiente
  4. Faça upload do arquivo `firebase-adminsdk.json` via Railway dashboard ou variável de ambiente
  5. Deploy automático a cada push

#### Opção 2: Render
- **URL**: https://render.com
- **Passos similares ao Railway**

#### Opção 3: Vercel (Serverless Functions)
- Requer adaptação para usar Vercel Functions
- Mais complexo para Express tradicional

#### Opção 4: Heroku
- **URL**: https://heroku.com
- Requer `Procfile`:
  ```
  web: node dist/index.js
  ```

### Frontend

#### Opção 1: Vercel (Recomendado)
- **URL**: https://vercel.com
- **Vantagens**: Otimizado para React/Vite, deploy automático, CDN global
- **Passos**:
  1. Conecte seu repositório GitHub
  2. Configure:
     - **Framework Preset**: Vite
     - **Root Directory**: `frontend`
     - **Build Command**: `npm run build`
     - **Output Directory**: `dist`
  3. Configure variáveis de ambiente (`VITE_FIREBASE_*`)
  4. Deploy automático a cada push

#### Opção 2: Netlify
- **URL**: https://netlify.com
- Similar ao Vercel

#### Opção 3: Firebase Hosting
- **URL**: https://firebase.google.com/docs/hosting
- **Passos**:
  1. Instalar Firebase CLI: `npm install -g firebase-tools`
  2. Login: `firebase login`
  3. Inicializar: `firebase init hosting` (selecionar diretório `frontend/dist`)
  4. Build: `cd frontend && npm run build`
  5. Deploy: `firebase deploy --only hosting`

---

## 🔐 Segurança

### Checklist de Segurança

- [ ] **Nunca commitar credenciais**: Verifique que `.env` e `firebase-adminsdk.json` estão no `.gitignore`
- [ ] **Variáveis de ambiente**: Use variáveis da plataforma, nunca hardcode
- [ ] **CORS configurado**: Backend deve aceitar apenas requisições do domínio de produção
- [ ] **Firebase Rules**: Regras de segurança aplicadas e testadas
- [ ] **HTTPS obrigatório**: Todas as plataformas modernas usam HTTPS por padrão
- [ ] **Emails autorizados**: Lista de emails autorizados configurada em produção
- [ ] **Firebase Authorized Domains**: Domínios de produção adicionados no Firebase Console

### Configurar Domínios Autorizados no Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Selecione seu projeto
3. Vá em **Authentication** → **Settings** → **Authorized domains**
4. Adicione seu domínio de produção (ex: `seu-dominio.com`, `seu-app.vercel.app`)

### Aplicar Regras do Firebase

```bash
# Aplicar regras do Firestore
firebase deploy --only firestore:rules

# Aplicar regras do Storage
firebase deploy --only storage
```

Ou via Firebase Console:
- **Firestore**: Firestore Database → Rules → Cole e cole as regras de `firestore.rules`
- **Storage**: Storage → Rules → Cole e cole as regras de `storage.rules`

---

## 📝 Configurações Específicas por Plataforma

### Railway (Backend)

1. **Criar novo projeto**
2. **Conectar repositório**
3. **Configurar**:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. **Variáveis de Ambiente**:
   - `NODE_ENV=production`
   - `PORT=5000` (ou deixar Railway atribuir automaticamente)
   - `FRONTEND_URL=https://seu-frontend.vercel.app`
5. **Firebase Admin SDK**:
   - Opção 1: Upload do arquivo JSON via Railway dashboard (seções → Variables → Add File)
   - Opção 2: Converter JSON para variável de ambiente (menos recomendado)

### Vercel (Frontend)

1. **Criar novo projeto**
2. **Conectar repositório**
3. **Configurar**:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. **Variáveis de Ambiente**:
   - Adicionar todas as variáveis `VITE_FIREBASE_*`
5. **Deploy**: Automático a cada push na branch `main`

---

## 🧪 Testar Antes de Deploy

### Testar Build Localmente

```bash
# Backend
cd backend
npm run build
npm start
# Testar: http://localhost:5000/api/health

# Frontend
cd frontend
npm run build
npm run preview
# Testar: http://localhost:4173
```

### Verificações Pós-Deploy

- [ ] Frontend carrega corretamente
- [ ] Autenticação Google funciona
- [ ] Lista de tecidos carrega
- [ ] CRUD de tecidos funciona
- [ ] Upload de imagens funciona
- [ ] Lista de cores carrega
- [ ] Captura de cores funciona (se aplicável)
- [ ] API backend responde (`/api/health`)
- [ ] CORS funcionando (sem erros no console)

---

## 🔄 Deploy Contínuo

### GitHub Actions (Opcional)

Crie `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd backend && npm install && npm run build
      # Adicione comandos específicos da sua plataforma

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd frontend && npm install && npm run build
      # Adicione comandos específicos da sua plataforma
```

---

## 🐛 Troubleshooting

### Backend não inicia em produção

- Verifique se `firebase-adminsdk.json` está acessível
- Verifique variáveis de ambiente
- Verifique logs da plataforma
- Verifique se a porta está configurada corretamente

### Frontend não conecta ao Firebase

- Verifique se todas as variáveis `VITE_FIREBASE_*` estão configuradas
- Verifique se o domínio está autorizado no Firebase Console
- Verifique console do navegador para erros

### Erro de CORS

- Verifique se `FRONTEND_URL` no backend está correto
- Verifique se o domínio do frontend corresponde exatamente ao configurado
- Verifique se está usando HTTPS em produção

### Autenticação não funciona

- Verifique se Google Sign-In está habilitado no Firebase Console
- Verifique se o domínio está autorizado
- Verifique se emails estão na lista de autorizados
- Verifique console do navegador para erros

---

## 📚 Recursos Adicionais

- [Firebase Console](https://console.firebase.google.com/)
- [Vercel Documentation](https://vercel.com/docs)
- [Railway Documentation](https://docs.railway.app/)
- [Firebase Hosting](https://firebase.google.com/docs/hosting)
- [Vite Production Guide](https://vitejs.dev/guide/build.html)

---

## ✅ Checklist Final Antes de Ir para Produção

- [ ] Todos os builds compilam sem erros
- [ ] Testes locais passando
- [ ] Variáveis de ambiente configuradas
- [ ] Firebase Rules aplicadas
- [ ] Domínios autorizados configurados
- [ ] CORS configurado corretamente
- [ ] Emails autorizados configurados
- [ ] Builds testados localmente
- [ ] Deploy realizado com sucesso
- [ ] Funcionalidades testadas em produção
- [ ] Monitoramento configurado (opcional)

---

**Última atualização**: 2026-02-03
