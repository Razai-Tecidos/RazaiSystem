# Documentação de Componentes

## Componentes de Layout

### Header

Componente de cabeçalho compartilhado usado em todas as páginas autenticadas.

**Localização**: `frontend/src/components/Layout/Header.tsx`

**Props**:
```typescript
interface HeaderProps {
  onNavigateHome?: () => void; // Callback para navegar para Home
}
```

**Funcionalidades**:
- Exibe logo "RazaiSystem" (clicável quando `onNavigateHome` é fornecido)
- Mostra informações do usuário (email)
- Botão de logout
- Layout responsivo e alinhado

**Exemplo de uso**:
```typescript
<Header onNavigateHome={() => setCurrentPage('home')} />
```

---

### BreadcrumbNav

Componente de navegação breadcrumb posicionado abaixo do header, na área cinza do fundo.

**Localização**: `frontend/src/components/Layout/BreadcrumbNav.tsx`

**Props**:
```typescript
interface BreadcrumbNavProps {
  items: Array<{
    label: string;        // Texto do item
    href?: string;       // URL (opcional)
    onClick?: () => void; // Callback de clique (opcional)
  }>;
}
```

**Funcionalidades**:
- Renderiza breadcrumb apenas se houver items
- Itens clicáveis quando `onClick` ou `href` são fornecidos
- Separadores automáticos entre itens
- Posicionado na área cinza, fora do header branco

**Exemplo de uso**:
```typescript
<BreadcrumbNav
  items={[
    { label: 'Home', onClick: () => navigateHome() },
    { label: 'Tecidos' }
  ]}
/>
```

---

## Componentes de Tecidos

### TecidosTable

Tabela responsiva para exibir lista de tecidos cadastrados.

**Localização**: `frontend/src/components/Tecidos/TecidosTable.tsx`

**Props**:
```typescript
interface TecidosTableProps {
  tecidos: Tecido[];
  onEdit: (tecido: Tecido) => void;
  onDelete: (id: string) => void;
  loading?: boolean;
}
```

**Funcionalidades**:
- Exibe SKU, Nome, Largura (formatada com 2 decimais + "m"), Composição
- Estados visuais para operações em andamento (saving, deleting)
- Botões de ação: Editar e Excluir
- Compatibilidade com dados antigos (converte array de composição para string)
- Mensagem quando não há tecidos cadastrados

**Formatação**:
- Largura: `1,60m` (sempre 2 decimais, vírgula, unidade "m")
- Composição: exibida como string (conversão automática de arrays antigos)

---

### TecidoFormModal

Modal de formulário para criar ou editar tecidos.

**Localização**: `frontend/src/components/Tecidos/TecidoFormModal.tsx`

**Props**:
```typescript
interface TecidoFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateTecidoData) => Promise<void>;
  tecido?: Tecido | null; // Se fornecido, modo edição
  loading?: boolean;
}
```

**Campos do Formulário**:
- **Nome** (obrigatório): Input de texto, mínimo 3 caracteres
- **Largura** (obrigatório): Input de texto, aceita vírgula ou ponto, converte automaticamente
  - Placeholder: "Ex: 1,50"
  - Validação: número positivo
- **Composição** (obrigatório): Input de texto livre
  - Placeholder: "Ex: Algodão 60%, Poliester 40%"
  - Validação: apenas verifica se está preenchido
- **Imagem Padrão** (obrigatório): Upload de arquivo
  - Formatos aceitos: JPG, PNG, WEBP
  - Tamanho máximo: 5MB
  - Preview antes de salvar
- **Descrição** (opcional): Textarea

**Validações**:
- Campos obrigatórios marcados com `*`
- Mensagens de erro específicas por campo
- Validação de tipo e tamanho de imagem
- Conversão automática de formato brasileiro (vírgula) para formato numérico

**Compatibilidade**:
- Ao editar, converte arrays antigos de composição para string automaticamente
- Converte ponto para vírgula ao exibir largura

---

## Componentes de Estampas

### EstampaFormModal

Modal para criar/editar estampas com modos Individual e Lote.

**Localização**: `frontend/src/components/Estampas/EstampaFormModal.tsx`

