# Documentação: Módulo de Tecidos

## Visão Geral

O módulo de Tecidos implementa um sistema completo de gerenciamento de tecidos com UI otimista, permitindo operações CRUD (Create, Read, Update, Delete) com feedback rápido para o usuário enquanto as operações são processadas em segundo plano no Firebase.

## Estrutura de Dados

### Firestore Collection: `tecidos`

```typescript
interface Tecido {
  id: string;                    // Document ID do Firestore
  nome: string;                   // Nome do tecido (obrigatório)
  largura: number;                // Largura em metros (obrigatório)
  composicao: string;             // Campo de texto livre (obrigatório)
  imagemPadrao: string;           // URL do Firebase Storage (obrigatório)
  descricao?: string;             // Descrição opcional
  sku: string;                    // SKU único (T001, T002, etc)
  createdAt: Timestamp;           // Data de criação
  updatedAt: Timestamp;           // Data de atualização
  deletedAt?: Timestamp;          // Data de exclusão (soft delete)
}

```

**Nota sobre Formato de Entrada:**
No formulário, o campo de composição é um campo de texto livre simples (Textarea). O usuário pode digitar qualquer texto descrevendo a composição, por exemplo: "Algodão 60%, Poliester 40%" ou "100% Algodão". Não há validação de formato ou porcentagem.

### Firestore Collection: `sku_control`

Documento único para controlar geração de SKUs:

```typescript
interface SkuControl {
  lastSkuNumber: number;          // Último número usado (ex: 3 para T003)
  invalidatedSkus: string[];      // Array de SKUs excluídos ["T002"]
}
```

## Arquitetura

### Componentes

#### `Tecidos.tsx` (Página Principal)
- Gerencia estado do modal e tecido em edição
- Integra tabela e modal de formulário
- Coordena operações CRUD

#### `TecidosTable.tsx`
- Exibe lista de tecidos em formato de tabela
- Mostra estados de loading (saving, deleting)
- Botões de ação: Editar e Excluir

#### `TecidoFormModal.tsx`
- Modal de formulário para criar/editar tecidos
- Validação de campos obrigatórios
- Upload de imagem com preview
- Campo de composição: Textarea simples de texto livre

### Hooks

#### `useTecidos.ts`
Hook principal para operações CRUD com UI otimista:

```typescript
const {
  tecidos,        // Array de tecidos
  loading,        // Estado de carregamento
  error,          // Erro se houver
  createTecido,   // Função para criar tecido
  updateTecido,   // Função para atualizar tecido
  deleteTecido,   // Função para excluir tecido
  loadTecidos,    // Função para recarregar lista
} = useTecidos();
```

#### `useSku.ts`
Hook para gerenciar SKUs:

```typescript
const {
  generateNextSku,  // Gera próximo SKU disponível
  invalidateSku,    // Invalida um SKU
  loading,
  error,
} = useSku();
```

### Utilitários Firebase

#### `lib/firebase/tecidos.ts`
Funções utilitárias para operações no Firestore e Storage:

- `getTecidos()` - Busca todos os tecidos
- `getTecidoById(id)` - Busca tecido específico
- `createTecido(data, sku, imageUrl)` - Cria novo tecido
- `updateTecido(id, data, imageUrl?)` - Atualiza tecido
- `deleteTecido(id, imageUrl)` - Exclui tecido (soft delete)
- `uploadTecidoImage(file, tecidoId)` - Upload de imagem
- `deleteTecidoImage(imageUrl)` - Remove imagem do Storage
- `getSkuControl()` - Busca controle de SKU
- `updateSkuControl(lastSkuNumber, invalidatedSkus)` - Atualiza controle
- `addInvalidatedSku(sku)` - Adiciona SKU inválido

## Padrão de UI Otimista

### Conceito

UI Otimista é um padrão onde a interface é atualizada imediatamente antes da confirmação do servidor, proporcionando feedback rápido ao usuário. Se a operação falhar, a UI é revertida.

