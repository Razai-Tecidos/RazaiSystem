# DocumentaÃ§Ã£o: MÃ³dulo de Tecidos

> **Nota**: Para regras crÃ­ticas do projeto (Firestore, formataÃ§Ã£o brasileira, etc.), consulte [CLAUDE.md](../../../CLAUDE.md) e [CONTEXT.md](../../../CONTEXT.md).

## VisÃ£o Geral

O mÃ³dulo de Tecidos implementa um sistema completo de gerenciamento de tecidos com UI otimista, permitindo operaÃ§Ãµes CRUD (Create, Read, Update, Delete) com feedback rÃ¡pido para o usuÃ¡rio enquanto as operaÃ§Ãµes sÃ£o processadas em segundo plano no Firebase.

## Estrutura de Dados

### Firestore Collection: `tecidos`

```typescript
interface Tecido {
  id: string;                    // Document ID do Firestore
  nome: string;                   // Nome do tecido (obrigatÃ³rio)
  largura: number;                // Largura em metros (obrigatÃ³rio)
  composicao: string;             // Campo de texto livre (obrigatÃ³rio)
  imagemPadrao: string;           // URL do Firebase Storage (obrigatÃ³rio)
  descricao?: string;             // DescriÃ§Ã£o opcional
  sku: string;                    // SKU Ãºnico (T001, T002, etc)
  createdAt: Timestamp;           // Data de criaÃ§Ã£o
  updatedAt: Timestamp;           // Data de atualizaÃ§Ã£o
  deletedAt?: Timestamp;          // Data de exclusÃ£o (soft delete)
}

```

**Nota sobre Formato de Entrada:**
No formulÃ¡rio, o campo de composiÃ§Ã£o Ã© um campo de texto livre simples (Textarea). O usuÃ¡rio pode digitar qualquer texto descrevendo a composiÃ§Ã£o, por exemplo: "AlgodÃ£o 60%, Poliester 40%" ou "100% AlgodÃ£o". NÃ£o hÃ¡ validaÃ§Ã£o de formato ou porcentagem.

### Firestore Collection: `sku_control`

Documento Ãºnico para controlar geraÃ§Ã£o de SKUs:

```typescript
interface SkuControl {
  lastSkuNumber: number;          // Ãšltimo nÃºmero usado (ex: 3 para T003)
  invalidatedSkus: string[];      // Array de SKUs excluÃ­dos ["T002"]
}
```

## Arquitetura

### Componentes

#### `Tecidos.tsx` (PÃ¡gina Principal)
- Gerencia estado do modal e tecido em ediÃ§Ã£o
- Integra tabela e modal de formulÃ¡rio
- Coordena operaÃ§Ãµes CRUD

#### `TecidosTable.tsx`
- Exibe lista de tecidos em formato de tabela
- Mostra estados de loading (saving, deleting)
- BotÃµes de aÃ§Ã£o: Editar e Excluir

#### `TecidoFormModal.tsx`
- Modal de formulÃ¡rio para criar/editar tecidos
- ValidaÃ§Ã£o de campos obrigatÃ³rios
- Upload de imagem com preview
- Campo de composiÃ§Ã£o: Textarea simples de texto livre

### Hooks

#### `useTecidos.ts`
Hook principal para operaÃ§Ãµes CRUD com UI otimista:

```typescript
const {
  tecidos,        // Array de tecidos
  loading,        // Estado de carregamento
  error,          // Erro se houver
  createTecido,   // FunÃ§Ã£o para criar tecido
  updateTecido,   // FunÃ§Ã£o para atualizar tecido
  deleteTecido,   // FunÃ§Ã£o para excluir tecido
  loadTecidos,    // FunÃ§Ã£o para recarregar lista
} = useTecidos();
```

#### `useSku.ts`
Hook para gerenciar SKUs:

