# Modulo Catalogo

Ultima atualizacao: 2026-02-11

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

Layout atual:
- 3 imagens por linha (cores e estampas) no PDF.
- 3 linhas por pagina (9 cards por pagina por secao).

Otimizacao antes de montar o PDF:
- o modulo aplica compressao leve por redimensionamento (canvas) em memoria antes de chamar `pdf(...).toBlob()`;
- objetivo: reduzir tamanho final do arquivo mantendo boa nitidez visual;
- fallback automatico para URL original quando alguma imagem nao puder ser processada.

Arquivo:
- `frontend/src/pages/Catalogo.tsx` (`buildCatalogCompressedImageMap`)

Nome de arquivo ao baixar:
- 1 tecido: `Catálogo_Razai_[Tecido]_[data].pdf`
- multiplos tecidos: `Catalogo_Razai_Multi_[data].pdf`

## Criacao de link e compartilhamento

Hook:
- `frontend/src/hooks/useCatalogos.ts`

Comportamento:
- `createCatalogoLink` cria o catalogo e retorna a URL.
- A tela `Catalogo.tsx` tenta abrir compartilhamento nativo via `navigator.share`.
- Se nao houver suporte (ou falhar), faz fallback para copiar URL no clipboard.

Resultado:
- No celular, ao tocar em `Criar Link`, abre a folha nativa de compartilhar quando disponivel.

## Historico de catalogos

O modulo exibe historico dos catalogos criados para reutilizacao de link e PDF.

Dados mostrados no historico:
- tecidos incluidos,
- quantidade de cores e estampas,
- data de criacao,
- status de expiracao do link.

Acoes por item:
- `Usar`: reaplica selecao de tecidos,
- `PDF`: baixa PDF com a mesma selecao,
- `Copiar link`: copia URL publica quando o link estiver ativo.

## Arquivos relacionados

- `frontend/src/pages/Catalogo.tsx`
- `frontend/src/components/Catalogo/CatalogoPdfDocument.tsx`
- `frontend/src/components/Catalogo/CatalogoPreview.tsx`
- `frontend/src/hooks/useCatalogos.ts`
- `frontend/src/lib/firebase/catalogos.ts`

## Atualizacao 2026-02-11 (detalhes de tecido no PDF)

O header de cada tecido no PDF de catalogo passou a exibir, quando houver dados:
- largura,
- composicao,
- rendimento (m/kg),
- gramatura (g/m2),
- peso linear (g/m).

Os valores de gramatura e peso linear sao calculados a partir dos campos do tecido (`rendimentoPorKg`, `gramaturaValor`, `gramaturaUnidade`, `largura`).

Regra de exibicao de gramatura no PDF:
- `g/m2` e `g/m` sao exibidos com arredondamento para a dezena mais proxima.
- Exemplo: `132 -> 130`, `116 -> 120`.
