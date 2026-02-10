# Documentação do Módulo de Estampas

> **Nota**: Para regras críticas (SKU, formatação, Firestore), consulte [CLAUDE.md](../../../CLAUDE.md) e [CONTEXT.md](../../../CONTEXT.md).

## Visão Geral

O módulo de Estampas permite o gerenciamento de estampas vinculadas a tecidos do tipo "Estampado". Cada estampa possui um SKU gerado automaticamente baseado no nome (primeira palavra = família).

## Estrutura de Dados

### Estampa

```typescript
interface Estampa {
  id: string;              // Document ID no Firestore
  nome: string;            // Nome completo (ex: "Jardim Pink")
  tecidoBaseId: string;    // ID do tecido base vinculado
  tecidoBaseNome?: string; // Nome do tecido (cache para exibição)
  imagem?: string;         // URL da imagem no Firebase Storage (opcional)
  descricao?: string;      // Descrição adicional
  sku?: string;            // SKU gerado automaticamente (ex: JA001)
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp;   // Soft delete
}
```

### Controle de SKU

```typescript
interface SkuControlEstampa {
  familias: Record<string, number>;        // Ex: { "JA": 3, "FL": 2 }
  prefixosReservados: Record<string, string>; // Ex: { "JA": "Jardim", "FL": "Floral" }
}
```

**Documento Firestore**: `sku_control/estampas`

## Sistema de SKU

### Formato

O SKU é gerado automaticamente no formato `[PREFIXO][NÚMERO]`:

- **Prefixo**: 2 letras derivadas da primeira palavra do nome (família)
- **Número**: 3 dígitos sequenciais por família

**Exemplos**:
| Nome | Família | SKU |
|------|---------|-----|
| Jardim Pink | Jardim | JA001 |
| Jardim Azul | Jardim | JA002 |
| Floral Rosa | Floral | FL001 |
| Floral Verde | Floral | FL002 |

### Regras de Geração

1. **Extração da família**: Primeira palavra do nome
2. **Prefixo base**: Duas primeiras letras em maiúsculo
3. **Conflito de prefixo**: Se outra família já usa o mesmo prefixo, usa 1ª e 3ª letras
4. **Sequência por família**: Cada família tem contador independente

### Quando o SKU é Regenerado

- **Na criação**: Sempre gera novo SKU
- **Na edição**: Apenas se a família mudar (primeira palavra do nome)
- **Edição manual**: SKU pode ser editado inline na tabela

## Hook useEstampas

**Localização**: `frontend/src/hooks/useEstampas.ts`

### Retorno

```typescript
{
  estampas: EstampaWithStatus[];  // Lista com status de operação
  loading: boolean;                // Carregamento inicial
  loadEstampas: () => Promise<void>;
  createEstampa: (data: CreateEstampaData) => Promise<void>;
  createEstampasBatch: (nomes: string[], tecidoBaseId: string) => Promise<void>;
  updateEstampa: (data: UpdateEstampaData) => Promise<void>;
  deleteEstampa: (id: string) => Promise<void>;
  verificarNomeDuplicado: (nome: string, excludeId?: string) => Promise<Estampa | null>;
}
```

### Uso Básico

```typescript
const { estampas, loading, createEstampa, createEstampasBatch } = useEstampas();

// Criar uma estampa
await createEstampa({
  nome: 'Jardim Pink',
  tecidoBaseId: 'tecido-123',
  imagem: file, // opcional
  descricao: 'Estampa floral rosa', // opcional
});

// Criar múltiplas estampas em lote
await createEstampasBatch(
  ['Jardim Pink', 'Jardim Azul', 'Jardim Verde'],
  'tecido-123'
);
```

### Funcionalidades

- **UI Otimista**: Atualiza interface antes da confirmação do servidor
- **Rollback automático**: Reverte em caso de erro
- **Cadastro em lote**: Cria múltiplas estampas de uma vez
- **SKU automático**: Gera SKU baseado na família
- **Upload de imagem**: Gerencia upload para Firebase Storage (opcional)
- **Validação de nome duplicado**: Impede criação de estampas com nomes iguais

