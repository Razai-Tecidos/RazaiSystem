# Roadmap de Melhorias - Criacao de Anuncios Shopee

Ultima atualizacao: 2026-02-11
Responsavel: Time Razai
Escopo: `cross` (frontend + functions + contratos)

## Como usar este documento

Legenda de status:
- `[ ]` nao iniciado
- `[~]` em andamento
- `[x]` concluido
- `[!]` bloqueado

Regra de atualizacao:
1. Atualize o status da task.
2. Registre data e observacao curta no bloco da tarefa.
3. Quando fechar uma onda, preencha a secao "Validacao da onda".

## Uso rapido (para agentes)

1. Identifique a onda alvo pelo objetivo:
- Onda 1: conformidade de contrato Shopee + bugs criticos.
- Onda 2: robustez de publicacao (lock, rollback, validacao reforcada).
- Onda 3: performance, observabilidade e testes de regressao.
2. Dentro da onda, procure a task pelo ID (`O1.2`, `O2.3`, etc.).
3. Use o bloco `Arquivos alvo` como primeira lista de arquivos para abrir.
4. Atualize status + `Data` + `Observacao` na mesma task.
5. Ao finalizar a onda, preencha `Validacao da onda` e `Resultado`.

Atalho de busca:
```powershell
rg -n "O1\\.|O2\\.|O3\\.|Validacao da onda|Resultado" docs/SHOPEE_ANUNCIOS_ROADMAP.md
```

## Onda 1 (P0) - Conformidade API + Bugs Criticos
Objetivo: remover falhas de contrato com Shopee e erros funcionais no publish.

### Tasks
- [x] O1.1 Corrigir contrato de atributos (`category_id_list`)
  Arquivos alvo:
  - `functions/src/services/shopee-category.service.ts`
  - `frontend/src/components/Shopee/CategoryAttributes.tsx`
  Atualizacao:
  - Data: 2026-02-11
  - Observacao: `get_attribute_tree` agora tenta `category_id_list` primeiro, com fallback compativel para `category_ids` e `category_id`.

- [x] O1.2 Corrigir marca obrigatoria (`is_mandatory`)
  Arquivos alvo:
  - `functions/src/routes/shopee-categories.routes.ts`
  - `frontend/src/components/Shopee/BrandSelector.tsx`
  Atualizacao:
  - Data: 2026-02-11
  - Observacao: frontend passou a ler `data.data.is_mandatory` (com fallback legado) no seletor de marca.

- [x] O1.3 Corrigir size chart (`category_id` + `page_size`)
  Arquivos alvo:
  - `functions/src/services/shopee-item-limit.service.ts`
  - `frontend/src/components/Shopee/SizeChartSelector.tsx`
  Atualizacao:
  - Data: 2026-02-11
  - Observacao: endpoint de size chart agora exige `category_id`, aceita `page_size/cursor` e o suporte usa `get_item_limit.size_chart_supported`.

- [x] O1.4 Ajustar payload de publicacao para `size_chart_info` (quando aplicavel)
  Arquivos alvo:
  - `functions/src/services/shopee-product.service.ts`
  Atualizacao:
  - Data: 2026-02-11
  - Observacao: publish alterado para enviar `size_chart_info: { size_chart_id }` no `add_item`.

- [x] O1.5 Fazer logistica configurada na UI ser respeitada no publish
  Arquivos alvo:
  - `frontend/src/pages/CriarAnuncioShopee.tsx`
  - `functions/src/services/shopee-product.service.ts`
  Atualizacao:
  - Data: 2026-02-11
  - Observacao: `logistic_info` passou a ser salvo no draft e priorizado no publish (com filtro de compatibilidade por peso/dimensoes).

- [x] O1.6 Endurecer ownership no `GET /api/shopee/products/:id`
  Arquivos alvo:
  - `functions/src/routes/shopee-products.routes.ts`
  - `functions/src/services/shopee-product.service.ts`
  Atualizacao:
  - Data: 2026-02-11
  - Observacao: rota agora exige autenticacao + ownership (`created_by`/`user_id`) antes de retornar o produto.

### Validacao da onda
- [x] `scripts/validate-change.ps1 -RepoRoot c:/Users/razailoja/Desktop/RazaiSystem -Scope cross`
- [x] `frontend`: `npm test` + `npm run build`
- [x] `backend`: `npm test` + `npm run build`
- [x] `functions`: `npm test` + `npm run build`

