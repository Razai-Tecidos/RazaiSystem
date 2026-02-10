# Documentacao do RazaiSystem

Ultima atualizacao: 2026-02-10

## Mapa rapido

### Base do projeto
1. [README.md](../README.md) - Visao geral, setup e deploy.
2. [ARCHITECTURE.md](ARCHITECTURE.md) - Arquitetura atual, fluxos e modelos de dados.
3. [COMPONENTS.md](COMPONENTS.md) - Componentes de layout e UI relevantes.
4. [HOOKS.md](HOOKS.md) - Hooks principais e utilitarios de navegacao.

### UX e navegacao
1. [UX_RESPONSIVIDADE.md](UX_RESPONSIVIDADE.md) - UX desktop/mobile e padroes de navegacao.

### Shopee
1. [SHOPEE.md](SHOPEE.md) - Visao geral da integracao.
2. [SHOPEE_ANUNCIOS.md](SHOPEE_ANUNCIOS.md) - Fluxo completo de criacao/publicacao de anuncios.
3. [SHOPEE_API_REFERENCIA.md](SHOPEE_API_REFERENCIA.md) - Referencia de endpoints.
4. [SHOPEE_WEBHOOK_SETUP.md](SHOPEE_WEBHOOK_SETUP.md) - Setup de webhook.
5. [SHOPEE_STOCK_REVIEW.md](SHOPEE_STOCK_REVIEW.md) - Revisao de estoque.

### Deploy
1. [DEPLOY.md](DEPLOY.md)
2. [DEPLOY_FIREBASE.md](DEPLOY_FIREBASE.md)

### Documentacao de modulos (frontend)
1. [TECIDOS.md](../frontend/src/docs/TECIDOS.md)
2. [ESTAMPAS.md](../frontend/src/docs/ESTAMPAS.md)
3. [CAPTURA_COR.md](../frontend/src/docs/CAPTURA_COR.md)
4. [VINCULOS.md](../frontend/src/docs/VINCULOS.md)
5. [GESTAO_IMAGENS.md](../frontend/src/docs/GESTAO_IMAGENS.md)
6. [REINHARD.md](../frontend/src/docs/REINHARD.md)

## O que mudou nesta atualizacao
- Navegacao desktop persistente com `DesktopSidebar`, atalhos e historico recente.
- Sincronizacao de modulo ativo com URL hash (`#/modulo`) sem React Router.
- Novo modulo `Gestao de Imagens` com geracao de imagem, upload de modelo e mosaicos.
- `Gestao de Imagens` agora agrupa por tecido e permite regeneracao em lote por tecido.
- `Shopee` passou a ser modulo pai para `Criar Anuncio` e `Tamanhos`.
- Integracao do fluxo Shopee com `titulo_anuncio` e selecao de capa por mosaico.
- Ajustes no modulo Vinculos com ampliacao de imagem na tela.
- Atualizacao das regras de Firebase para `gestao_imagens_mosaicos` e `mosaicos/**`.

## Convencoes
- Sempre atualizar os docs quando houver mudanca de interface, fluxo ou modelo de dados.
- Preferir nomes de campos exatamente como no codigo (`imagemGerada`, `titulo_anuncio`, etc.).
- Quando houver regra de precedencia (ex.: inicializacao de pagina), documentar ordem explicitamente.