## Página de Estampas

**Localização**: `frontend/src/pages/Estampas.tsx`

### Funcionalidades da Página

#### 1. Filtros e Busca

- **Campo de busca**: Filtra por nome, SKU ou tecido base
- **Filtro por tecido**: Dropdown para filtrar por tecido base específico
- **Limpar filtros**: Botão para resetar todos os filtros

#### 2. Ordenação

Opções de ordenação disponíveis:
- Mais recentes / Mais antigas (por data de criação)
- Nome A-Z / Z-A
- SKU A-Z / Z-A
- Tecido A-Z

#### 3. Agrupamento

- **Sem agrupamento**: Lista plana
- **Por família**: Agrupa pela primeira palavra do nome
- **Por tecido**: Agrupa pelo tecido base

Grupos são colapsáveis (clique no cabeçalho para expandir/colapsar).

#### 4. Visualizações

Toggle entre dois modos de visualização:

- **Tabela**: Visualização tradicional em linhas com todas as informações
- **Grid**: Cards com imagens maiores, ideal para visualização rápida

#### 5. Contador

Header exibe:
- Total de estampas cadastradas
- Total de famílias únicas
- Quantidade filtrada (quando filtros ativos)

#### 6. Exportação CSV

Botão "Exportar" gera arquivo CSV com:
- SKU
- Nome
- Família
- Tecido Base
- Descrição

Arquivo usa encoding UTF-8 com BOM para compatibilidade com Excel.

### Ações na Tabela

#### Edição Inline

- **Nome**: Clique no nome para editar diretamente
- **SKU**: Clique no SKU para editar diretamente
- **Enter**: Salva e vai para próximo item
- **Escape**: Cancela edição
- **Blur**: Salva automaticamente

#### Botões de Ação

- **Duplicar**: Cria cópia da estampa com sufixo "(cópia)"
- **Editar**: Abre modal de edição completa
- **Excluir**: Abre modal de confirmação

### Modal de Confirmação de Exclusão

Modal elegante que substitui o `confirm()` nativo:
- Preview da estampa (imagem, nome, SKU)
- Informação do tecido base
- Botões "Cancelar" e "Excluir"

**Localização**: `frontend/src/components/Estampas/DeleteConfirmModal.tsx`

## Componentes

### EstampaFormModal

Modal para criar/editar estampas com dois modos: Individual e Lote.

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

**Modo Individual**:
- Nome (obrigatório, mínimo 2 palavras)
- Tecido base (seleção via chips)
- Imagem (opcional)
- Descrição (opcional)

**Modo Lote**:
- Tecido base (seleção via chips)
- Textarea para múltiplos nomes (um por linha ou separados por vírgula)
- Preview em tempo real com validação
- Indicação de nomes válidos/inválidos

### TecidoChip

Chip minimalista para seleção de tecido.

```tsx
<TecidoChip
  tecido={tecido}
  selected={tecidoBaseId === tecido.id}
  onSelect={() => setTecidoBaseId(tecido.id)}
/>
```

**Estilo**:
- Selecionado: fundo rosa, texto branco
- Não selecionado: fundo cinza claro, texto cinza

### EstampasTable

Tabela/Grid responsiva para listagem de estampas.

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
- Edição inline de nome e SKU
- Visualização em tabela ou grid
- Agrupamento com grupos colapsáveis
- Botões de duplicar, editar e excluir
- Estados visuais de loading/saving/deleting

### DeleteConfirmModal

Modal de confirmação de exclusão.

**Props**:
```typescript
interface DeleteConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  estampa: Estampa | null;
}
```

## Fluxo de Cadastro em Lote