```typescript
const {
  generateNextSku,  // Gera prÃ³ximo SKU disponÃ­vel
  invalidateSku,    // Invalida um SKU
  loading,
  error,
} = useSku();
```

### UtilitÃ¡rios Firebase

#### `lib/firebase/tecidos.ts`
FunÃ§Ãµes utilitÃ¡rias para operaÃ§Ãµes no Firestore e Storage:

- `getTecidos()` - Busca todos os tecidos
- `getTecidoById(id)` - Busca tecido especÃ­fico
- `createTecido(data, sku, imageUrl)` - Cria novo tecido
- `updateTecido(id, data, imageUrl?)` - Atualiza tecido
- `deleteTecido(id, imageUrl)` - Exclui tecido (soft delete)
- `uploadTecidoImage(file, tecidoId)` - Upload de imagem
- `deleteTecidoImage(imageUrl)` - Remove imagem do Storage
- `getSkuControl()` - Busca controle de SKU
- `updateSkuControl(lastSkuNumber, invalidatedSkus)` - Atualiza controle
- `addInvalidatedSku(sku)` - Adiciona SKU invÃ¡lido

## PadrÃ£o de UI Otimista

### Conceito

UI Otimista Ã© um padrÃ£o onde a interface Ã© atualizada imediatamente antes da confirmaÃ§Ã£o do servidor, proporcionando feedback rÃ¡pido ao usuÃ¡rio. Se a operaÃ§Ã£o falhar, a UI Ã© revertida.

### Fluxo de CriaÃ§Ã£o

1. **UsuÃ¡rio preenche formulÃ¡rio e clica em "Salvar"**
2. **Imediatamente (UI Otimista):**
   - Modal fecha
   - Toast: "Tecido sendo cadastrado..."
   - Tecido temporÃ¡rio adicionado Ã  tabela com `_status: 'saving'`
   - SKU temporÃ¡rio: "..."
3. **Em segundo plano:**
   - Gera SKU (busca prÃ³ximo disponÃ­vel)
   - Faz upload da imagem para Storage
   - Salva no Firestore
   - Atualiza controle de SKU
4. **ApÃ³s sucesso:**
   - Atualiza tecido na tabela com dados reais
   - Toast: "Tecido cadastrado com sucesso!"
   - Remove estado `saving`
5. **Em caso de erro:**
   - Remove tecido temporÃ¡rio da tabela
   - Toast de erro
   - Modal pode ser reaberto com dados preenchidos

### Fluxo de ExclusÃ£o

1. **UsuÃ¡rio clica em excluir**
2. **Imediatamente:**
   - Remove da tabela
   - Toast: "Tecido sendo excluÃ­do..."
   - SKU marcado como invÃ¡lido localmente
3. **Em segundo plano:**
   - Deleta do Firestore (soft delete)
   - Atualiza controle de SKU (adiciona ao array de invÃ¡lidos)
4. **ApÃ³s sucesso:**
   - Toast: "Tecido excluÃ­do com sucesso!"
5. **Em caso de erro:**
   - Restaura tecido na tabela
   - Toast de erro

### Fluxo de AtualizaÃ§Ã£o

1. **UsuÃ¡rio edita e salva**
2. **Imediatamente:**
   - Atualiza tecido na tabela com novos dados
   - Marca como `_status: 'saving'`
   - Toast: "Tecido sendo atualizado..."
3. **Em segundo plano:**
   - Upload de nova imagem (se fornecida)
   - Atualiza no Firestore
4. **ApÃ³s sucesso:**
   - Recarrega lista para garantir dados atualizados
   - Toast: "Tecido atualizado com sucesso!"
5. **Em caso de erro:**
   - Restaura estado original do tecido
   - Toast de erro

## Sistema de SKU

### Formato
- PadrÃ£o: `T` + nÃºmero com 3 dÃ­gitos
- Exemplos: `T001`, `T002`, `T003`, ..., `T999`

### GeraÃ§Ã£o

