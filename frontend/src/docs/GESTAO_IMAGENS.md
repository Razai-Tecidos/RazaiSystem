# Modulo de Gestao de Imagens

Ultima atualizacao: 2026-02-11

## Objetivo

Centralizar operacoes de imagem para Shopee por tecido, considerando:
- vinculos de cor (`cor_tecido`)
- estampas vinculadas ao tecido (`estampas.tecidoBaseId`)

Para vinculos de cor:
- gerar imagem de variacao (`imagemGerada`)
- subir/trocar foto de modelo (`imagemModelo`)
- gerar premium 1:1 e 3:4 (`imagemPremiumSquare`, `imagemPremiumPortrait`)

Para o mosaico:
- montar e salvar mosaicos por tecido com imagens de cor e/ou estampa

Arquivo principal:
- `frontend/src/pages/GestaoImagens.tsx`

## Persistencia no Firebase

Todos os fluxos de imagem salvam em Storage e depois atualizam Firestore:

1. Imagem gerada:
- Storage: `cor-tecido/{vinculoId}/gerada_*`
- Firestore (`cor_tecido`): `imagemGerada`, `imagemGeradaFingerprint`, `imagemGeradaAt`

2. Foto de modelo:
- Storage: `cor-tecido/{vinculoId}/modelo_*`
- Firestore (`cor_tecido`): `imagemModelo`, `imagemModeloAt`

3. Premium:
- Storage: `cor-tecido/{vinculoId}/premium_square_*` e `premium_portrait_*`
- Firestore (`cor_tecido`): `imagemPremiumSquare`, `imagemPremiumPortrait`, `imagemPremiumAt`

4. Mosaico:
- Storage principal: `mosaicos/{tecidoId}/{mosaicoId}/...`
- Fallback de compatibilidade: `cor-tecido/{tecidoId}/mosaicos/{mosaicoId}/...`
- Firestore (`gestao_imagens_mosaicos`): metadados do mosaico + URLs finais

## Tabela por tecido

A tela agrupa itens por tecido e exibe na mesma tabela:
- linhas de cor (pipeline completo: gerada/modelo/premium)
- linhas de estampa (imagem vinculada, imagem gerada e selecao para mosaico)

Acoes no cabecalho:
- `Regenerar todos deste tecido`
- `Gerar premium deste tecido`
- `Ver ultimo mosaico`

Regra de processamento:
- lotes com concorrencia controlada para evitar pico de memoria.

Observacao:
- para linhas de estampa, `Imagem Gerada` e regeneracao em lote sao suportadas.
- colunas `Foto Modelo` e `Premium` continuam `N/A` para estampas.

## Acoes por imagem (hover)

### Foto de modelo
- botao de visualizacao 1:1
- botao de upload/troca da imagem de modelo

### Premium
- botao `1:1` para abrir `imagemPremiumSquare`
- botao `3:4` para abrir `imagemPremiumPortrait`

## Regras de mosaico

1. Nao permite misturar tecidos no mesmo mosaico.
2. O mosaico salvo no fluxo atual usa `sourcePolicy: 'original'`.
3. Ao gerar mosaico para um tecido, ele ja e marcado como default do tecido:
- `isDefaultForTecido: true`
4. Apenas um mosaico pode ser default por tecido (controle via batch update).
5. Selecao aceita:
- `cor_tecido.imagemTingida`
- `estampas.imagem`
6. `selectedVinculoIds` guarda chaves prefixadas para identificar origem:
- `cor:{id}`
- `estampa:{id}`

Colecao:
- `gestao_imagens_mosaicos`

Campos principais do documento:
```ts
{
  tecidoId,
  tecidoNomeSnapshot,
  templateId,
  sourcePolicy: 'original' | 'gerada',
  selectedVinculoIds,
  selectedImageUrls,
  outputSquareUrl,
  outputPortraitUrl,
  isDefaultForTecido,
  createdBy,
  createdAt
}
```

## Integracao com Criar Anuncio Shopee

- Mosaicos salvos por tecido podem ser usados como capa.
- Variacoes de cor no Shopee usam prioridade de `imagemGerada` quando disponivel.

## Regras de seguranca

Firestore (`firestore.rules`):
- `gestao_imagens_mosaicos`: `read/write` autenticado

Storage (`storage.rules`):
- `mosaicos/{tecidoId}/**`: `read` publico, `write` autenticado
- `cor-tecido/{vinculoId}/**`: `read` publico, `write` autenticado

## Arquivos relacionados

- `frontend/src/pages/GestaoImagens.tsx`
- `frontend/src/lib/firebase/cor-tecido.ts`
- `frontend/src/lib/firebase/gestao-imagens.ts`
- `frontend/src/lib/mosaicBuilder.ts`
- `frontend/src/types/gestao-imagens.types.ts`