### Fluxo de Criação

1. **Usuário preenche formulário e clica em "Salvar"**
2. **Imediatamente (UI Otimista):**
   - Modal fecha
   - Toast: "Tecido sendo cadastrado..."
   - Tecido temporário adicionado à tabela com `_status: 'saving'`
   - SKU temporário: "..."
3. **Em segundo plano:**
   - Gera SKU (busca próximo disponível)
   - Faz upload da imagem para Storage
   - Salva no Firestore
   - Atualiza controle de SKU
4. **Após sucesso:**
   - Atualiza tecido na tabela com dados reais
   - Toast: "Tecido cadastrado com sucesso!"
   - Remove estado `saving`
5. **Em caso de erro:**
   - Remove tecido temporário da tabela
   - Toast de erro
   - Modal pode ser reaberto com dados preenchidos

### Fluxo de Exclusão

1. **Usuário clica em excluir**
2. **Imediatamente:**
   - Remove da tabela
   - Toast: "Tecido sendo excluído..."
   - SKU marcado como inválido localmente
3. **Em segundo plano:**
   - Deleta do Firestore (soft delete)
   - Atualiza controle de SKU (adiciona ao array de inválidos)
4. **Após sucesso:**
   - Toast: "Tecido excluído com sucesso!"
5. **Em caso de erro:**
   - Restaura tecido na tabela
   - Toast de erro

### Fluxo de Atualização

1. **Usuário edita e salva**
2. **Imediatamente:**
   - Atualiza tecido na tabela com novos dados
   - Marca como `_status: 'saving'`
   - Toast: "Tecido sendo atualizado..."
3. **Em segundo plano:**
   - Upload de nova imagem (se fornecida)
   - Atualiza no Firestore
4. **Após sucesso:**
   - Recarrega lista para garantir dados atualizados
   - Toast: "Tecido atualizado com sucesso!"
5. **Em caso de erro:**
   - Restaura estado original do tecido
   - Toast de erro

## Sistema de SKU

### Formato
- Padrão: `T` + número com 3 dígitos
- Exemplos: `T001`, `T002`, `T003`, ..., `T999`

### Geração

1. Busca documento `sku_control` no Firestore
2. Se não existe, cria com `lastSkuNumber: 0` e `invalidatedSkus: []`
3. Incrementa `lastSkuNumber`
4. Gera SKU: `T${nextNumber.toString().padStart(3, '0')}`
5. Atualiza controle no Firebase

### Invalidação

1. Ao excluir tecido, SKU é adicionado ao array `invalidatedSkus`
2. SKUs inválidos não são reutilizados automaticamente
3. Mantém histórico para auditoria

## Validações

### Frontend

- **Nome**: obrigatório, mínimo 3 caracteres
- **Largura**: obrigatório, número positivo
- **Composição**: 
  - Obrigatório, campo de texto livre
  - Apenas valida se está preenchido
  - Não há validação de formato ou porcentagem
  - Exemplo: "Algodão 60%, Poliester 40%"
- **Imagem**: 
  - Obrigatória
  - Formatos aceitos: JPG, PNG, WEBP
  - Tamanho máximo: 5MB
- **Descrição**: opcional

### Backend (Rotas Opcionais)

- Validação de campos obrigatórios
- Validação de formato de SKU
- Validação de composição: apenas verificar se está preenchido
- Validação de permissões de usuário autenticado

## Formato de Composição

O campo de composição é um campo de texto livre simples (Textarea):

- **Tipo**: Textarea de texto livre
- **Validação**: Apenas verifica se está preenchido
- **Sem parsing**: Não há processamento automático do texto
- **Exemplos**:
  - "Algodão 60%, Poliester 40%"
  - "100% Algodão"
  - "Algodão, Poliester e Viscose"
  - Qualquer texto descritivo da composição

### Interface Simplificada

