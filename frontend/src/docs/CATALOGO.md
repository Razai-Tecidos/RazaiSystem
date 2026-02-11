# Modulo Catalogo

Ultima atualizacao: 2026-02-10

## Objetivo

Consolidar a selecao de tecidos e gerar:
- PDF de catalogo
- link compartilhavel do catalogo

Arquivo principal:
- `frontend/src/pages/Catalogo.tsx`

## Fluxo atual

1. A tela carrega tecidos com cores (`cor_tecido`) e tecidos com estampas.
2. A selecao e unificada em uma lista unica por tecido:
- mostra quantidade de cores
- mostra quantidade de estampas
- permite selecionar/desmarcar todos
3. O preview e atualizado com os tecidos selecionados.
4. O usuario pode:
- baixar PDF
- criar link compartilhavel

## Selecao unificada (liso + estampado)

Regra:
- um `tecidoId` selecionado habilita simultaneamente:
- cores desse tecido no catalogo
- estampas desse tecido no catalogo

Isso remove a separacao por abas e evita selecoes divergentes.

## Geracao de PDF

Componente:
- `frontend/src/components/Catalogo/CatalogoPdfDocument.tsx`

Prioridade de imagem para cores no PDF:
1. `imagemGerada` (quadrada com logo/nome da cor)
2. fallback em `imagemTingida`
3. fallback final em swatch de cor (`corHex`)

Estampas continuam usando `estampa.imagem`.

## Criacao de link e compartilhamento

Hook:
- `frontend/src/hooks/useCatalogos.ts`

Comportamento:
- `createCatalogoLink` cria o catalogo e retorna a URL.
- A tela `Catalogo.tsx` tenta abrir compartilhamento nativo via `navigator.share`.
- Se nao houver suporte (ou falhar), faz fallback para copiar URL no clipboard.

Resultado:
- No celular, ao tocar em `Criar Link`, abre a folha nativa de compartilhar quando disponivel.

## Arquivos relacionados

- `frontend/src/pages/Catalogo.tsx`
- `frontend/src/components/Catalogo/CatalogoPdfDocument.tsx`
- `frontend/src/components/Catalogo/CatalogoPreview.tsx`
- `frontend/src/hooks/useCatalogos.ts`
- `frontend/src/lib/firebase/catalogos.ts`