1. Busca documento `sku_control` no Firestore
2. Se nÃ£o existe, cria com `lastSkuNumber: 0` e `invalidatedSkus: []`
3. Incrementa `lastSkuNumber`
4. Gera SKU: `T${nextNumber.toString().padStart(3, '0')}`
5. Atualiza controle no Firebase

### InvalidaÃ§Ã£o

1. Ao excluir tecido, SKU Ã© adicionado ao array `invalidatedSkus`
2. SKUs invÃ¡lidos nÃ£o sÃ£o reutilizados automaticamente
3. MantÃ©m histÃ³rico para auditoria

## ValidaÃ§Ãµes

### Frontend

- **Nome**: obrigatÃ³rio, mÃ­nimo 3 caracteres
- **Largura**: obrigatÃ³rio, nÃºmero positivo
- **ComposiÃ§Ã£o**: 
  - ObrigatÃ³rio, campo de texto livre
  - Apenas valida se estÃ¡ preenchido
  - NÃ£o hÃ¡ validaÃ§Ã£o de formato ou porcentagem
  - Exemplo: "AlgodÃ£o 60%, Poliester 40%"
- **Imagem**: 
  - ObrigatÃ³ria
  - Formatos aceitos: JPG, PNG, WEBP
  - Tamanho mÃ¡ximo: 5MB
- **DescriÃ§Ã£o**: opcional

### Backend (Rotas Opcionais)

- ValidaÃ§Ã£o de campos obrigatÃ³rios
- ValidaÃ§Ã£o de formato de SKU
- ValidaÃ§Ã£o de composiÃ§Ã£o: apenas verificar se estÃ¡ preenchido
- ValidaÃ§Ã£o de permissÃµes de usuÃ¡rio autenticado

## Formato de ComposiÃ§Ã£o

O campo de composiÃ§Ã£o Ã© um campo de texto livre simples (Textarea):

- **Tipo**: Textarea de texto livre
- **ValidaÃ§Ã£o**: Apenas verifica se estÃ¡ preenchido
- **Sem parsing**: NÃ£o hÃ¡ processamento automÃ¡tico do texto
- **Exemplos**:
  - "AlgodÃ£o 60%, Poliester 40%"
  - "100% AlgodÃ£o"
  - "AlgodÃ£o, Poliester e Viscose"
  - Qualquer texto descritivo da composiÃ§Ã£o

### Interface Simplificada

- Campo Ãºnico Textarea (sem mÃºltiplos campos)
- Sem botÃ£o "Adicionar" ou "Remover"
- Sem agrupamento visual ou cards
- Interface mais simples e direta

## Upload de Imagem

### Processo

1. UsuÃ¡rio seleciona arquivo
2. ValidaÃ§Ã£o de tipo e tamanho
3. Preview da imagem exibido
4. Ao salvar, upload para Firebase Storage
5. Caminho: `tecidos/{tecidoId}/{timestamp}-{filename}`
6. URL retornada e salva no Firestore

### ValidaÃ§Ãµes

- Tipos aceitos: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`
- Tamanho mÃ¡ximo: 5MB
- Preview antes de salvar

## Como Usar

### Criar Tecido

```typescript
import { useTecidos } from '@/hooks/useTecidos';

const { createTecido } = useTecidos();

await createTecido({
  nome: 'Tecido de Algodao',
  largura: 1.50,
  composicao: 'Algodao 60%, Poliester 40%',
  imagemPadrao: file, // File object
  descricao: 'Tecido macio e confortÃ¡vel',
});
```

### Atualizar Tecido

```typescript
const { updateTecido } = useTecidos();

await updateTecido({
  id: 'tecido-id',
  nome: 'Novo Nome',
  largura: 1.60,
  composicao: '100% Algodao',
  // ... outros campos
});
```

### Excluir Tecido

```typescript
const { deleteTecido } = useTecidos();

