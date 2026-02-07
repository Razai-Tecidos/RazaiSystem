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

### MobileBottomNav

Barra de navegação inferior para dispositivos mobile.

**Localização**: `frontend/src/components/Layout/MobileBottomNav.tsx`

**Props**:
```typescript
interface MobileBottomNavProps {
  currentPage: string;     // Página atual (para destacar item ativo)
  onNavigate: (page: PageId) => void; // Callback de navegação
}
```

**Funcionalidades**:
- 4 ícones fixos (Home, Tecidos, Cores, Shopee) + botão "Mais"
- Menu expansível com módulos adicionais (Estampas, Vínculos, Catálogo, Tamanhos, Anúncios, Capturar Cor)
- Visível apenas em mobile (`md:hidden`)
- Acessível com `role="navigation"` e `aria-current`

---

### EmptyState

Componente de estado vazio reutilizável.

**Localização**: `frontend/src/components/Layout/EmptyState.tsx`

**Props**:
```typescript
interface EmptyStateProps {
  icon: ReactNode;      // Ícone grande central
  title: string;        // Título descritivo
  description?: string; // Texto auxiliar
  action?: ReactNode;   // Botão de ação (ex: "Criar primeiro item")
  className?: string;
}
```

---

### ConfirmDialog

Dialog de confirmação que substitui `window.confirm()`.

**Localização**: `frontend/src/components/ui/confirm-dialog.tsx`

**Props**:
```typescript
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;    // Default: "Confirmar"
  cancelLabel?: string;     // Default: "Cancelar"
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
}
```

**Funcionalidades**:
- Usa AlertDialog do shadcn/ui
- Mobile-friendly com botões de 44px mínimo
- Variante destrutiva com cor vermelha

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

Tabela/Grid responsiva para listagem de estampas com suporte a agrupamento.

**Localização**: `frontend/src/components/Estampas/EstampasTable.tsx`

**Props**:
```typescript
interface EstampasTableProps {
  estampasAgrupadas: EstampaGrupo[];
  viewMode: 'table' | 'grid';
  groupBy: 'none' | 'familia' | 'tecido';
  onEdit: (estampa: Estampa) => void;
  onDelete: (estampa: Estampa) => void;
  onDuplicate: (estampa: Estampa) => void;
  onUpdateNome: (id: string, nome: string) => Promise<void>;
  onUpdateSku: (id: string, sku: string) => Promise<void>;
  loading?: boolean;
}
```

**Funcionalidades**:
- Visualização em tabela ou grid
- Agrupamento por família ou tecido (grupos colapsáveis)
- Edição inline de nome e SKU
- Botões de duplicar, editar e excluir
- Estados visuais de loading/saving/deleting

**Colunas (modo tabela)**:
- Preview (thumbnail ou placeholder)
- SKU (editável inline)
- Nome (editável inline)
- Tecido Base
- Ações (Duplicar, Editar, Excluir)

**Grid View**:
- Cards com imagem grande
- Overlay com ações no hover
- Nome e SKU abaixo da imagem

---

### DeleteConfirmModal

Modal de confirmação de exclusão de estampa.

**Localização**: `frontend/src/components/Estampas/DeleteConfirmModal.tsx`

**Props**:
```typescript
interface DeleteConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  estampa: Estampa | null;
}
```

**Funcionalidades**:
- Preview da estampa (imagem, nome, SKU)
- Informação do tecido base
- Botões "Cancelar" e "Excluir" (vermelho)
- Substitui o confirm() nativo por UX mais elegante

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

## Componentes de Vínculos

### Página Vínculos

Página principal de gerenciamento de vínculos cor-tecido.

**Localização**: `frontend/src/pages/Vinculos.tsx`

**Funcionalidades**:
- Listagem agrupada por tecido (expansível/colapsável)
- Filtros por tecido, cor e busca textual
- Ações em lote por grupo de tecido
- Exportação XLSX com imagens como mídia

**Componentes Internos**:

#### Overlay de Progresso de Exportação

Exibido durante a exportação XLSX com imagens.

```typescript
interface ExportProgress {
  isExporting: boolean;  // Se está exportando
  current: number;       // Imagens processadas
  total: number;         // Total de imagens
  currentItem: string;   // Nome do item atual
}
```

**Visual**:
- Overlay escuro cobrindo toda a tela
- Card central com ícone animado
- Barra de progresso de 0% a 100%
- Contador "X de Y imagens processadas"
- Nome do item sendo processado

**Comportamento**:
- Aparece automaticamente ao iniciar exportação
- Atualiza em tempo real durante processamento
- Some automaticamente ao concluir ou em caso de erro

#### Grupo de Tecido (Cabeçalho)

Cabeçalho expansível para cada grupo de tecido.

**Visual**:
- Fundo cinza claro (`bg-gray-100`)
- Ícone de chevron (rotaciona ao expandir/colapsar)
- Nome do tecido + SKU + contagem de cores
- Botões de ação em lote à direita

**Ações em Lote**:
- Copiar SKUs (separados por tab)
- Copiar HEX (separados por tab)
- Copiar Nomes (separados por tab)
- Download Preview (ZIP)
- Download com Marca (ZIP)

---

## Componentes Shopee

### FieldHint