**Props**:
```typescript
interface EstampaFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateEstampaData) => Promise<void>;
  onSubmitBatch?: (nomes: string[], tecidoBaseId: string) => Promise<void>;
  estampa?: Estampa | null;
  tecidos: Tecido[];
  loading?: boolean;
}
```

**Funcionalidades**:
- Toggle entre modo Individual e Lote (apenas criação)
- Seleção de tecido via chips minimalistas
- Modo Individual: nome, imagem (opcional), descrição
- Modo Lote: textarea para múltiplos nomes + preview
- Validação em tempo real
- Preview do SKU estimado por família

**Modo Individual**:
- Nome obrigatório (mínimo 2 palavras)
- Imagem opcional (upload direto)
- Descrição opcional

**Modo Lote**:
- Nomes separados por linha ou vírgula
- Preview mostra nomes válidos/inválidos
- Botão dinâmico "Criar X Estampas"

---

### TecidoChip

Chip minimalista para seleção de tecido.

**Localização**: `frontend/src/components/Estampas/EstampaFormModal.tsx` (componente interno)

**Props**:
```typescript
interface TecidoChipProps {
  tecido: Tecido;
  selected: boolean;
  onSelect: () => void;
}
```

**Estilo**:
- Selecionado: `bg-pink-500 text-white`
- Não selecionado: `bg-gray-100 text-gray-600`
- Animação de escala no hover/click

**Exemplo**:
```tsx
<TecidoChip
  tecido={tecido}
  selected={tecidoBaseId === tecido.id}
  onSelect={() => setTecidoBaseId(tecido.id)}
/>
```

---

### EstampasTable

Tabela responsiva para listagem de estampas.

**Localização**: `frontend/src/components/Estampas/EstampasTable.tsx`

**Props**:
```typescript
interface EstampasTableProps {
  estampas: Estampa[];
  onEdit: (estampa: Estampa) => void;
  onDelete: (id: string) => void;
  loading?: boolean;
}
```

**Colunas**:
- Preview (thumbnail ou placeholder)
- SKU
- Nome
- Tecido Base
- Ações (Editar, Excluir)

**Estados visuais**:
- `_status: 'saving'`: Opacidade reduzida
- `_status: 'deleting'`: Opacidade reduzida + indicador

---

## Componentes de Cores

### ColorSwatch

Componente visual para exibir cor capturada em formato grande.

**Localização**: `frontend/src/components/Cores/ColorSwatch.tsx`

**Props**:
```typescript
interface ColorSwatchProps {
  color: {
    lab: LabColor;
    hex: string;
  } | null;
  className?: string;
}

interface LabColor {
  L: number;  // 0-100
  a: number;  // -128 a 127
  b: number;  // -128 a 127
}
```

**Funcionalidades**:
- Exibe área grande colorida (256px de altura)
- Mostra código hexadecimal centralizado sobre a cor
- Contraste automático do texto (claro/escuro baseado no L)
- Exibe valores LAB e Hex em seção informativa
- Estado vazio quando nenhuma cor está capturada

**Exemplo de uso**:
```typescript
<ColorSwatch 
  color={{
    lab: { L: 50, a: 20, b: 30 },
    hex: '#B27350'
  }} 
/>

// Estado vazio
<ColorSwatch color={null} />
```

---

### CapturaCorForm

Formulário de revisão após captura de cor do colorímetro.

**Localização**: `frontend/src/components/Cores/CapturaCorForm.tsx`

**Props**:
```typescript
interface CapturaCorFormProps {
  color: {
    lab: LabColor;
    hex: string;
  } | null;
  onSubmit: (nome: string) => Promise<void>;
  onDiscard: () => void;
  onNewCapture: () => void;
  loading?: boolean;
}
```

**Campos do Formulário**:
- **Nome** (obrigatório): Input de texto, mínimo 2 caracteres
- **Valores LAB** (readonly): Exibe L, a, b em campos separados
- **Código Hexadecimal** (readonly): Exibe hex com preview da cor

**Botões**:
- **Descartar**: Limpa a cor capturada
- **Nova Captura**: Limpa e inicia nova captura
- **Salvar Cor**: Salva a cor no sistema

**Validações**:
- Nome é obrigatório (mínimo 2 caracteres)
- Mensagens de erro específicas
- Limpa formulário após salvar com sucesso

