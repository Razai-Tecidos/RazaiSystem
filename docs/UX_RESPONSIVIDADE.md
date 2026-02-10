# UX e Responsividade

Ultima atualizacao: 2026-02-10

## Objetivo

Eliminar friccao de navegacao no desktop e manter consistencia mobile sem regressao.

## Melhorias implementadas

### Desktop

1. Sidebar persistente (`DesktopSidebar`):
- visivel em `md+`
- fixa na lateral
- colapsavel
- estado salvo em `localStorage`

2. Troca de modulo em 1 clique:
- sem precisar voltar para Home
- destaque claro do modulo ativo

3. URL hash sincronizada:
- modulo ativo em `#/modulo`
- refresh preserva contexto
- back/forward alternam modulos corretamente

4. Atalhos de teclado:
- `Alt+H` -> Home
- `Alt+1..7` -> modulos principais

5. Recentes na sidebar:
- ultimos 5 modulos
- exclui Home

6. Reorganizacao de modulos Shopee:
- `Tamanhos` e `Criar Anuncio` sairam da navegacao principal
- acesso agora via cards internos do modulo `Shopee`
- `Pedidos` removido do menu Shopee
- hashes legados continuam funcionando (`#/tamanhos`, `#/anuncios-shopee`)

### Mobile

- `MobileBottomNav` mantida como navegacao principal.
- Sem quebra de comportamento da base mobile existente.

### Tabelas e imagem

1. Vinculos:
- clique na miniatura abre imagem ampliada em modal (`ImageLightbox`)
- preview usa `object-contain` para nao gerar scroll interno por tamanho da imagem

2. Gestao de Imagens:
- tabelas operacionais separadas por tecido
- botao de regeneracao em lote por tecido
- preview e selecao para mosaicos

## Acessibilidade

- `role="navigation"` no menu de navegacao
- `aria-current="page"` no item ativo
- labels de acao mantidas nos botoes de icone

## Regras de navegacao documentadas

Precedencia de abertura inicial:
1. catalogo publico (`?catalogo=...`)
2. callback Shopee (`code` + `shop_id`) ou `/shopee`
3. hash valido
4. fallback `home`

## Checklist de validacao manual

1. Em desktop, trocar entre modulos sem passar pela Home.
2. Recarregar com hash e manter modulo.
3. Usar back/forward e validar troca de modulo.
4. Abrir sem hash e cair em Home.
5. Confirmar mobile bottom nav funcionando.
6. Recolher sidebar, recarregar e manter estado.
7. Em Vinculos, abrir imagem ampliada sem scroll interno de imagem.
8. Em Gestao de Imagens, validar regeneracao por tecido e ausencia de regeneracao individual.
9. Acessar `#/tamanhos` e `#/anuncios-shopee` e confirmar highlight em `Shopee`.