Componente reutilizável que exibe label com tooltip de ajuda e descrição opcional.

**Localização**: `frontend/src/components/Shopee/FieldHint.tsx`

**Props**:
```typescript
interface FieldHintProps {
  label: string;         // Texto do label
  hint?: string;         // Texto do tooltip (ícone ?)
  description?: string;  // Texto auxiliar abaixo do campo
  required?: boolean;    // Exibe asterisco vermelho
  children?: ReactNode;  // Campo de input filho
  className?: string;
}
```

**Exemplo**:
```tsx
<FieldHint
  label="Preço Base"
  required
  hint="Preço de venda na Shopee. Mínimo R$ 1,00."
  description="Valor em Reais."
>
  <Input type="number" value={preco} onChange={...} />
</FieldHint>
```

---

### FiscalInfo

Seção de informações fiscais para anúncio Shopee.

**Localização**: `frontend/src/components/Shopee/FiscalInfo.tsx`

**Props**:
```typescript
interface FiscalInfoProps {
  ncm: string;                   // Código NCM atual
  onNcmChange: (value: string) => void; // Callback de alteração
  tecidoNome?: string;           // Para preview do nome na NF
  corExemplo?: string;           // Cor de exemplo para preview
  tamanhoExemplo?: string;       // Tamanho de exemplo para preview
}
```

**Comportamento**:
- NCM: campo editável, aceita apenas números, máx 8 caracteres
- GTIN: exibido como texto fixo "00" (sem input)
- item_name_in_invoice: preview auto-gerado a partir dos dados do produto

---

### CategoryAttributes

Busca e renderiza atributos obrigatórios da categoria selecionada.

**Localização**: `frontend/src/components/Shopee/CategoryAttributes.tsx`

**Props**:
```typescript
interface CategoryAttributesProps {
  shopId: number;
  categoryId: number;
  values: ProductAttributeValue[];
  onChange: (values: ProductAttributeValue[]) => void;
}
```

---

### BrandSelector

Dropdown pesquisável para seleção de marca Shopee.

**Localização**: `frontend/src/components/Shopee/BrandSelector.tsx`

**Props**:
```typescript
interface BrandSelectorProps {
  shopId: number;
  categoryId: number;
  value?: number;
  onChange: (id: number | undefined, nome: string) => void;
}
```

---

### ShippingConfig

Configuração de canais de logística (frete).

**Localização**: `frontend/src/components/Shopee/ShippingConfig.tsx`

**Props**:
```typescript
interface ShippingConfigProps {
  shopId: number;
  value: Array<{ logistic_id: number; enabled: boolean; shipping_fee?: number; is_free?: boolean }>;
  onChange: (value: Array<...>) => void;
}
```

---

### ExtendedDescriptionEditor

Editor de descrição estendida com blocos de texto e imagem (drag-and-drop).

**Localização**: `frontend/src/components/Shopee/ExtendedDescriptionEditor.tsx`

**Props**:
```typescript
interface ExtendedDescriptionEditorProps {
  value?: ExtendedDescription;
  onChange: (value: ExtendedDescription) => void;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}
```

---

### WholesaleConfig

Configuração de faixas de preço para atacado.

**Localização**: `frontend/src/components/Shopee/WholesaleConfig.tsx`

**Props**:
```typescript
interface WholesaleConfigProps {
  value: WholesaleTier[];
  onChange: (tiers: WholesaleTier[]) => void;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  basePrice: number;
}
```

---

### SizeChartSelector

Verifica suporte e permite seleção de tabela de medidas.

**Localização**: `frontend/src/components/Shopee/SizeChartSelector.tsx`

**Props**:
```typescript
interface SizeChartSelectorProps {
  shopId: number;
  categoryId: number;
  value?: number;
  onChange: (id: number | undefined) => void;
}
```

---

### AdPreview

Modal de simulação visual do anúncio na Shopee (carrossel, variações, informações).

**Localização**: `frontend/src/components/Shopee/AdPreview.tsx`

**Props**:
```typescript
interface AdPreviewProps {
  data: {
    nome: string;
    descricao: string;
    preco: number;
    imagensPrincipais: string[];
    cores: Array<{ nome: string; hex?: string; imagem?: string }>;
    tamanhos: string[];
    peso: number;
    dimensoes: { comprimento: number; largura: number; altura: number };
    categoria: string;
    condition: string;
    wholesale?: WholesaleTier[];
  };
  onClose?: () => void;
}
```

**Funcionalidades**:
- Carrossel de imagens com navegação
- Seletores de cor e tamanho
- Informações de preço, envio e condição
- Suporte a ESC para fechar

---

## Componentes UI (shadcn/ui)

O projeto utiliza componentes do [shadcn/ui](https://ui.shadcn.com/):

- `Button` - Botões com variantes (default, destructive, outline, ghost)
- `Checkbox` - Caixas de seleção
- `Dialog` - Modais e diálogos
- `Input` - Campos de entrada de texto
- `Label` - Rótulos para formulários
- `Textarea` - Área de texto multilinha
- `Table` - Tabelas responsivas
- `Toast` / `Toaster` - Notificações toast
- `Tooltip` - Tooltips com conteúdo rico (usado pelo FieldHint)
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