await deleteTecido('tecido-id');
```

### Gerar SKU

```typescript
import { useSku } from '@/hooks/useSku';

const { generateNextSku } = useSku();
const sku = await generateNextSku(); // Retorna "T001", "T002", etc.
```

## Estrutura de Arquivos

```
frontend/src/
â”œâ”€â”€ components/
â”‚   â””â”€â”€ Tecidos/
â”‚       â”œâ”€â”€ TecidoFormModal.tsx       # Modal de formulÃ¡rio
â”‚       â””â”€â”€ TecidosTable.tsx          # Tabela de tecidos
â”œâ”€â”€ hooks/
â”‚   â”œâ”€â”€ useSku.ts                    # Hook de SKU
â”‚   â””â”€â”€ useTecidos.ts                # Hook principal CRUD
â”œâ”€â”€ lib/
â”‚   â””â”€â”€ firebase/
â”‚       â””â”€â”€ tecidos.ts               # FunÃ§Ãµes Firebase
â”œâ”€â”€ pages/
â”‚   â””â”€â”€ Tecidos.tsx                  # PÃ¡gina principal
â”œâ”€â”€ types/
â”‚   â””â”€â”€ tecido.types.ts              # Tipos TypeScript
â””â”€â”€ docs/
    â””â”€â”€ TECIDOS.md                    # Esta documentaÃ§Ã£o
```

## Boas PrÃ¡ticas

### UI Otimista

1. **Sempre atualize a UI imediatamente** antes da operaÃ§Ã£o assÃ­ncrona
2. **Mantenha estado original** para reverter em caso de erro
3. **ForneÃ§a feedback visual** (loading states, toasts)
4. **Trate erros adequadamente** revertendo mudanÃ§as

### ValidaÃ§Ã£o

1. **Valide no frontend** para feedback rÃ¡pido
2. **Valide no backend** para seguranÃ§a
3. **Mostre erros claros** ao usuÃ¡rio
4. **Limpe erros** quando campos sÃ£o corrigidos

### Performance

1. **Use queries otimizadas** no Firestore
2. **Implemente paginaÃ§Ã£o** se houver muitos tecidos
3. **Cache imagens** quando possÃ­vel
4. **Otimize uploads** comprimindo imagens se necessÃ¡rio

### Manutenibilidade

1. **Separe responsabilidades** (hooks, componentes, utilitÃ¡rios)
2. **Use TypeScript** para type safety
3. **Documente funÃ§Ãµes complexas**
4. **Siga padrÃµes do projeto** (shadcn/ui, Tailwind CSS)

## Troubleshooting

### SKU nÃ£o estÃ¡ sendo gerado

- Verifique se o documento `sku_control` existe no Firestore
- Verifique permissÃµes do Firestore
- Verifique console para erros

### Imagem nÃ£o faz upload

- Verifique regras do Firebase Storage
- Verifique tamanho e formato do arquivo
- Verifique permissÃµes de autenticaÃ§Ã£o

### UI nÃ£o atualiza apÃ³s operaÃ§Ã£o

- Verifique se o hook estÃ¡ sendo usado corretamente
- Verifique se hÃ¡ erros no console
- Verifique se o Firestore estÃ¡ sincronizado

### ComposiÃ§Ã£o nÃ£o valida

- Verifique se a soma das porcentagens Ã© exatamente 100%
- Verifique se todos os campos estÃ£o preenchidos
- Verifique se hÃ¡ itens duplicados

## PrÃ³ximos Passos

- [ ] Implementar paginaÃ§Ã£o na tabela
- [ ] Adicionar filtros e busca
- [ ] Implementar ordenaÃ§Ã£o
- [ ] Adicionar exportaÃ§Ã£o de dados
- [ ] Implementar histÃ³rico de alteraÃ§Ãµes
- [ ] Adicionar suporte a mÃºltiplas imagens
- [ ] Implementar categorias de tecidos