```
┌─────────────────────────────────────┐
│  [Individual]  [Lote]  ← Toggle     │
├─────────────────────────────────────┤
│  Tecido:  ○ Piquet  ● Malha         │
├─────────────────────────────────────┤
│  Nomes (um por linha):              │
│  ┌─────────────────────────────────┐│
│  │ Jardim Pink                     ││
│  │ Jardim Azul                     ││
│  │ Floral Rosa                     ││
│  └─────────────────────────────────┘│
│                                     │
│  Preview: 3 estampas válidas        │
│  • JAxxx - Jardim Pink              │
│  • JAxxx - Jardim Azul              │
│  • FLxxx - Floral Rosa              │
├─────────────────────────────────────┤
│              [Criar 3 Estampas]     │
└─────────────────────────────────────┘
```

**Validação em tempo real**:
- Nome deve ter pelo menos 2 palavras
- Nome deve ter pelo menos 3 caracteres
- Nomes duplicados são rejeitados
- Nomes inválidos são marcados em vermelho com o erro

## Validação de Nome Duplicado

O sistema impede a criação de estampas com nomes duplicados:

1. **Na criação individual**: Verifica antes de criar
2. **Na criação em lote**: Verifica todos os nomes antes de iniciar
3. **Na edição**: Verifica se o novo nome já existe (excluindo a própria estampa)

A comparação é case-insensitive (ignora maiúsculas/minúsculas).

```typescript
// Verificar manualmente
const duplicada = await verificarNomeDuplicado('Jardim Pink');
if (duplicada) {
  console.log(`Nome já existe: ${duplicada.nome}`);
}

// Na edição, excluir a própria estampa da verificação
const duplicada = await verificarNomeDuplicado('Novo Nome', estampaId);
```

## Firebase

### Coleção: `estampas`

```javascript
{
  nome: "Jardim Pink",
  tecidoBaseId: "abc123",
  tecidoBaseNome: "Viscolinho Estampado",
  imagem: "https://...",
  descricao: "Estampa floral rosa",
  sku: "JA001",
  createdAt: Timestamp,
  updatedAt: Timestamp,
  deletedAt: null
}
```

### Storage: `estampas/{estampaId}/`

Imagens de estampas são armazenadas com timestamp no nome para evitar conflitos.

### Regras de Segurança

**Firestore** (`firestore.rules`):
```javascript
match /estampas/{estampaId} {
  allow read, write: if request.auth != null;
}
```

**Storage** (`storage.rules`):
```javascript
match /estampas/{estampaId}/{allPaths=**} {
  allow read, write: if request.auth != null;
}
```

## Integração com Tecidos

Estampas são vinculadas a tecidos do tipo "Estampado":

1. **Pré-requisito**: Cadastrar tecido com `tipo: 'estampado'`
2. **Vinculação**: Selecionar tecido base ao criar estampa
3. **Filtragem**: Modal mostra apenas tecidos do tipo estampado

Se não houver tecidos estampados cadastrados, o botão "Adicionar Estampa" fica desabilitado com mensagem explicativa.

## Integração com Catálogo

Estampas podem ser incluídas no catálogo PDF:

1. Na página de Catálogo, selecione a aba "Estampas"
2. Selecione os tecidos com estampas desejados
3. Gere o PDF com cores e/ou estampas

O PDF inclui seções separadas para "CORES" e "ESTAMPAS" quando ambos são selecionados.

## Boas Práticas

1. **Nomenclatura**: Use padrão "Família Variação" (ex: "Jardim Pink", "Floral Azul")
2. **Imagens**: Opcional, mas recomendado para visualização
3. **Cadastro em lote**: Ideal para cadastrar variações da mesma família
4. **Tecido base**: Sempre vincule a um tecido estampado existente
5. **Nomes únicos**: Evite nomes duplicados para facilitar identificação
6. **Agrupamento**: Use agrupamento por família para organizar visualmente

## Padrao visual de listagem

Para manter consistencia com os modulos de Cores e Vinculos, a tabela desktop de Estampas usa as colunas:

- `SKU`
- `Nome`
- `Preview`
- `Vinculo`
- `Acoes`

Observacoes:
- O campo `Vinculo` representa o tecido base (`tecidoBaseNome`).
- Em cards (mobile/grid), o mesmo dado aparece com o rotulo `Vinculo`.
