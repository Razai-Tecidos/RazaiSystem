# Guia de Deploy - Firebase Hosting (RazaiSystem)

Este guia fornece instruções completas para fazer deploy do RazaiSystem usando **Firebase Hosting** para frontend e **Firebase Cloud Functions** para backend.

## 📋 Pré-requisitos

- Node.js 18+ instalado
- Firebase CLI instalado: `npm install -g firebase-tools`
- Conta Firebase configurada
- Projeto Firebase criado no [Firebase Console](https://console.firebase.google.com/)

## 🚀 Passo a Passo

### 1. Instalar Firebase CLI e Fazer Login

```bash
npm install -g firebase-tools
firebase login
```

### 2. Inicializar Firebase no Projeto

```bash
firebase init
```

Durante a inicialização, selecione:
- ✅ **Hosting**: Configure files for Firebase Hosting
- ✅ **Functions**: Configure a Cloud Functions directory
- ✅ **Firestore**: Configure security rules and indexes files
- ✅ **Storage**: Configure security rules files

**Configurações importantes:**
- **Public directory**: `frontend/dist`
- **Functions directory**: `functions`
- **Single-page app**: `Yes` (para React Router)
- **Overwrite index.html**: `No` (já temos)

### 3. Instalar Dependências

```bash
# Instalar dependências das Cloud Functions
cd functions
npm install
cd ..

# Instalar dependências do frontend
cd frontend
npm install
cd ..
```

### 4. Configurar Variáveis de Ambiente

#### Frontend (.env ou .env.production)

Crie/edite `frontend/.env.production`:

```env
VITE_FIREBASE_API_KEY=sua-api-key
VITE_FIREBASE_AUTH_DOMAIN=razaisystem.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=razaisystem
VITE_FIREBASE_STORAGE_BUCKET=razaisystem.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=696290533431
VITE_FIREBASE_APP_ID=1:696290533431:web:95c194457310d78e375fb2
VITE_FIREBASE_MEASUREMENT_ID=G-ZC2SM2PLH5
```

#### Cloud Functions

As Cloud Functions já têm acesso automático ao Firebase Admin SDK. Não é necessário configurar credenciais manualmente.

**Emails autorizados**: Edite `functions/src/config/authorizedEmails.ts` para adicionar emails autorizados.

### 5. Build do Frontend

```bash
cd frontend
npm run build
cd ..
```

Isso criará a pasta `frontend/dist` com os arquivos estáticos.

### 6. Build das Cloud Functions

```bash
cd functions
npm run build
cd ..
```

Isso compilará o TypeScript para JavaScript na pasta `functions/lib`.

### 7. Aplicar Regras de Segurança

```bash
# Aplicar regras do Firestore
firebase deploy --only firestore:rules

# Aplicar regras do Storage
firebase deploy --only storage
```

Ou aplicar tudo de uma vez:

```bash
firebase deploy --only firestore:rules,storage
```

### 8. Deploy Completo

```bash
# Deploy de tudo (Hosting + Functions + Rules)
firebase deploy
```

Ou deploy específico:

```bash
# Apenas Hosting
firebase deploy --only hosting

# Apenas Functions
firebase deploy --only functions

# Apenas Rules
firebase deploy --only firestore:rules,storage
```

### 9. Verificar Deploy

Após o deploy, você receberá URLs:
- **Hosting**: `https://razaisystem.web.app` ou `https://razaisystem.firebaseapp.com`
- **Functions**: Acessíveis via `/api/*` no mesmo domínio

## 📁 Estrutura do Projeto

```
RazaiSystem/
├── firebase.json          # Configuração Firebase
├── firestore.rules        # Regras do Firestore
├── storage.rules          # Regras do Storage
├── functions/              # Cloud Functions (Backend)
│   ├── src/
│   │   ├── index.ts       # Entry point das Functions
│   │   ├── config/        # Configurações
│   │   ├── middleware/    # Middlewares
│   │   ├── routes/       # Rotas da API
│   │   └── types/        # Tipos TypeScript
│   ├── package.json
│   └── tsconfig.json
├── frontend/               # Frontend React
│   ├── dist/              # Build de produção (gerado)
│   ├── src/
│   └── package.json
└── backend/                # Backend Express (não usado em produção)
```

## 🔧 Configuração do firebase.json

O arquivo `firebase.json` já está configurado com:

- **Hosting**: Serve arquivos de `frontend/dist`
- **Rewrites**: Redireciona `/api/**` para Cloud Functions
- **Functions**: Compila TypeScript antes do deploy
- **Headers**: Cache para assets estáticos

## 🔐 Segurança

### 1. Configurar Domínios Autorizados

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Vá em **Authentication** → **Settings** → **Authorized domains**
3. Adicione seu domínio de produção (ex: `razaisystem.web.app`)

### 2. Configurar Emails Autorizados

Edite `functions/src/config/authorizedEmails.ts`:

```typescript
const AUTHORIZED_EMAILS: string[] = [
  'seu-email@gmail.com',
  'outro-email@gmail.com'
];
```

### 3. Verificar Regras de Segurança

Certifique-se de que as regras estão aplicadas:

```bash
firebase deploy --only firestore:rules,storage
```

## 🧪 Testar Localmente

### Emuladores Firebase

```bash
# Iniciar emuladores
firebase emulators:start

# Acessar:
# - Hosting: http://localhost:5000
# - Functions: http://localhost:5001
# - Firestore: http://localhost:8080
```

### Build e Preview do Frontend

```bash
cd frontend
npm run build
npm run preview
# Acessar: http://localhost:4173
```

## 📝 Scripts Úteis

Adicione ao `package.json` na raiz:

```json
{
  "scripts": {
    "deploy": "npm run build:frontend && npm run build:functions && firebase deploy",
    "deploy:hosting": "npm run build:frontend && firebase deploy --only hosting",
    "deploy:functions": "npm run build:functions && firebase deploy --only functions",
    "deploy:rules": "firebase deploy --only firestore:rules,storage",
    "build:frontend": "cd frontend && npm run build",
    "build:functions": "cd functions && npm run build",
    "emulators": "firebase emulators:start"
  }
}
```

## 🔄 Deploy Contínuo

### GitHub Actions (Opcional)

Crie `.github/workflows/deploy-firebase.yml`:

```yaml
name: Deploy to Firebase

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd frontend && npm install
          cd ../functions && npm install
      
      - name: Build frontend
        run: cd frontend && npm run build
      
      - name: Build functions
        run: cd functions && npm run build
      
      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          projectId: razaisystem
```

## 🐛 Troubleshooting

### Erro: "Functions directory does not exist"

Certifique-se de que a pasta `functions` existe e tem `package.json`:

```bash
ls functions/package.json
```

### Erro: "Hosting directory does not exist"

Certifique-se de que o build do frontend foi executado:

```bash
cd frontend
npm run build
ls dist/
```

### Erro: "Permission denied" no deploy

Verifique se você está logado:

```bash
firebase login
firebase projects:list
```

### Functions não respondem

1. Verifique os logs: `firebase functions:log`
2. Verifique se o build foi executado: `cd functions && npm run build`
3. Verifique se a função está exportada corretamente em `functions/src/index.ts`

### CORS errors

O CORS já está configurado nas Cloud Functions para permitir todas as origens. Se houver problemas, verifique `functions/src/index.ts`.

## 📊 Monitoramento

### Ver Logs das Functions

```bash
firebase functions:log
```

### Ver Logs em Tempo Real

```bash
firebase functions:log --only api
```

### Dashboard Firebase Console

Acesse [Firebase Console](https://console.firebase.google.com/) → **Functions** para ver métricas e logs.

## ✅ Checklist de Deploy

- [ ] Firebase CLI instalado e logado
- [ ] Projeto Firebase inicializado (`firebase init`)
- [ ] Dependências instaladas (`functions` e `frontend`)
- [ ] Variáveis de ambiente configuradas (`.env.production`)
- [ ] Emails autorizados configurados (`functions/src/config/authorizedEmails.ts`)
- [ ] Build do frontend executado (`npm run build`)
- [ ] Build das functions executado (`npm run build`)
- [ ] Regras de segurança aplicadas (`firebase deploy --only firestore:rules,storage`)
- [ ] Deploy completo executado (`firebase deploy`)
- [ ] Domínios autorizados configurados no Firebase Console
- [ ] Testes realizados em produção
- [ ] Logs verificados (`firebase functions:log`)

## 🎯 URLs de Produção

Após o deploy, você terá acesso a:

- **Frontend**: `https://razaisystem.web.app` ou `https://razaisystem.firebaseapp.com`
- **API**: `https://razaisystem.web.app/api/*`
- **Firebase Console**: https://console.firebase.google.com/project/razaisystem

## 📚 Recursos Adicionais

- [Firebase Hosting Documentation](https://firebase.google.com/docs/hosting)
- [Cloud Functions Documentation](https://firebase.google.com/docs/functions)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)

---

**Última atualização**: 2026-02-03
