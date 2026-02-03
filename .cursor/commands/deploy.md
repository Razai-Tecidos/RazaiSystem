---
name: deploy
description: Prepara o projeto para deploy em produção. Acionado pelo usuário via /deploy.
---

Analise o projeto e forneça checklist e instruções para deploy em produção.

## Checklist de Deploy

### Backend

- [ ] Variáveis de ambiente configuradas (.env de produção)
- [ ] Build compilado sem erros (`npm run build`)
- [ ] Testes passando
- [ ] Credenciais Firebase Admin SDK configuradas
- [ ] CORS configurado para domínio de produção
- [ ] Logs e monitoramento configurados
- [ ] Process manager configurado (PM2, etc)

### Frontend

- [ ] Variáveis de ambiente de produção configuradas
- [ ] Build de produção gerado (`npm run build`)
- [ ] Testes passando
- [ ] Variáveis Firebase configuradas para produção
- [ ] Assets otimizados (imagens, etc)
- [ ] Verificar se todas as rotas estão funcionando
- [ ] Verificar se API está acessível do frontend

### Firebase

- [ ] Regras de segurança do Firestore configuradas
- [ ] Regras de segurança do Storage configuradas
- [ ] Índices do Firestore criados (se necessário)
- [ ] Domínios autorizados configurados no Firebase Console

### Geral

- [ ] .gitignore configurado corretamente
- [ ] Nenhuma credencial commitada
- [ ] README atualizado com instruções de deploy
- [ ] Versão atualizada no package.json

## Comandos Úteis

### Backend

```bash
npm run build
npm start
```

### Frontend

```bash
npm run build
npm run preview  # Para testar build localmente
```

### Firebase

```bash
firebase deploy
firebase deploy --only firestore:rules
firebase deploy --only storage
```

## Variáveis de Ambiente de Produção

### Backend (.env.production)

```
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://seu-dominio.com
```

### Frontend (.env.production)

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
# ... outras variáveis Firebase
```

## Plataformas Sugeridas

- **Backend**: Vercel, Railway, Render, Heroku, AWS
- **Frontend**: Vercel, Netlify, Firebase Hosting
- **Banco**: Firebase Firestore (já configurado)

## Segurança

- Nunca commitar arquivos .env
- Usar variáveis de ambiente da plataforma
- Verificar regras de segurança do Firebase
- Habilitar HTTPS
- Configurar CORS corretamente

Sempre forneça instruções específicas baseadas na plataforma escolhida.