Resultado:
- Data: 2026-02-11
- Status final: implementacao da Onda 1 concluida com validacao cross completa aprovada.
- Riscos residuais: sem riscos bloqueantes da Onda 1; permanecem apenas warnings nao-fatais de testes frontend (act/window.open) e alerta de chunk grande no build.

---

## Onda 2 (P1) - Robustez de Publicacao
Objetivo: evitar estado inconsistente e melhorar confiabilidade em falhas parciais.

### Tasks
- [x] O2.1 Idempotencia/lock de publish por draft
  Arquivos alvo:
  - `functions/src/services/shopee-product.service.ts`
  - `functions/src/routes/shopee-products.routes.ts`
  Atualizacao:
  - Data: 2026-02-11
  - Observacao: publish agora usa lock transacional com TTL (`publish_lock`), evita concorrencia por draft e retorna idempotente quando o item ja foi criado.

- [x] O2.2 Rollback quando `add_item` passa e `init_tier_variation` falha
  Arquivos alvo:
  - `functions/src/services/shopee-product.service.ts`
  Atualizacao:
  - Data: 2026-02-11
  - Observacao: rollback automatico com `delete_item` quando `add_item` cria item e `init_tier_variation` falha, incluindo persistencia de erro final.

- [x] O2.3 Validacao pre-publish reforcada (atributos/marca/logistica/size chart)
  Arquivos alvo:
  - `frontend/src/pages/CriarAnuncioShopee.tsx`
  - `functions/src/services/shopee-product.service.ts`
  Atualizacao:
  - Data: 2026-02-11
  - Observacao: backend valida obrigatorios de categoria/marca/logistica/size chart antes do publish; frontend bloqueia avanco/publicacao quando obrigatorios estiverem pendentes.

### Validacao da onda
- [x] `scripts/validate-change.ps1 -RepoRoot c:/Users/razailoja/Desktop/RazaiSystem -Scope cross`
- [~] Testes de falha parcial no publish (manual + automatizado)

Resultado:
- Data: 2026-02-11
- Status final: Onda 2 implementada e validada em escopo cross (frontend/backend/functions).
- Riscos residuais: lock depende de TTL (10 min) para recuperacao automatica de publish interrompido; falta um teste dedicado de falha parcial (`add_item` OK + `init_tier_variation` erro) para fechar cobertura especifica.

---

## Onda 3 (P2) - Performance + Observabilidade + DX
Objetivo: tornar operacao mais previsivel, rastreavel e facil de manter.

### Tasks
- [ ] O3.1 Log estruturado por etapa (`upload`, `add_item`, `init_tier_variation`)
  Arquivos alvo:
  - `functions/src/services/shopee-product.service.ts`
  - `functions/src/routes/shopee-products.routes.ts`
  Atualizacao:
  - Data:
  - Observacao:

- [ ] O3.2 Upload de imagem resiliente (pool + retry/backoff)
  Arquivos alvo:
  - `functions/src/services/shopee.service.ts`
  - `functions/src/services/shopee-product.service.ts`
  Atualizacao:
  - Data:
  - Observacao:

- [ ] O3.3 Cache por loja/idioma para categorias e logistica
  Arquivos alvo:
  - `functions/src/services/shopee-category.service.ts`
  - `functions/src/services/shopee-logistics.service.ts`
  Atualizacao:
  - Data:
  - Observacao:

- [ ] O3.4 Testes de contrato e regressao do fluxo critico
  Arquivos alvo:
  - `frontend/src/hooks/useShopee*.test.ts`
  - `functions/src/__tests__/shopee*.test.ts`
  Atualizacao:
  - Data:
  - Observacao:

### Validacao da onda
- [ ] `scripts/validate-change.ps1 -RepoRoot c:/Users/razailoja/Desktop/RazaiSystem -Scope cross`
- [ ] Smoke manual de criacao/publicacao de anuncio

Resultado:
- Data:
- Status final:
- Riscos residuais:

---

## Backlog (apenas apos Onda 1)
- [ ] Paginacao completa de marcas (`get_brand_list`)
- [ ] Melhorar UX de erros com mensagens orientadas por endpoint Shopee
- [ ] CI gate para impedir endpoints Shopee bloqueados pela politica da skill
