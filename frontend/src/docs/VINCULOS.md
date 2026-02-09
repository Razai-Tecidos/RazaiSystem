# Módulo de Vínculos Cor-Tecido

> **Nota**: Para regras críticas (SKU, separação Cor vs CorTecido, Firestore), consulte [CLAUDE.md](../../../CLAUDE.md) e [CONTEXT.md](../../../CONTEXT.md).

## Visão Geral

O módulo de Vínculos gerencia a associação entre cores e tecidos no sistema RazaiSystem. Cada vínculo (`CorTecido`) representa uma combinação específica de cor + tecido, armazenando a imagem tingida e os ajustes do algoritmo Reinhard.

## Arquitetura

### Separação de Entidades

A partir da refatoração, o sistema separa:

- **Cor**: Entidade independente representando uma cor (sem vínculo com tecido)
- **CorTecido**: Vínculo explícito entre uma cor e um tecido

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│     Cor     │ 1:N │    CorTecido    │ N:1 │   Tecido    │
│             │─────│                 │─────│             │
│ - nome      │     │ - imagemTingida │     │ - nome      │
│ - codigoHex │     │ - ajustesReinhard│     │ - imagemPadrao│
│ - lab       │     │ - corId         │     │ - sku       │
│ - sku       │     │ - tecidoId      │     └─────────────┘
└─────────────┘     │ - sku           │
                    └─────────────────┘
```

### Benefícios da Separação

1. **Reutilização de cores**: Uma mesma cor pode ser vinculada a múltiplos tecidos
2. **Ajustes independentes**: Cada vínculo tem seus próprios ajustes Reinhard
3. **Imagens específicas**: Cada combinação cor+tecido tem sua própria imagem tingida
4. **Flexibilidade**: Facilita gerenciar variações de um mesmo tom em tecidos diferentes

## Estrutura de Dados

### Interface `CorTecido`

```typescript
interface CorTecido {
  id: string;                    // Document ID
  sku?: string;                  // SKU do vínculo: "TecidoSKU-CorSKU" (ex: "T007-MA001")
  corId: string;                 // Referência à cor
  corNome: string;               // Denormalizado para exibição
  corHex?: string;               // Denormalizado para exibição
  corSku?: string;               // Denormalizado para exibição
  tecidoId: string;              // Referência ao tecido
  tecidoNome: string;            // Denormalizado para exibição
  tecidoSku?: string;            // Denormalizado para exibição
  imagemTingida?: string;        // URL da imagem do tecido tingido (PNG, resolução original)
  ajustesReinhard?: ReinhardConfig; // Ajustes do algoritmo Reinhard
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp;         // Para soft delete
}
```

### SKU do Vínculo

O SKU do vínculo é gerado automaticamente no formato `TecidoSKU-CorSKU`:
- Exemplo: `T007-MA001` (Tecido T007 + Cor MA001)
- Gerado automaticamente ao criar vínculo
- Atualizado quando SKU de cor ou tecido muda
- Pode ser gerado em lote para vínculos antigos via botão "Gerar SKUs"

### Coleção Firestore

- **Coleção**: `cor_tecido`
- **Índices compostos** para queries eficientes:
  - `corId` + `deletedAt`
  - `tecidoId` + `deletedAt`
  - `corId` + `tecidoId` + `deletedAt`

## Componentes

### Página de Vínculos (`Vinculos.tsx`)

Página principal para gerenciamento de vínculos.

**Funcionalidades:**
- Lista todos os vínculos agrupados por tecido (expansível/colapsável)
- Exibe imagem tingida, cor e tecido associados
- Coluna de SKU do vínculo (formato TecidoSKU-CorSKU)
- Coluna de HEX com clique para copiar
- Ações individuais: Editar, Excluir

**Edição Inline:**
- **Nome da cor**: Clique no nome para editar diretamente na tabela
  - Enter: Salva e vai para o próximo item
  - Esc: Cancela edição
  - Gera SKU automaticamente se a cor não tinha
- **SKU da cor**: Clique no SKU (ou "+ SKU") para editar
  - Converte automaticamente para maiúsculas
  - Propaga para todos os vínculos da mesma cor
- **Validação de duplicados**: Bloqueia nomes já existentes em outras cores

**Agrupamento por Tecido:**
- Vínculos são agrupados automaticamente por tecido
- Cada grupo pode ser expandido/colapsado clicando no cabeçalho
- Cabeçalho mostra nome do tecido, SKU e quantidade de cores

**Ações em Lote por Tecido:**
- **Copiar SKUs**: Copia todos os SKUs do grupo (separados por tab)
- **Copiar HEX**: Copia todos os códigos HEX do grupo (separados por tab)
- **Copiar Nomes**: Copia todos os nomes das cores (separados por tab)
- **Download Preview**: Baixa todas as imagens preview em ZIP

**Exportação XLSX:**
- Botão "Exportar XLSX" no cabeçalho da página
- Gera planilha com imagens inseridas como mídia (não URLs)
- Cada tecido em uma aba separada
- Colunas: SKU, SKU Cor, Nome, HEX, Preview, Datas
- Barra de progresso visual durante processamento
- Imagens convertidas para Base64 antes de inserir

**Ferramentas de Manutenção:**
- **Gerar SKUs**: Gera SKUs para cores e vínculos em lote
  - Primeiro gera SKU para cores que não têm (baseado no nome)
  - Depois gera SKU para vínculos (TecidoSKU-CorSKU)
  - Ignora cores com nome "Cor capturada"
- **Card de Diagnóstico**: Lista vínculos com problemas (referências inválidas)

**Localização:** `frontend/src/pages/Vinculos.tsx`

### Página de Edição (`EditarVinculo.tsx`)

Página para criar/editar vínculos com ajustes Reinhard.

**Funcionalidades:**
- Preview em tempo real do tingimento Reinhard
- Sliders para ajuste de parâmetros (L, a, b, stdL, stdA, stdB, hueShift)
- Correção manual de cor para coleta de exemplos de ML
- Salvar imagem tingida em PNG (resolução original, sem compressão)

**Localização:** `frontend/src/pages/EditarVinculo.tsx`

## Hooks

### `useCorTecido`

Hook para gerenciamento de vínculos.

```typescript
const {
  vinculos,           // Lista de todos os vínculos
  loading,            // Estado de carregamento
  error,              // Erro, se houver
  createVinculo,      // Criar novo vínculo
  updateVinculo,      // Atualizar vínculo existente
  deleteVinculo,      // Soft delete
  getVinculosByCor,   // Vínculos de uma cor específica
  getVinculosByTecido,// Vínculos de um tecido específico
  vinculoExists,      // Verifica se vínculo já existe
} = useCorTecido();
```

**Localização:** `frontend/src/hooks/useCorTecido.ts`

## Fluxo de Captura

Quando o usuário captura uma cor:

1. **Detecção de cor similar**: Sistema verifica se existe cor com ΔE < 3
2. **Se existe conflito**: Usuário escolhe:
   - **Usar existente**: Cria apenas vínculo com tecido selecionado
   - **Criar nova**: Cadastra nova cor e cria vínculo
3. **Se não existe**: Cria cor e vínculo automaticamente
4. **Vínculo criado**: Usuário pode editar ajustes em "Vínculos"

```
┌─────────────────┐
│ Captura de Cor  │
└────────┬────────┘
         │
    ┌────▼────┐
    │ Conflito?│
    └────┬────┘
    Sim/ │ \Não
       ▼   ▼