- Campo único Textarea (sem múltiplos campos)
- Sem botão "Adicionar" ou "Remover"
- Sem agrupamento visual ou cards
- Interface mais simples e direta

## Upload de Imagem

### Processo

1. Usuário seleciona arquivo
2. Validação de tipo e tamanho
3. Preview da imagem exibido
4. Ao salvar, upload para Firebase Storage
5. Caminho: `tecidos/{tecidoId}/{timestamp}-{filename}`
6. URL retornada e salva no Firestore

### Validações

- Tipos aceitos: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`
- Tamanho máximo: 5MB
- Preview antes de salvar

## Como Usar

### Criar Tecido

```typescript
import { useTecidos } from '@/hooks/useTecidos';

const { createTecido } = useTecidos();

await createTecido({
  nome: 'Tecido de Algodão',
        largura: 1.50,
  composicao: [
    { id: '1', nome: 'Algodão', porcentagem: 60 },
    { id: '2', nome: 'Poliester', porcentagem: 40 },
  ],
  imagemPadrao: file, // File object
  descricao: 'Tecido macio e confortável',
});
```

### Atualizar Tecido

```typescript
const { updateTecido } = useTecidos();

await updateTecido({
  id: 'tecido-id',
  nome: 'Novo Nome',
        largura: 1.60,
        composicao: '100% Algodão',
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
├── components/
│   └── Tecidos/
│       ├── TecidoFormModal.tsx       # Modal de formulário
│       └── TecidosTable.tsx          # Tabela de tecidos
├── hooks/
│   ├── useSku.ts                    # Hook de SKU
│   └── useTecidos.ts                # Hook principal CRUD
├── lib/
│   └── firebase/
│       └── tecidos.ts               # Funções Firebase
├── pages/
│   └── Tecidos.tsx                  # Página principal
├── types/
│   └── tecido.types.ts              # Tipos TypeScript
└── docs/
    └── TECIDOS.md                    # Esta documentação
```

## Boas Práticas

### UI Otimista

1. **Sempre atualize a UI imediatamente** antes da operação assíncrona
2. **Mantenha estado original** para reverter em caso de erro
3. **Forneça feedback visual** (loading states, toasts)
4. **Trate erros adequadamente** revertendo mudanças

### Validação

1. **Valide no frontend** para feedback rápido
2. **Valide no backend** para segurança
3. **Mostre erros claros** ao usuário
4. **Limpe erros** quando campos são corrigidos

### Performance

1. **Use queries otimizadas** no Firestore
2. **Implemente paginação** se houver muitos tecidos
3. **Cache imagens** quando possível
4. **Otimize uploads** comprimindo imagens se necessário

### Manutenibilidade

1. **Separe responsabilidades** (hooks, componentes, utilitários)
2. **Use TypeScript** para type safety
3. **Documente funções complexas**
4. **Siga padrões do projeto** (shadcn/ui, Tailwind CSS)

## Troubleshooting

### SKU não está sendo gerado

- Verifique se o documento `sku_control` existe no Firestore
- Verifique permissões do Firestore
- Verifique console para erros

### Imagem não faz upload

- Verifique regras do Firebase Storage
- Verifique tamanho e formato do arquivo
- Verifique permissões de autenticação

### UI não atualiza após operação

- Verifique se o hook está sendo usado corretamente
- Verifique se há erros no console
- Verifique se o Firestore está sincronizado

### Composição não valida

- Verifique se a soma das porcentagens é exatamente 100%
- Verifique se todos os campos estão preenchidos
- Verifique se há itens duplicados

## Próximos Passos

- [ ] Implementar paginação na tabela
- [ ] Adicionar filtros e busca
- [ ] Implementar ordenação
- [ ] Adicionar exportação de dados
- [ ] Implementar histórico de alterações
- [ ] Adicionar suporte a múltiplas imagens
- [ ] Implementar categorias de tecidos
