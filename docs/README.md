# Documentacao do RazaiSystem

Ultima atualizacao: 2026-02-11

## Leitura em 60s (para agentes)
1. Entenda o escopo global: [ARCHITECTURE.md](ARCHITECTURE.md)
2. Se for Shopee (mais comum): [SHOPEE_ANUNCIOS.md](SHOPEE_ANUNCIOS.md)
3. Para status de execucao por ondas/tasks: [SHOPEE_ANUNCIOS_ROADMAP.md](SHOPEE_ANUNCIOS_ROADMAP.md)
4. Para deploy: [DEPLOY.md](DEPLOY.md) e [DEPLOY_FIREBASE.md](DEPLOY_FIREBASE.md)

## Mapa por intencao (task -> onde abrir primeiro)
- `Criar/editar fluxo de anuncio Shopee`:
  - Doc: [SHOPEE_ANUNCIOS.md](SHOPEE_ANUNCIOS.md)
  - Codigo: `frontend/src/pages/CriarAnuncioShopee.tsx`
  - Backend: `functions/src/services/shopee-product.service.ts`
- `Corrigir endpoint/contrato Shopee`:
  - Doc: [SHOPEE_API_REFERENCIA.md](SHOPEE_API_REFERENCIA.md)
  - Codigo: `functions/src/services/shopee*.service.ts` e `functions/src/routes/shopee*.routes.ts`
- `Acompanhar progresso de implementacao`:
  - Doc: [SHOPEE_ANUNCIOS_ROADMAP.md](SHOPEE_ANUNCIOS_ROADMAP.md)
- `UI base, layout e componentes compartilhados`:
  - Docs: [COMPONENTS.md](COMPONENTS.md), [UX_RESPONSIVIDADE.md](UX_RESPONSIVIDADE.md)
- `Navegacao e hooks`:
  - Doc: [HOOKS.md](HOOKS.md)
- `Modulos de negocio (tecidos, cores, vinculos, imagens, catalogo)`:
  - Docs em `frontend/src/docs/*.md`

## Mapa rapido de documentacao

### Base do projeto
1. [README.md](../README.md) - visao geral, setup e comandos.
2. [ARCHITECTURE.md](ARCHITECTURE.md) - arquitetura, fluxos e dados.
3. [COMPONENTS.md](COMPONENTS.md) - componentes de layout e UI.
4. [HOOKS.md](HOOKS.md) - hooks principais.

### Shopee
1. [SHOPEE.md](SHOPEE.md) - visao geral da integracao.
2. [SHOPEE_ANUNCIOS.md](SHOPEE_ANUNCIOS.md) - fluxo de criacao/publicacao.
3. [SHOPEE_ANUNCIOS_ROADMAP.md](SHOPEE_ANUNCIOS_ROADMAP.md) - ondas/tasks/status.
4. [SHOPEE_API_REFERENCIA.md](SHOPEE_API_REFERENCIA.md) - endpoints.
5. [SHOPEE_WEBHOOK_SETUP.md](SHOPEE_WEBHOOK_SETUP.md) - setup webhook.
6. [SHOPEE_STOCK_REVIEW.md](SHOPEE_STOCK_REVIEW.md) - revisao de estoque.

### Deploy
1. [DEPLOY.md](DEPLOY.md)
2. [DEPLOY_FIREBASE.md](DEPLOY_FIREBASE.md)

### Modulos frontend
1. [TECIDOS.md](../frontend/src/docs/TECIDOS.md)
2. [ESTAMPAS.md](../frontend/src/docs/ESTAMPAS.md)
3. [CAPTURA_COR.md](../frontend/src/docs/CAPTURA_COR.md)
4. [VINCULOS.md](../frontend/src/docs/VINCULOS.md)
5. [GESTAO_IMAGENS.md](../frontend/src/docs/GESTAO_IMAGENS.md)
6. [CATALOGO.md](../frontend/src/docs/CATALOGO.md)
7. [REINHARD.md](../frontend/src/docs/REINHARD.md)

## Atalhos de busca (para localizar rapido)
- Localizar entrypoint de criacao Shopee:
```powershell
rg -n "CriarAnuncioShopee|STEP_ORDER|tamanhos_precificacao" frontend/src
```
- Localizar payload e publish Shopee:
```powershell
rg -n "publishProduct|add_item|init_tier_variation|size_chart_info" functions/src
```
- Localizar validacoes de UI Shopee:
```powershell
rg -n "canProceedFrom|validationErrors|CategoryAttributes|BrandSelector|SizeChartSelector" frontend/src/pages/CriarAnuncioShopee.tsx
```

## Regra de manutencao de docs
- Sempre atualizar docs quando houver mudanca de interface, fluxo ou modelo de dados.
- Preferir nomes de campos exatamente como no codigo (`imagemGerada`, `titulo_anuncio`, etc.).
- Quando houver regra de precedencia, documentar a ordem explicitamente.
- Em docs de modulo, manter no topo:
  - `entrypoints`
  - `task -> arquivo`
  - `comandos de validacao`
