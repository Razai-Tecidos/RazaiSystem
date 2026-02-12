# Modulo de Criacao de Anuncios Shopee

Ultima atualizacao: 2026-02-12

## Acompanhamento de ondas e tasks

Para acompanhar execucao por fase (Onda 1, 2 e 3), usar:
- este documento (secoes "Onda 1/2/3 concluida")
- `docs/ENTREGAS_2026-02-11.md` (consolidado das entregas implementadas)

## Navegacao rapida (para agentes)

### Entrypoints de codigo
- UI principal do fluxo: `frontend/src/pages/CriarAnuncioShopee.tsx`
- Auto-fill de atributos: `frontend/src/components/Shopee/CategoryAttributes.tsx`
- Logica de precificacao: `frontend/src/lib/shopeePricing.ts`
- Publicacao/backend Shopee: `functions/src/services/shopee-product.service.ts`
- Rotas Shopee: `functions/src/routes/shopee-products.routes.ts`
- Tipos compartilhados:
  - `frontend/src/types/shopee-product.types.ts`
  - `functions/src/types/shopee-product.types.ts`

### Task -> arquivo
- `mudar ordem/validacao de steps`: `frontend/src/pages/CriarAnuncioShopee.tsx`
- `mudar formula de preco/lucro`: `frontend/src/lib/shopeePricing.ts`
- `mudar defaults de precificacao`: `frontend/src/hooks/useShopeePreferences.ts` + `functions/src/services/shopee-preferences.service.ts`
- `mudar payload de publicacao`: `functions/src/services/shopee-product.service.ts`
- `mudar validacao de categoria/marca/size chart`: `frontend/src/components/Shopee/*.tsx` + `functions/src/services/shopee-category.service.ts` + `functions/src/services/shopee-item-limit.service.ts`
- `mudar auto-fill de atributos`: `frontend/src/components/Shopee/CategoryAttributes.tsx` (logica + `ATTR_UNITS` + `buildDynamicDefaults`)
- `mudar dados enviados para auto-fill`: `frontend/src/pages/CriarAnuncioShopee.tsx` (`tecidoDataForAttributes` useMemo)
- `mudar timing/retry de imagens 3:4`: `functions/src/services/shopee-product.service.ts`

### Comandos de verificacao
```powershell
# testes de precificacao
cd frontend; npm run test -- src/lib/shopeePricing.test.ts

# build frontend
cd frontend; npm run build

# validacao cross (quando houver mudanca backend/functions)
powershell -ExecutionPolicy Bypass -File scripts/validate-change.ps1 -RepoRoot c:/Users/razailoja/Desktop/RazaiSystem -Scope cross
```

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

### Semantica de margem (importante)

- `modo_margem_lucro = percentual`:
  - `margem_liquida_percentual` representa o percentual de lucro liquido sobre o preco final.
- `modo_margem_lucro = valor_fixo`:
  - `margem_lucro_fixa` representa lucro liquido alvo por metro (`R$/m`).
  - lucro liquido alvo total por variacao = `margem_lucro_fixa * comprimento_m`.

### Formula base (V1)

- taxa adicional fixa de antecipacao: `a = 3%` sobre o valor liquido da venda
- sem teto: `preco = (C + (1-a)*(F+B)) / ((1-a)*(1-r) - m)`
- com teto: `preco = (C + (1-a)*(F+B+T)) / ((1-a) - m)` (quando teto efetivamente aplicado)
- baixo valor: calcula com `B=0`; se ficar abaixo do minimo, recalcula com adicional

Onde:
- `C`: custo de material por comprimento
- `F`: taxa fixa por item
- `r`: comissao percentual
- `m`: margem percentual (quando modo percentual)
- `T`: teto de comissao
- `a`: taxa de antecipacao (fixa em 3%)

Complemento para `modo_margem_lucro = valor_fixo`:

- `MfixTotal = margem_lucro_fixa * comprimento_m`
- sem teto: `preco = (C + (1-a)*(F+B) + MfixTotal) / ((1-a)*(1-r))`
- com teto efetivamente aplicado: `preco = (C + MfixTotal + (1-a)*(F+B+T)) / (1-a)`

### Validacao inversa de lucro

Para validar se o calculo bate:

- `lucro_liquido_total = preco - comissao(preco) - F - B - C`
- `taxa_antecipacao = 3% * (preco - comissao(preco) - F - B)`
- `lucro_liquido_total = preco - comissao(preco) - F - B - taxa_antecipacao - C`
- `lucro_liquido_por_metro = lucro_liquido_total / comprimento_m`

Exemplos esperados no modo fixo por metro:

- 1m x 1,60m com `margem_lucro_fixa = 5` -> lucro liquido total esperado `R$ 5,00`
- 2m x 1,60m com `margem_lucro_fixa = 4` -> lucro liquido total esperado `R$ 8,00`
- 3m x 1,60m com `margem_lucro_fixa = 3` -> lucro liquido total esperado `R$ 9,00`

## Ajustes de UX na tela de precificacao

Exibidos no step:
- `custo por metro`
- `modo da margem` (percentual ou valor fixo)
- valor da margem global
- margem por comprimento (opcional)
- quando `valor_fixo`, a UI trata o campo como `R$/m`

Ocultos na UI (mas ainda usados no calculo):
- `comissao_percentual`
- `taxa_fixa_item`
- `valor_minimo_baixo_valor`
- `adicional_baixo_valor`
- `teto_comissao`
- taxa de antecipacao fixa de `3%` sobre o valor liquido da venda

Flags de regra no payload:
- `aplicar_teto = true`
- `aplicar_baixo_valor = true`

## Comportamento de preco por comprimento