┌──────────┐  ┌──────────────┐
│ Escolher │  │ Criar Cor +  │
│  Ação    │  │ Criar Vínculo│
└────┬─────┘  └──────────────┘
     │
┌────▼─────┐  ┌────────────────┐
│Usar      │  │ Criar Nova +   │
│Existente │  │ Criar Vínculo  │
└────┬─────┘  └────────────────┘
     │
┌────▼─────┐
│ Criar    │
│ Vínculo  │
└──────────┘
```

## Funções Firebase

**Localização:** `frontend/src/lib/firebase/cor-tecido.ts`

### CRUD Básico

```typescript
// Criar vínculo
createCorTecido(data: CreateCorTecidoData): Promise<string>

// Atualizar vínculo
updateCorTecido(data: UpdateCorTecidoData): Promise<void>

// Soft delete
deleteCorTecido(id: string): Promise<void>

// Hard delete
hardDeleteCorTecido(id: string): Promise<void>
```

### Consultas

```typescript
// Buscar por ID
getCorTecidoById(id: string): Promise<CorTecido | null>

// Listar todos
getAllCorTecidos(): Promise<CorTecido[]>

// Por cor
getCorTecidosByCorId(corId: string): Promise<CorTecido[]>

// Por tecido
getCorTecidosByTecidoId(tecidoId: string): Promise<CorTecido[]>

// Por cor e tecido
getCorTecidoByCorAndTecido(corId: string, tecidoId: string): Promise<CorTecido | null>

// Verificar existência
existsCorTecido(corId: string, tecidoId: string): Promise<boolean>
```

### Listeners em Tempo Real

```typescript
// Todos os vínculos
subscribeToCorTecidos(callback): Unsubscribe

