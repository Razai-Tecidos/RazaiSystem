# Modulo de Gestao de Imagens

Ultima atualizacao: 2026-02-10

## Objetivo

Centralizar operacoes de imagem que antes estavam dispersas no fluxo de criacao de anuncio:
- gerar imagem de variacao por vinculo
- salvar essa imagem no Firebase
- subir foto de modelo por vinculo
- montar mosaicos para capa de anuncio Shopee

Arquivo principal:
- `frontend/src/pages/GestaoImagens.tsx`

## Fonte de dados

Base principal:
- `cor_tecido`

Campos utilizados:
- `imagemTingida`
- `imagemGerada`
- `imagemGeradaFingerprint`
- `imagemModelo`

## Tabela operacional

Estrutura atual:
- uma tabela por tecido (`tecidoId`)
- cabecalho por tecido com contagem de vinculos
- botao `Regenerar todos deste tecido` por secao

Colunas por tabela:
1. Selecao para mosaico
2. Cor (nome + SKU)
3. Imagem Vinculo (`imagemTingida`)
4. Imagem Gerada (`imagemGerada`)
5. Foto Modelo (`imagemModelo`)
6. Acoes (`Upload modelo`)

## Geracao de imagem de variacao

Pipeline:
1. Ler `imagemTingida`.
2. Aplicar overlay visual (`generateBrandOverlay`).
3. Salvar em Storage via `uploadImagemGerada`.
4. Atualizar vinculo no Firestore com:
- `imagemGerada`
- `imagemGeradaFingerprint`
- `imagemGeradaAt`

### Persistencia

A imagem gerada fica salva no Firebase.
Nao precisa gerar novamente enquanto fingerprint nao mudar.

Fingerprint atual:
- `imagemTingida + corNome`

Se mudar, a tela regenera automaticamente.

### Regeneracao manual

- Regeneracao individual por linha foi removida.
- A regeneracao manual agora e em lote por tecido.
- Processamento com concorrencia controlada para reduzir picos.

## Upload de foto de modelo

Acao por linha:
- seleciona arquivo local
- upload para `cor-tecido/{vinculoId}/modelo_*.*`
- salva:
- `imagemModelo`
- `imagemModeloAt`

## Mosaicos

Builder em:
- `frontend/src/lib/mosaicBuilder.ts`

Templates:
- `grid-2x2`
- `hero-vertical`
- `triptych`

Saidas:
- quadrada `1024x1024`
- vertical `1062x1416`

Formato atual de saida:
- JPEG (`.jpg`)

Persistencia:
- Storage: `mosaicos/{tecidoId}/{mosaicoId}/...`
- Firestore: `gestao_imagens_mosaicos`

Documento de mosaico:
```ts
{
  tecidoId,
  tecidoNomeSnapshot,
  templateId,
  sourcePolicy: 'gerada',
  selectedVinculoIds,
  selectedImageUrls,
  outputSquareUrl,
  outputPortraitUrl,
  createdBy,
  createdAt,
}
```

## Integracao com Criar Anuncio Shopee

Na tela `CriarAnuncioShopee.tsx`:
- mosaicos salvos do tecido aparecem para selecao
- clique em mosaico define capa em `imagens_principais`
- variacoes usam `imagemGerada` com prioridade

## Regras de seguranca

Firestore (`firestore.rules`):
- `gestao_imagens_mosaicos`: read/write autenticado

Storage (`storage.rules`):
- `mosaicos/{tecidoId}/**`: read publico, write autenticado

## Arquivos relacionados

- `frontend/src/pages/GestaoImagens.tsx`
- `frontend/src/lib/brandOverlay.ts`
- `frontend/src/lib/mosaicBuilder.ts`
- `frontend/src/lib/firebase/cor-tecido.ts`
- `frontend/src/lib/firebase/gestao-imagens.ts`
- `frontend/src/types/gestao-imagens.types.ts`
