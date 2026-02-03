# Documentação do Módulo de Estampas

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

Tabela responsiva para listagem de estampas.

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
- Preview (imagem thumbnail ou placeholder)
- SKU
- Nome
- Tecido Base
- Ações (Editar, Excluir)

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
- Nomes inválidos são marcados em vermelho com o erro

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

## Boas Práticas

1. **Nomenclatura**: Use padrão "Família Variação" (ex: "Jardim Pink", "Floral Azul")
2. **Imagens**: Opcional, mas recomendado para visualização
3. **Cadastro em lote**: Ideal para cadastrar variações da mesma família
4. **Tecido base**: Sempre vincule a um tecido estampado existente