**Exemplo de uso**:
```typescript
<CapturaCorForm
  color={capturedColor}
  onSubmit={async (nome) => {
    await createCor({ nome, codigoHex: capturedColor.hex });
  }}
  onDiscard={() => clearCapture()}
  onNewCapture={async () => {
    clearCapture();
    await capture();
  }}
/>
```

---

### CoresTable

Tabela responsiva para exibir lista de cores cadastradas.

**Localização**: `frontend/src/components/Cores/CoresTable.tsx`

**Props**:
```typescript
interface CoresTableProps {
  cores: Cor[];
  onEdit: (cor: Cor) => void;
  onDelete: (id: string) => void;
  loading?: boolean;
}
```

**Funcionalidades**:
- Exibe SKU, Nome e Código Hex
- Preview visual da cor em cada linha
- Estados visuais para operações em andamento
- Botões de ação: Editar e Excluir
- Mensagem quando não há cores cadastradas

---

### CorFormModal

Modal de formulário para criar ou editar cores manualmente.

**Localização**: `frontend/src/components/Cores/CorFormModal.tsx`

**Props**:
```typescript
interface CorFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateCorData) => Promise<void>;
  cor?: Cor | null;
  loading?: boolean;
}
```

**Campos do Formulário**:
- **Nome** (obrigatório): Nome descritivo da cor
- **Código Hexadecimal** (opcional): Formato #RRGGBB

---

## Componentes de Captura de Cor

### CapturaLista

Componente principal para exibir lista de capturas de cores.

**Localização**: `frontend/src/components/CapturaLista/CapturaLista.tsx`

**Props**:
```typescript
interface CapturaListaProps {
  capturas: CapturaItem[];
  onEditar: (captura: CapturaItem) => void;
  onExcluir: (id: string) => void;
  onLimparLista: () => void;
  temConflitos: boolean;
  className?: string;
}
```

**Funcionalidades**:
- Exibe lista de todas as capturas
- Mostra contador de itens
- Alerta visual quando há conflitos
- Botão para limpar toda a lista
- Mensagem quando lista está vazia

---

### CapturaItemComponente

Componente para exibir um item individual da lista de capturas.

**Localização**: `frontend/src/components/CapturaLista/CapturaItemComponente.tsx`

**Props**:
```typescript
interface CapturaItemComponenteProps {
  captura: CapturaItem;
  onEditar: (captura: CapturaItem) => void;
  onExcluir: (id: string) => void;
}
```

**Funcionalidades**:
- Swatch miniatura da cor (32x32px)
- Nome da cor e tecido associado
- Valores LAB e código hex
- Badge de conflito quando deltaE < limiar
- Informações detalhadas do conflito (nome e hex da cor próxima)
- Botões de edição e exclusão

**Estados Visuais**:
- Normal: fundo branco
- Conflito: fundo amarelo claro com borda amarela

---

### DeltaEBadge

Badge visual para exibir status de conflito baseado em deltaE.

**Localização**: `frontend/src/components/CapturaLista/DeltaEBadge.tsx`

**Props**:
```typescript
interface DeltaEBadgeProps {
  deltaE: number;
  className?: string;
}
```

**Funcionalidades**:
- Exibe apenas se deltaE < `DELTA_E_LIMIAR_CONFLITO`
- Mostra valor de deltaE formatado (2 decimais)
- Ícone de alerta
- Estilo amarelo para indicar atenção

---

### TecidoSelecaoModal

Modal simplificado para seleção de tecido (otimizado para mobile).

**Localização**: `frontend/src/components/TecidoSelecaoModal.tsx`

**Props**:
```typescript
interface TecidoSelecaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelecionar: (tecido: Tecido) => void;
  tecidos: Tecido[];
  loading?: boolean;
}
```

**Funcionalidades**:
- Lista de tecidos sem campo de busca (evita teclado no mobile)
- Preview da imagem padrão de cada tecido
- Seleção direta com toque (fecha modal automaticamente)
- Informações: nome e SKU
- Botão cancelar no footer

**Design Mobile-First**:
- Largura: 95vw (max 400px)
- Altura máxima: 70vh
- Itens compactos com padding reduzido
- Scroll otimizado com `overscroll-contain`
- Toque seleciona e confirma em uma ação