// Por cor
subscribeToCorTecidosByCor(corId, callback): Unsubscribe

// Por tecido
subscribeToCorTecidosByTecido(tecidoId, callback): Unsubscribe
```

### Atualização de Dados Denormalizados

```typescript
// Quando cor é renomeada
updateCorDataInVinculos(corId: string, corData: {...}): Promise<void>

// Quando tecido é renomeado
updateTecidoDataInVinculos(tecidoId: string, tecidoData: {...}): Promise<void>
```

## Regras de Segurança Firestore

```javascript
match /cor_tecido/{vinculoId} {
  allow read, write: if request.auth != null;
}
```

## Utilitário de ZIP

**Localização:** `frontend/src/lib/zipUtils.ts`

Função para criar arquivos ZIP com múltiplas imagens.

### API

```typescript
// Criar ZIP de imagens
createZipFromImages(
  images: Array<{ url: string; filename: string }>,
  zipFilename: string
): Promise<void>
```

### Uso

```typescript
import { createZipFromImages } from '@/lib/zipUtils';

// Download de múltiplas imagens em ZIP
await createZipFromImages([
  { url: 'https://...', filename: 'cor1.png' },
  { url: 'https://...', filename: 'cor2.png' },
], 'tecido_cores.zip');
```

### Dependências

- **JSZip**: Criação de arquivos ZIP
- **file-saver**: Download de arquivos no browser

```bash
npm install jszip file-saver @types/file-saver
```

## Exportação XLSX

### Visão Geral

A exportação XLSX permite baixar todos os vínculos em uma planilha Excel com imagens inseridas como mídia real (não URLs).

### Características

- **Imagens como mídia**: Imagens são inseridas diretamente nas células, não como links
- **Abas por tecido**: Cada tecido gera uma aba separada na planilha
- **Progresso visual**: Overlay com barra de progresso durante processamento
- **Base64**: Imagens convertidas para Base64 para maior compatibilidade

### Colunas da Planilha

| Coluna | Descrição |
|--------|-----------|
| SKU do Vínculo | SKU no formato TecidoSKU-CorSKU |
| SKU da Cor | SKU da cor |
| Nome da Cor | Nome da cor |
| HEX da Cor | Código hexadecimal |
| Imagem Preview | Imagem do tecido tingido (mídia) |
| Data de Criação | Data de criação do vínculo |
| Data de Atualização | Última atualização |

### Implementação Técnica

```typescript
// Converter imagem para Base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Inserir imagem na planilha
const imageId = workbook.addImage({
  base64: base64,
  extension: 'png',
});

worksheet.addImage(imageId, {
  tl: { col: 4, row: rowNumber - 1 },
  ext: { width: 90, height: 90 },
});
```

### Dependências

- **ExcelJS**: Biblioteca para geração de XLSX com suporte a imagens

```bash
npm install exceljs
```

## Exemplos de Uso

### Criar Vínculo Após Captura

```typescript
const { createVinculo, vinculoExists } = useCorTecido();

// Verificar se já existe
const existe = await vinculoExists(corId, tecidoId);

if (!existe) {
  await createVinculo({
    corId: cor.id,
    corNome: cor.nome,
    corHex: cor.codigoHex,
    tecidoId: tecido.id,
    tecidoNome: tecido.nome,
    tecidoSku: tecido.sku,
  });
}
```

### Listar Vínculos de uma Cor

```typescript
const { getVinculosByCor } = useCorTecido();

const vinculos = await getVinculosByCor(corId);
// Retorna array de vínculos com diferentes tecidos
```

### Atualizar Ajustes Reinhard

```typescript
const { updateVinculo } = useCorTecido();

await updateVinculo({
  id: vinculoId,
  ajustesReinhard: {
    meanL: 70,
    meanA: 10,
    meanB: -5,
    stdL: 25,
    stdA: 15,
    stdB: 15,
    hueShift: 0,
  },
  imagemTingida: base64Image,
});
```

## Considerações

### Dados Denormalizados

Os campos `corNome`, `corHex`, `tecidoNome`, etc. são denormalizados para:
- Evitar JOINs em cada consulta
- Melhorar performance de listagem
- Facilitar exibição na UI

**Importante:** Quando cor ou tecido são atualizados, os vínculos devem ser sincronizados usando `updateCorDataInVinculos` ou `updateTecidoDataInVinculos`.

### Soft Delete

Vínculos usam soft delete (`deletedAt`) para:
- Permitir recuperação de dados
- Manter histórico
- Evitar exclusão acidental

As queries filtram automaticamente vínculos deletados.
