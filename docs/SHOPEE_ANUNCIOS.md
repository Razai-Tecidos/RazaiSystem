# Modulo de Criacao de Anuncios Shopee

Ultima atualizacao: 2026-02-10

## Visao geral

A tela `CriarAnuncioShopee.tsx` monta rascunhos e publica anuncios usando dados de:
- tecido
- vinculos cor-tecido
- tamanhos
- configuracoes de categoria/logistica/fiscal

Acesso na UX atual:
- `Home` -> `Shopee` -> card `Criar Anuncio` (abre `AnunciosShopee`)
- hash legado `#/anuncios-shopee` permanece funcional

O backend (`functions/src/services/shopee-product.service.ts`) transforma o rascunho em payload Shopee e executa `add_item` + `init_tier_variation`.

## O que mudou nesta fase

1. Titulo do anuncio editavel:
- campo `Titulo do Anuncio` na etapa de configuracoes
- salvo em `titulo_anuncio`
- validacao: vazio (usa auto) ou entre 20 e 120 caracteres

2. Nova etapa dedicada de imagens no fluxo:
- ordem de etapas agora: `tecido -> imagens -> cores -> configuracoes -> preview`
- a selecao de imagens principais foi movida para uma etapa propria, logo apos o tecido
- a etapa de configuracoes ficou focada apenas em dados comerciais/logisticos/fiscais

3. Integracao com mosaicos:
- carrega mosaicos salvos por tecido (`gestao_imagens_mosaicos`)
- permite clicar em um mosaico para definir capa (`imagens_principais[0]`)

4. Prioridade de imagem por variacao:
- frontend e backend priorizam `imagemGerada`
- fallback para `imagemTingida`
- flag `imagem_gerada` acompanha cada opcao de cor

5. Publicacao com tratamento de imagem gerada:
- `imagem_gerada = true`: upload direto para Shopee
- `imagem_gerada = false`: backend aplica overlay antes do upload

## Fluxo resumido

1. Usuario seleciona tecido.
2. Usuario seleciona imagens principais (upload manual ou mosaicos salvos).
3. Sistema carrega vinculos e usuario escolhe cores/tamanhos.
4. Usuario configura dados comerciais/logisticos/fiscais.
5. Usuario pode ajustar titulo manualmente.
6. Salva rascunho em `shopee_products`.
7. Publica com validacao e upload de imagens.

## Estrutura de dados relevante

### Frontend/Backend: `CreateShopeeProductData`
Campos importantes nesta fase:
```ts
{
  shop_id: number;
  tecido_id: string;
  cores: Array<{ cor_id: string; estoque: number }>;
  tamanhos?: string[];
  preco_base: number;
  estoque_padrao: number;
  categoria_id: number;
  peso: number;
  dimensoes: { comprimento: number; largura: number; altura: number };
  titulo_anuncio?: string;
  descricao_customizada?: string;
  imagens_principais?: string[];
}
```

### Firestore: `shopee_products`
Campos adicionados/mais usados:
- `titulo_anuncio?: string`
- `tier_variations[].options[].imagem_url`
- `tier_variations[].options[].imagem_gerada?: boolean`

## Endpoints principais

```txt
GET    /api/shopee/products
GET    /api/shopee/products/:id
POST   /api/shopee/products
PUT    /api/shopee/products/:id
DELETE /api/shopee/products/:id
POST   /api/shopee/products/:id/publish
POST   /api/shopee/products/:id/sync
POST   /api/shopee/products/sync-all
```

## Validacoes principais

- Titulo: vazio (auto) ou 20-120 chars.
- Categoria obrigatoria.
- Preco valido (unico ou por tamanho).
- Peso e dimensoes maiores que zero.
- Pelo menos uma cor selecionada.
- Pelo menos uma imagem principal recomendada.

## Integracao com Gestao de Imagens

- Imagens geradas em `GestaoImagens` alimentam variacoes do anuncio.
- Mosaicos salvos podem ser usados como capa sem upload manual novo.
- Resultado: menor retrabalho no fluxo de anuncio.

## Observacoes de implementacao

- `titulo_anuncio` e persistido em create/update no backend.
- Publicacao usa `titulo_anuncio` quando presente; fallback para nome do tecido.
- Caso imagem da variacao nao seja gerada, backend aplica overlay para manter padrao visual.
