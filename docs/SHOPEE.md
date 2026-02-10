# Integracao Shopee

Ultima atualizacao: 2026-02-10

## Visao geral

A integracao Shopee do RazaiSystem combina:
- frontend para operacao e UX
- Cloud Functions para assinatura de requests, validacao e regras de negocio

Arquivos centrais:
- `functions/src/routes/shopee*.routes.ts`
- `functions/src/services/shopee.service.ts`
- `functions/src/services/shopee-product.service.ts`

## Atualizacoes recentes

1. Criacao de anuncio com `titulo_anuncio` customizavel.
2. Uso de mosaicos salvos como imagem de capa no fluxo de anuncio.
3. Variacoes com prioridade para `imagemGerada`.
4. Publicacao com estrategia hibrida:
- imagem gerada -> upload direto
- imagem nao gerada -> overlay no backend antes do upload
5. Shopee consolidado como modulo pai na navegacao:
- cards internos `Estoque`, `Criar Anuncio` e `Tamanhos`
- remocao do card `Pedidos`
- `#/anuncios-shopee` e `#/tamanhos` preservados por compatibilidade

## Endpoints de operacao (resumo)

### Inventario e disponibilidade
- `POST /api/shopee/inventory`
- `POST /api/shopee/update-color-availability`
- `POST /api/shopee/update-model-status`

### Produtos e anuncios
- `GET /api/shopee/products`
- `GET /api/shopee/products/:id`
- `POST /api/shopee/products`
- `PUT /api/shopee/products/:id`
- `DELETE /api/shopee/products/:id`
- `POST /api/shopee/products/:id/publish`
- `POST /api/shopee/products/:id/sync`
- `POST /api/shopee/products/sync-all`

### Categorias, logistica e preferencias
- `GET /api/shopee/categories`
- `GET /api/shopee/categories/:id/attributes`
- `GET /api/shopee/categories/:id/brands`
- `GET /api/shopee/logistics/enabled`
- `GET /api/shopee/preferences/defaults`

### Webhook
- `POST /api/shopee/webhook`

## Controle de disponibilidade por estoque

O sistema considera disponibilidade de cor pelo estoque (`total_available_stock`), nao por `model_status`.

- Desativar cor: estoque vai para `0`.
- Ativar cor: estoque volta para valor configurado.
- Persistencia de monitoramento: `disabled_colors`.

## Monitoramento de estoque desativado

Camadas:
1. webhook `reserved_stock_change_push`
2. funcao agendada `maintainDisabledColors`

Objetivo:
- evitar reativacao indevida de estoque apos eventos da Shopee.

## Relacao com docs especificos

- Fluxo de anuncio: `docs/SHOPEE_ANUNCIOS.md`
- API detalhada: `docs/SHOPEE_API_REFERENCIA.md`
- Setup de webhook: `docs/SHOPEE_WEBHOOK_SETUP.md`
- Revisao de estoque: `docs/SHOPEE_STOCK_REVIEW.md`
