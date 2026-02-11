# Modulo de Criacao de Anuncios Shopee

Ultima atualizacao: 2026-02-11

## Acompanhamento de ondas e tasks

Para acompanhar execucao por fase (Onda 1, 2 e 3), usar:
- `docs/SHOPEE_ANUNCIOS_ROADMAP.md`

## Visao geral

O fluxo de criacao em `frontend/src/pages/CriarAnuncioShopee.tsx` esta organizado em:

`tecido -> cores -> tamanhos_precificacao -> imagens -> configuracoes -> preview`

O step `tamanhos_precificacao` concentra:
- selecao de comprimentos (vindos da base de tamanhos ativos)
- calculo de preco por comprimento ou preco unico
- configuracao de margem e custo

## Precificacao (CNPJ)

Parametros persistidos:
- `custo_metro`
- `margem_liquida_percentual`
- `modo_margem_lucro` (`percentual` ou `valor_fixo`)
- `margem_lucro_fixa`
- `margem_por_tamanho` (override por comprimento)
- `comissao_percentual`
- `taxa_fixa_item`
- `valor_minimo_baixo_valor`
- `adicional_baixo_valor`
- `teto_comissao`
- `aplicar_teto`
- `aplicar_baixo_valor`

### Formula base (V1)

- sem teto: `preco = (C + F + B) / (1 - r - m)`
- com teto: `preco = (C + F + B + T) / (1 - m)` (quando teto efetivamente aplicado)
- baixo valor: calcula com `B=0`; se ficar abaixo do minimo, recalcula com adicional

Onde:
- `C`: custo de material por comprimento
- `F`: taxa fixa por item
- `r`: comissao percentual
- `m`: margem percentual (quando modo percentual)
- `T`: teto de comissao

## Ajustes de UX na tela de precificacao

Exibidos no step:
- `custo por metro`
- `modo da margem` (percentual ou valor fixo)
- valor da margem global
- margem por comprimento (opcional)

Ocultos na UI (mas ainda usados no calculo):
- `comissao_percentual`
- `taxa_fixa_item`
- `valor_minimo_baixo_valor`
- `adicional_baixo_valor`
- `teto_comissao`

Flags de regra no payload:
- `aplicar_teto = true`
- `aplicar_baixo_valor = true`

## Comportamento de preco por comprimento

1. O botao `Calcular precos sugeridos` recalcula e sobrescreve os precos do bloco `Preco por Comprimento`.
2. O valor sugerido e arredondado para cima usando centavos preferenciais:
- termina em `,50` ou `,90` (o mais proximo acima do valor bruto).
3. A tela exibe `Lucro liquido` em reais por comprimento e no preco unico.

## Contratos e persistencia

Tipos atualizados:
- `frontend/src/types/shopee-product.types.ts`
- `functions/src/types/shopee-product.types.ts`

Campo principal:
- `precificacao` no produto/draft

Persistencia backend:
- create/update mantem `precificacao`
- fluxo de publicacao continua baseado em `preco_base` e `precos_por_tamanho`

## Defaults de preferencias Shopee

Campos de defaults foram expandidos para precificacao em:
- `functions/src/types/shopee-preferences.types.ts`
- `functions/src/services/shopee-preferences.service.ts`
- `functions/src/routes/shopee-preferences.routes.ts`
- `frontend/src/hooks/useShopeePreferences.ts`
- `frontend/src/pages/PreferenciasShopee.tsx`

O step permite:
- carregar defaults
- salvar parametros atuais como padrao

## Validacoes de fluxo

- `canProceedFromCores`: exige ao menos 1 cor
- `canProceedFromTamanhosPrecificacao`: exige preco valido
- `canProceedFromImagens`: mantem validacao atual

## Testes

- Unitario frontend: `frontend/src/lib/shopeePricing.test.ts`
- Unitario backend: `functions/src/__tests__/shopee-product.service.precificacao.test.ts`

Observacao de performance:
- evitar testes pesados de regeneracao de imagem em massa no fluxo de UI.

## Onda 1 concluida (Conformidade API + Bugs Criticos)

Status: concluida em 2026-02-11 (validacao cross aprovada).

Principais ajustes aplicados:
- `get_attribute_tree` com contrato `category_id_list` e fallback compativel (`category_ids`/`category_id`) no backend.
- obrigatoriedade de marca ajustada no frontend para ler `is_mandatory`.
- size chart corrigido com `category_id` e `page_size` no endpoint de listagem.
- suporte a size chart baseado em `get_item_limit.size_chart_supported`.
- publicacao alterada para enviar `size_chart_info: { size_chart_id }`.
- `logistic_info` persistido no draft e respeitado no publish (com filtro de compatibilidade por peso/dimensoes).
- ownership reforcado no `GET /api/shopee/products/:id` (aceitando `created_by`/`user_id`).

Arquivos centrais da onda:
- `functions/src/services/shopee-category.service.ts`
- `functions/src/services/shopee-item-limit.service.ts`
- `functions/src/routes/shopee-item-limit.routes.ts`
- `functions/src/services/shopee-product.service.ts`
- `functions/src/routes/shopee-products.routes.ts`
- `frontend/src/components/Shopee/BrandSelector.tsx`
- `frontend/src/components/Shopee/SizeChartSelector.tsx`
- `frontend/src/pages/CriarAnuncioShopee.tsx`
- `frontend/src/types/shopee-product.types.ts`
- `functions/src/types/shopee-product.types.ts`
