# Modulo de Vinculos Cor-Tecido

Ultima atualizacao: 2026-02-11

## entrypoints

- `frontend/src/pages/Vinculos.tsx` (UI, filtros, exportacoes, checklist PDF)
- `frontend/src/components/Vinculos/VinculosChecklistPdfDocument.tsx` (layout e paginacao do PDF)
- `frontend/src/lib/firebase/cor-tecido.ts` (persistencia e geracao de thumbs)
- `frontend/src/types/cor.types.ts` (contrato `CorTecido`)

## task -> arquivo

- `Ajustar quebra de pagina do checklist PDF`: `frontend/src/components/Vinculos/VinculosChecklistPdfDocument.tsx`
- `Trocar preview original por thumb no PDF`: `frontend/src/pages/Vinculos.tsx`
- `Adicionar/ajustar campos de thumbs no vinculo`: `frontend/src/types/cor.types.ts`
- `Gerar thumbs automaticamente no create/update`: `frontend/src/lib/firebase/cor-tecido.ts`

## comandos de validacao

```powershell
npm run build:frontend
rg -n "handleExportarChecklistPdf|imagemTingidaThumb|Checklist Rapido" frontend/src/pages/Vinculos.tsx
rg -n "paginateSections|estimateSectionHeight|MIN_ROWS_FOR_SPLIT_IN_CURRENT_PAGE" frontend/src/components/Vinculos/VinculosChecklistPdfDocument.tsx
```

## Visao geral

O modulo de Vinculos gerencia a relacao entre cores e tecidos na collection `cor_tecido`.

Cada vinculo representa uma combinacao unica de:
- `corId`
- `tecidoId`

Com dados denormalizados para exibir rapido na UI (`corNome`, `tecidoNome`, `corSku`, `tecidoSku`).

## Modelo de dados (resumo)

Arquivo de tipos: `frontend/src/types/cor.types.ts`

```ts
interface CorTecido {
  id: string;
  sku?: string;
  corId: string;
  corNome: string;
  corHex?: string;
  corSku?: string;
  tecidoId: string;
  tecidoNome: string;
  tecidoSku?: string;
  imagemTingida?: string;
  imagemTingidaThumb?: string;
  imagemGerada?: string;
  imagemGeradaThumb?: string;
  imagemGeradaFingerprint?: string;
  imagemGeradaAt?: Timestamp;
  imagemModelo?: string;
  imagemModeloThumb?: string;
  imagemPremiumSquare?: string;
  imagemPremiumSquareThumb?: string;
  imagemPremiumPortrait?: string;
  imagemPremiumPortraitThumb?: string;
  imagemModeloAt?: Timestamp;
  ajustesReinhard?: ReinhardConfig;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp;
}
```

## Funcionalidades da tela

Arquivo: `frontend/src/pages/Vinculos.tsx`

1. Listagem agrupada por tecido (expandir/recolher).
2. Busca e filtros.
3. Edicao inline de nome e SKU de cor.
4. Acoes em lote por grupo (copiar SKUs/HEX/nomes, download preview).
5. Exportacao XLSX.
6. Exportacao de checklist PDF em 2 modos:
   - `Checklist PDF` (com thumbs),
   - `Checklist Rapido` (sem thumbs, geracao mais rapida e arquivo menor).
7. Diagnostico de referencias invalidas.

## Checklist PDF (regras atuais)

Arquivos:
- `frontend/src/pages/Vinculos.tsx`
- `frontend/src/components/Vinculos/VinculosChecklistPdfDocument.tsx`

Regras principais:
- A tabela por tecido evita quebra ruim no fim de pagina:
  - se a secao inteira do tecido cabe em uma pagina vazia, ela comeca na proxima pagina (nao quebra no fim da atual).
- Quando ha thumbs:
  - prioriza `imagemTingidaThumb`/`imagemThumb` e usa original apenas como fallback.
  - pode comprimir previews em memoria para reduzir tamanho final do PDF.
- Quando usar `Checklist Rapido`:
  - nao renderiza coluna de thumb no PDF.
  - foco em velocidade de geracao.

## Preview ampliado de imagem

Arquivo: `frontend/src/components/ui/image-lightbox.tsx`

Comportamento:
- clicar na miniatura abre modal de preview
- imagem respeita o limite do modal com `object-contain`
- sem scroll interno da imagem causado por dimensao original

## Integracao com Cores (navegacao cruzada)

- `Cores.tsx` recebe `onNavigateToVinculos?: () => void`.
- Em `CoresTable`, a acao `+X mais...` chama esse callback quando disponivel.
- Se nao houver callback, fallback para `onNavigateHome`.

Isso reduz o caminho de navegacao entre modulos.

## Integracao com Gestao de Imagens

- Vinculos continua sendo a base de dados para imagens.
- Geracao de `imagemGerada` e upload de `imagemModelo` acontecem no modulo `Gestao de Imagens`.
- Vinculos pode exibir/usar essas informacoes sem duplicar fluxo.

## SKU de vinculo

Regra:
- formato `TecidoSKU-CorSKU`
- exemplo: `T007-AZ001`

Ajustes:
- geracao em lote para dados antigos
- propagacao quando SKU de cor/tecido muda

## Firestore e Storage

Firestore:
- collection `cor_tecido`

Storage:
- `cor-tecido/{vinculoId}/tingida_*.jpg`
- `cor-tecido/{vinculoId}/gerada_*.png`
- `cor-tecido/{vinculoId}/modelo_*.*`

## Arquivos relacionados

- `frontend/src/pages/Vinculos.tsx`
- `frontend/src/hooks/useCorTecido.ts`
- `frontend/src/lib/firebase/cor-tecido.ts`
- `frontend/src/components/Cores/CoresTable.tsx`
- `frontend/src/components/ui/image-lightbox.tsx`

## Padrao de colunas na tabela

A grade desktop foi alinhada ao padrao de navegacao com as colunas:

- `SKU`
- `Nome`
- `Preview`
- `Vinculo`
- `Acoes`

Detalhes:
- A coluna `Nome` concentra o swatch da cor, edicao inline de nome e SKU da cor, e copia de `HEX`.
- A coluna `Vinculo` mostra o tecido associado (`tecidoNome`) e, quando existir, o `tecidoSku`.
- O cabecalho de grupo por tecido respeita `colSpan={5}` para combinar com o layout atual da tabela.