---

### CapturaListaSimples

Lista simplificada de capturas (usada na tela de Captura).

**Localização**: `frontend/src/components/CapturaLista/CapturaListaSimples.tsx`

**Props**:
```typescript
interface CapturaListaSimplesProps {
  capturas: CapturaItem[];
  onExcluir: (id: string) => void;
  onLimparLista: () => void;
  onEnviarCores: () => Promise<void>;
  temConflitos: boolean;
  enviando?: boolean;
  className?: string;
}
```

**Funcionalidades**:
- Lista compacta de capturas (sem edição)
- Swatch miniatura, nome, tecido e hex
- Badge de conflito quando aplicável
- Botão X para remover cada item
- Botões "Limpar" e "Enviar para Gerenciar Cores"
- Dica no footer direcionando para edição

**Nota**: Substitui o `CapturaLista` + `CapturaEdicaoModal` na tela de captura. A edição com preview Reinhart agora é feita na tela de Gerenciar Cores.

---

### CorFormModal (Atualizado)

Modal de edição de cor com preview opcional de tingimento.

**Localização**: `frontend/src/components/Cores/CorFormModal.tsx`

**Props**:
```typescript
interface CorFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateCorData) => Promise<void>;
  cor?: Cor | null;
  loading?: boolean;
}
```

**Funcionalidades**:
- Formulário: Nome e Código Hexadecimal
- Informações da captura (LAB, tecido associado)
- **Preview do tecido tingido** (apenas se cor tem tecido associado):
  - Botão "Ver Preview no Tecido"
  - Carregamento sob demanda
  - Algoritmo de Reinhart aplicado
  - Sliders de ajuste (Matiz, Saturação, Brilho, Contraste)
  - Botão resetar ajustes

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│ Editar Cor                                              │
├────────────────────────────┬────────────────────────────┤
│ Formulário                 │ Preview (se tem tecido)    │
│                            │                            │
│ Nome: [___________]        │ [Ver Preview no Tecido]    │
│                            │                            │
│ Hex: [#RRGGBB] [■]        │ ┌──────────────────────┐   │
│                            │ │ Imagem do tecido     │   │
│ Informações da Captura:    │ │ tingido com Reinhart │   │
│ LAB: L=50 a=20 b=30        │ └──────────────────────┘   │
│ Tecido: Algodão T001       │                            │
│                            │ Ajustes de Cor [Resetar]   │
│                            │ Matiz ──────●──────        │
│                            │ Saturação ──────●──────    │
│                            │ Brilho ──────●──────       │
│                            │ Contraste ──────●──────    │
├────────────────────────────┴────────────────────────────┤
│                    [Cancelar] [Salvar]                  │
└─────────────────────────────────────────────────────────┘
```

**Responsividade**:
- Em mobile: layout de 1 coluna, preview abaixo do formulário
- Em desktop: layout de 2 colunas lado a lado

---

## Componentes UI (shadcn/ui)

O projeto utiliza componentes do [shadcn/ui](https://ui.shadcn.com/):

- `Button` - Botões com variantes (default, destructive, outline, ghost)
- `Dialog` - Modais e diálogos
- `Input` - Campos de entrada de texto
- `Label` - Rótulos para formulários
- `Textarea` - Área de texto multilinha
- `Table` - Tabelas responsivas
- `Toast` / `Toaster` - Notificações toast
- `Breadcrumb` - Navegação breadcrumb
- `Slider` - Controle deslizante (customizado para ajustes de cor)

Todos os componentes seguem o padrão do shadcn/ui e podem ser customizados através do Tailwind CSS.

---

## Componente Customizado: Slider

Componente de slider customizado para ajustes de cor.

**Localização**: `frontend/src/components/ui/slider.tsx`

**Props**:
```typescript
interface SliderProps {
  label?: string;
  value: number;
  onValueChange: (value: number) => void;
  min?: number;      // Padrão: -100
  max?: number;      // Padrão: 100
  step?: number;     // Padrão: 1
  className?: string;
}
```

**Funcionalidades**:
- Exibe label e valor atual
- Mostra valores mínimo e máximo abaixo do slider
- Estilização consistente com o design system
