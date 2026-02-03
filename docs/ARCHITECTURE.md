# Arquitetura do Projeto

## Visão Geral

O RazaiSystem é uma aplicação full-stack desenvolvida com separação clara entre frontend e backend, utilizando Firebase como backend-as-a-service.

## Arquitetura de Alto Nível

```
┌─────────────────┐
│   Frontend      │
│   (React)       │
│   Porta 3000    │
└────────┬────────┘
         │
         │ HTTP/HTTPS
         │
┌────────▼────────┐
│   Backend       │
│   (Express)     │
│   Porta 5000    │
└────────┬────────┘
         │
         │ Admin SDK
         │
┌────────▼────────┐
│   Firebase      │
│   - Firestore   │
│   - Storage     │
│   - Auth        │
└─────────────────┘
```

## Fluxo de Dados

### Autenticação

```
1. Usuário clica "Entrar com Google"
   ↓
2. Firebase Client SDK abre popup Google
   ↓
3. Usuário autentica
   ↓
4. Token ID retornado
   ↓
5. Frontend armazena token
   ↓
6. Requisições ao backend incluem token no header Authorization
   ↓
7. Backend valida token com Firebase Admin SDK
   ↓
8. Verifica se email está autorizado
   ↓
9. Permite ou bloqueia acesso
```

### Operações CRUD (Tecidos)

#### Create (Criar)

```
1. Usuário preenche formulário
   ↓
2. Validação no frontend
   ↓
3. UI Otimista: adiciona tecido temporário à lista
   ↓
4. Gera SKU único (useSku)
   ↓
5. Cria documento no Firestore (obtém ID real)
   ↓
6. Upload imagem para Storage usando ID real
   ↓
7. Atualiza documento com URL da imagem
   ↓
8. Substitui tecido temporário pelo real
   ↓
   [Se erro] Remove documento e invalida SKU
```

#### Read (Ler)

```
1. Hook useTecidos carrega ao montar componente
   ↓
2. Busca documentos em Firestore (onde deletedAt == null)
   ↓
3. Converte arrays antigos de composição para string
   ↓
4. Atualiza estado React
   ↓
5. Componente renderiza lista
```

#### Update (Atualizar)

```
1. Usuário edita tecido existente
   ↓
2. Validação no frontend
   ↓
3. UI Otimista: atualiza tecido na lista
   ↓
4. Se nova imagem: upload para Storage
   ↓
5. Atualiza documento no Firestore
   ↓
6. Recarrega lista para sincronização
   ↓
   [Se erro] Reverte para estado original
```

#### Delete (Excluir)

```
1. Usuário confirma exclusão
   ↓
2. UI Otimista: remove da lista imediatamente
   ↓
3. Invalida SKU (adiciona ao array invalidatedSkus)
   ↓
4. Soft delete: marca deletedAt no Firestore
   ↓
5. (Opcional) Remove imagem do Storage
   ↓
   [Se erro] Restaura tecido na lista
```

## Padrões de Design

### UI Otimista

O projeto implementa UI otimista em todas as operações CRUD:

**Vantagens**:
- Feedback imediato ao usuário
- Percepção de velocidade
- Melhor experiência do usuário

**Implementação**:
- Atualiza estado React antes da operação assíncrona
- Mostra estados visuais (loading, saving, deleting)
- Reverte automaticamente em caso de erro
- Usa toasts para feedback

### Separação de Responsabilidades

**Frontend**:
- UI/UX
- Validação de formulários
- Gerenciamento de estado local
- Comunicação com Firebase Client SDK

**Backend**:
- Validação de negócio
- Autenticação e autorização
- Operações administrativas (Firebase Admin SDK)
- API REST (opcional, para operações complexas)

**Firebase**:
- Armazenamento de dados (Firestore)
- Armazenamento de arquivos (Storage)
- Autenticação de usuários (Auth)

### Gerenciamento de Estado

**Context API**:
- `AuthContext`: Estado global de autenticação
- Observa mudanças no Firebase Auth
- Fornece funções de login/logout

**Hooks Customizados**:
- `useTecidos`: Estado e operações CRUD de tecidos
- `useSku`: Gerenciamento de SKUs
- `useAuth`: Acesso ao contexto de autenticação

**Estado Local**:
- Componentes gerenciam estado específico (modais, formulários)
- Navegação entre páginas via estado local

## Estrutura de Dados

### Firestore Collections

#### `tecidos`
```typescript
{
  id: string;              // Document ID
  nome: string;
  largura: number;         // Em metros
  composicao: string;      // Texto livre
  imagemPadrao: string;    // URL do Storage
  descricao?: string;
  sku: string;             // T001, T002, etc.
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp;   // Soft delete
}
```

#### `sku_control` (documento único)
```typescript
{
  lastSkuNumber: number;   // Último número usado
  invalidatedSkus: string[]; // SKUs excluídos
}
```

### Firebase Storage

**Estrutura**:
```
tecidos/
  └── {tecidoId}/
      └── {timestamp}-{filename}
```

**Exemplo**:
```
tecidos/MVdvaD8rVnzepSI36QvN/1770124976638-Branco Neve - Cor.png
```

## Segurança

### Autenticação
- Firebase Authentication com Google Sign-In
- Validação de email autorizado no backend
- Tokens JWT para comunicação frontend-backend

### Regras de Segurança

**Firestore**:
- Apenas usuários autenticados podem ler/escrever
- Soft delete para manter histórico

**Storage**:
- Apenas usuários autenticados podem fazer upload/download
- Estrutura organizada por tecido (isolamento)

### Validação

**Frontend**:
- Validação de formulários antes de enviar
- Validação de tipos de arquivo
- Validação de tamanho de arquivo

**Backend**:
- Validação de dados recebidos
- Validação de autenticação
- Validação de autorização (email autorizado)

## Performance

### Otimizações Implementadas

1. **UI Otimista**: Reduz percepção de latência
2. **Lazy Loading**: Componentes carregados sob demanda
3. **Índices Firestore**: Para queries eficientes
4. **Compressão de Imagens**: (Futuro) Reduzir tamanho de uploads
5. **Paginação**: (Futuro) Para grandes listas

### Considerações

- Firestore cobra por leituras/escritas
- Storage cobra por armazenamento e transferência
- UI otimista pode causar inconsistências temporárias (mitigado com rollback)

## Escalabilidade

### Pontos de Escala

**Frontend**:
- Componentes modulares e reutilizáveis
- Hooks customizados para lógica compartilhada
- Separação clara de responsabilidades

**Backend**:
- API REST stateless
- Middleware reutilizável
- Validação centralizada

**Firebase**:
- Escala automaticamente
- Índices compostos para queries complexas
- Regras de segurança escaláveis

### Limitações Atuais

- Navegação via estado local (não usa React Router)
- Sem paginação de listas
- Sem cache de dados
- Sem otimização de imagens

## Extensibilidade

### Adicionar Novos Módulos

1. Criar tipos em `types/`
2. Criar funções Firebase em `lib/firebase/`
3. Criar hook customizado em `hooks/`
4. Criar componentes em `components/`
5. Criar página em `pages/`
6. Adicionar rota de navegação em `Home.tsx`

### Adicionar Novas Funcionalidades

- Seguir padrões existentes
- Usar UI otimista para operações assíncronas
- Implementar validação adequada
- Adicionar feedback visual (toasts)
- Documentar em `docs/`