1. O botao `Calcular precos sugeridos` recalcula e sobrescreve os precos do bloco `Preco por Comprimento`.
2. O valor sugerido e arredondado para cima usando centavos preferenciais:
- termina em `,50` ou `,90` (o mais proximo acima do valor bruto).
3. A tela exibe `Lucro liquido` em reais por comprimento e no preco unico.
4. No bloco por comprimento, a tela exibe:
- `Lucro liquido total` da variacao
- valor entre parenteses `(.../m)` com o lucro por metro

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
- `canProceedFromImagens`: exige 9 imagens `1:1` e 9 imagens `3:4`

## Auto-fill de atributos

### Componente: `CategoryAttributes.tsx`

O componente pre-preenche atributos automaticamente ao selecionar categoria, usando dados do tecido:

- **Material**: extraido de `composicao` do tecido (ex: "Poliester e Elastano")
- **Estampa/Pattern**: baseado em `tipo` ("liso" → "Lisa", "estampado" → "Estampada")
- **Largura/Width (100660)**: de `tecido.largura`, com `value_unit: "m"`
- **Comprimento/Length (100594)**: dos tamanhos selecionados, multi-valor com `value_unit: "m"`

### Mecanismo tecnico
- `buildDynamicDefaults()` monta defaults a partir de `tecidoData` prop
- `ATTR_UNITS` map define unidades por atributo (`comprimento: 'm'`, `largura: 'm'`)
- COMBO_BOX free-text: `value_id: 0` + `original_value_name` + `value_unit` (se aplicavel)
- Auto-fill roda 1x ao carregar atributos (guarda `autoFilledRef`)
- `onChange` usa ref estavel para evitar loops de re-render

### Dados enviados de `CriarAnuncioShopee.tsx`
- `tecidoDataForAttributes` useMemo monta: `{ composicao, tipo, largura, comprimentos }`
- `comprimentos` extraidos de `selectedTamanhos` via `extractMetersFromTamanhoNome()`

## Regra de galeria de imagens (1:1 e 3:4)

- o fluxo trabalha com duas galerias independentes: `imagens_principais_1_1` e `imagens_principais_3_4`
- cada galeria suporta ate 9 imagens
- a capa de cada proporcao e a primeira imagem da lista (indice `0`)
- no preenchimento automatico, a ordem inicial e:
  1. mosaicos mais recentes da proporcao
  2. imagens premium da mesma proporcao (randomizadas)
- no publish, e enviada apenas a galeria do `imagem_ratio_principal` selecionado

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
- suporte a size chart baseado em `get_item_limit` → `size_chart_limit.support_image_size_chart`.
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

## Onda 2 concluida (Robustez de Publicacao)

Status: concluida em 2026-02-11 (validacao cross aprovada).

Principais ajustes aplicados:
- lock transacional com TTL para publish por draft (`publish_lock`), evitando concorrencia.
- comportamento idempotente quando item ja foi criado na Shopee.
- rollback automatico (`delete_item`) quando `add_item` passa e `init_tier_variation` falha.
- validacao pre-publish reforcada no backend:
  - atributos obrigatorios da categoria
  - marca obrigatoria da categoria
  - consistencia de logistica habilitada
  - compatibilidade de size chart com categoria
- bloqueios equivalentes no frontend para impedir avancar/publicar com obrigatorios pendentes.

## Onda 3 concluida (Performance + Observabilidade + DX)

Status: concluida em 2026-02-11 (validacao cross aprovada).

Principais ajustes aplicados:
- logs estruturados por etapa no publish (`lock`, `validation`, `upload`, `add_item`, `init_tier_variation`, `rollback`, `persist`);
- upload resiliente com pool controlado e retry/backoff para falhas transientes de imagem;
- cache de categorias e logistica particionado por `shop_id + language` (default `pt-BR`);
- rotas/hooks preparados para propagar `language` e evitar mistura de cache entre contextos;
- testes de regressao adicionais para:
  - retry de upload no fluxo de publish;
  - cache por idioma em categorias/logistica;
  - propagacao de `language` em hook frontend.
- backlog fechado com:
  - paginacao completa de marcas (`get_brand_list`) via agregacao de paginas no backend;
  - mensagens de erro orientadas por endpoint Shopee nas rotas/componentes principais do fluxo;
  - gate de politica em CI/local para bloquear endpoints Shopee proibidos.

Detalhes e evidencias de validacao:
- `docs/SHOPEE_ANUNCIOS.md`
- `docs/ENTREGAS_2026-02-11.md`

## Correcoes pos-Onda 3 (2026-02-12)

### Fix: Imagens 3:4 nao apareciam na publicacao
- **Problema**: `update_item` para imagens 3:4 falhava com `error_item_or_variation_not_found` porque era chamado imediatamente apos `init_tier_variation`.
- **Causa raiz**: Shopee precisa de ~5s para processar o item apos `init_tier_variation`.
- **Fix**: Adicionado delay de 5s antes do `update_item` + retry com mais 5s se falhar com "not_found".
- **Arquivo**: `functions/src/services/shopee-product.service.ts`

### Fix: Auto-fill de atributos nao funcionava
- **Problema**: useEffect de auto-fill entrava em loop ciclico por `onChange` nao memoizado.
- **Fix**: `onChange` via `useRef` + guard `autoFilledRef` para rodar apenas 1x.
- **Arquivo**: `frontend/src/components/Shopee/CategoryAttributes.tsx`

### Feature: Auto-fill de Largura e Comprimento
- Width (100660) e Length (100594) agora sao pre-preenchidos com dados do tecido/tamanhos.
- Ambos usam `value_unit: "m"` (minusculo, validado em producao).
- **Arquivos**: `CategoryAttributes.tsx`, `CriarAnuncioShopee.tsx`
