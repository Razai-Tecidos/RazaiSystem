# Documentação de Hooks

## useAuth

Hook para gerenciar autenticação do usuário.

**Localização**: `frontend/src/hooks/useAuth.ts`

**Retorno**:
```typescript
interface AuthContextType {
  user: User | null;           // Usuário autenticado do Firebase
  loading: boolean;            // Estado de carregamento
  loginWithGoogle: () => Promise<void>; // Função de login
  logout: () => Promise<void>;          // Função de logout
}
```

**Uso**:
```typescript
const { user, loading, loginWithGoogle, logout } = useAuth();
```

**Funcionalidades**:
- Observa mudanças no estado de autenticação do Firebase
- Login com Google através de popup
- Logout do Firebase
- Estado de loading durante inicialização

---

## useTecidos

Hook para operações CRUD de tecidos com UI otimista.

**Localização**: `frontend/src/hooks/useTecidos.ts`

**Retorno**:
```typescript
{
  tecidos: TecidoWithStatus[];  // Lista de tecidos com status
  loading: boolean;              // Estado de carregamento inicial
  error: string | null;          // Erro, se houver
  createTecido: (data: CreateTecidoData) => Promise<void>;
  updateTecido: (data: UpdateTecidoData) => Promise<void>;
  deleteTecido: (id: string) => Promise<void>;
  loadTecidos: () => Promise<void>;
}
```

**Uso**:
```typescript
const { tecidos, loading, createTecido, updateTecido, deleteTecido } = useTecidos();
```

**Funcionalidades**:
- **UI Otimista**: Atualiza interface imediatamente antes da confirmação do servidor
- **Rollback automático**: Reverte mudanças em caso de erro
- **Feedback visual**: Estados de loading (saving, deleting)
- **Toasts**: Notificações de sucesso/erro
- **Upload de imagem**: Gerencia upload para Firebase Storage
- **Gerenciamento de SKU**: Integração com `useSku` para gerar SKUs únicos

**Fluxo de Criação**:
1. Cria tecido temporário na UI (otimista)
2. Gera SKU único
3. Cria documento no Firestore (obtém ID real)
4. Faz upload da imagem usando ID real
5. Atualiza documento com URL da imagem
6. Substitui tecido temporário pelo real
7. Se upload falhar, remove documento criado e invalida SKU

**Fluxo de Atualização**:
1. Atualiza UI otimisticamente
2. Faz upload de nova imagem (se fornecida)
3. Atualiza documento no Firestore
4. Recarrega lista para garantir sincronização
5. Reverte em caso de erro

**Fluxo de Exclusão**:
1. Remove da UI imediatamente
2. Invalida SKU
3. Marca como excluído no Firestore (soft delete)
4. Remove imagem do Storage (opcional)
5. Restaura em caso de erro

---

## useSku

Hook para gerenciar geração e invalidação de SKUs.

**Localização**: `frontend/src/hooks/useSku.ts`

**Retorno**:
```typescript
{
  generateNextSku: () => Promise<string>;  // Gera próximo SKU (T001, T002...)
  invalidateSku: (sku: string) => Promise<void>; // Invalida SKU excluído
}
```

**Uso**:
```typescript
const { generateNextSku, invalidateSku } = useSku();
const sku = await generateNextSku(); // Retorna "T001", "T002", etc.
```

**Funcionalidades**:
- **Geração sequencial**: Gera SKUs no formato T001, T002, T003...
- **Reutilização de SKUs invalidados**: Prioriza SKUs excluídos antes de criar novos
- **Persistência**: Armazena controle em documento `sku_control` no Firestore
- **Thread-safe**: Usa transações do Firestore para evitar conflitos

**Formato de SKU**:
- Prefixo: `T` (para Tecidos)
- Número: 3 dígitos com zeros à esquerda (001, 002, 003...)
- Exemplo: `T001`, `T002`, `T003`

**Estrutura de Controle**:
```typescript
interface SkuControl {
  lastSkuNumber: number;    // Último número usado (ex: 3 para T003)
  invalidatedSkus: string[]; // Array de SKUs excluídos ["T002"]
}
```

---

## useToast

Hook para exibir notificações toast.

**Localização**: `frontend/src/hooks/use-toast.ts`

**Retorno**:
```typescript
{
  toast: (props: {
    title?: string;
    description?: string;
    variant?: 'default' | 'destructive';
  }) => void;
}
```

**Uso**:
```typescript
const { toast } = useToast();

toast({
  title: 'Sucesso!',
  description: 'Tecido cadastrado com sucesso!',
});

toast({
  title: 'Erro',
  description: 'Erro ao cadastrar tecido',
  variant: 'destructive',
});
```

**Variantes**:
- `default`: Toast padrão (sucesso/informação)
- `destructive`: Toast de erro (vermelho)

**Nota**: O componente `<Toaster />` deve estar presente no App para exibir os toasts.

---

## useCores

Hook para operações CRUD de cores com UI otimista.

**Localização**: `frontend/src/hooks/useCores.ts`

**Retorno**:
```typescript
{
  cores: CorWithStatus[];           // Lista de cores com status
  loading: boolean;                  // Estado de carregamento inicial
  error: string | null;              // Erro, se houver
  createCor: (data: CreateCorData) => Promise<void>;
  updateCor: (data: UpdateCorData) => Promise<void>;
  deleteCor: (id: string) => Promise<void>;
  loadCores: () => Promise<void>;
}
```

**Uso**:
```typescript
const { cores, loading, createCor, updateCor, deleteCor } = useCores();
```

**Funcionalidades**:
- **UI Otimista**: Atualiza interface imediatamente antes da confirmação do servidor
- **Rollback automático**: Reverte mudanças em caso de erro
- **Feedback visual**: Estados de loading (saving, deleting)
- **Toasts**: Notificações de sucesso/erro
- **Gerenciamento de SKU**: Gera SKUs únicos no formato C001, C002, etc.

**Formato de SKU**:
- Prefixo: `C` (para Cores)
- Número: 3 dígitos com zeros à esquerda (001, 002, 003...)
- Exemplo: `C001`, `C002`, `C003`

---

## useEstampas

Hook para operações CRUD de estampas com UI otimista e cadastro em lote.

**Localização**: `frontend/src/hooks/useEstampas.ts`

**Retorno**:
```typescript
{
  estampas: EstampaWithStatus[];  // Lista de estampas com status
  loading: boolean;                // Estado de carregamento inicial
  loadEstampas: () => Promise<void>;
  createEstampa: (data: CreateEstampaData) => Promise<void>;
  createEstampasBatch: (nomes: string[], tecidoBaseId: string) => Promise<void>;
  updateEstampa: (data: UpdateEstampaData) => Promise<void>;
  deleteEstampa: (id: string) => Promise<void>;
}
```

**Uso**:
```typescript
const { estampas, loading, createEstampa, createEstampasBatch } = useEstampas();

// Criar uma estampa
await createEstampa({
  nome: 'Jardim Pink',
  tecidoBaseId: 'tecido-123',
});

// Criar múltiplas estampas em lote
await createEstampasBatch(
  ['Jardim Pink', 'Jardim Azul', 'Floral Rosa'],
  'tecido-123'
);
```

**Funcionalidades**:
- **UI Otimista**: Atualiza interface imediatamente antes da confirmação do servidor
- **Rollback automático**: Reverte mudanças em caso de erro
- **Cadastro em lote**: Cria múltiplas estampas sequencialmente
- **SKU automático**: Gera SKU baseado na família (primeira palavra do nome)
- **Upload de imagem**: Gerencia upload opcional para Firebase Storage

**Formato de SKU**:
- Prefixo: 2 letras da primeira palavra do nome (família)
- Número: 3 dígitos sequenciais por família
- Exemplo: "Jardim Pink" → `JA001`, "Floral Rosa" → `FL001`

**Documentação completa**: `frontend/src/docs/ESTAMPAS.md`

---

## useBluetooth

Hook genérico para comunicação Bluetooth usando Web Bluetooth API.

**Localização**: `frontend/src/hooks/useBluetooth.ts`

**Retorno**:
```typescript
interface UseBluetoothReturn {
  device: BluetoothDevice | null;   // Dispositivo conectado
  connected: boolean;                // Status de conexão
  connecting: boolean;               // Se está conectando
  error: string | null;              // Mensagem de erro
  connect: () => Promise<void>;      // Conecta ao dispositivo
  disconnect: () => Promise<void>;   // Desconecta
  sendCommand: (data: Uint8Array | string) => Promise<void>; // Envia comando
  onDataReceived: (callback: (data: DataView) => void) => void; // Callback de dados
}
```

**Uso**:
```typescript
const { connected, connect, disconnect, sendCommand, onDataReceived } = useBluetooth();

// Conectar
await connect();

// Receber dados
onDataReceived((data: DataView) => {
  console.log('Dados recebidos:', data);
});

// Enviar comando
await sendCommand(new Uint8Array([0x01]));
await sendCommand('MEASURE');
```

**Funcionalidades**:
- Conexão com dispositivos Bluetooth Low Energy (BLE)
- Filtragem por nome (`LS173`) ou serviços
- Envio de comandos (bytes ou string)
- Recepção de dados via notificações
- Tratamento de erros específicos (NotFound, Security, Network)
- Detecção de desconexão automática

**Serviços BLE Utilizados**:
- `0xFFE0` - Serial Port Data Channel (receber dados)
- `0xFFE5` - Bluetooth Data Channel (enviar comandos)

**Características**:
- `0xFFE4` - Notify (receber notificações de dados)
- `0xFFE9` - Write (enviar comandos)

**Requisitos**:
- Navegador com suporte a Web Bluetooth (Chrome, Edge)
- Dispositivo Bluetooth BLE compatível
- Permissão do usuário para acessar Bluetooth

---

## useColorimetro

Hook específico para o colorímetro LS173 da Linshang com captura automática via botão físico.

**Localização**: `frontend/src/hooks/useColorimetro.ts`

**Retorno**:
```typescript
interface UseColorimetroReturn {
  connected: boolean;                // Status de conexão
  connecting: boolean;               // Se está conectando
  capturedColor: CapturedColor | null; // Cor capturada
  error: string | null;              // Mensagem de erro
  rawData: string | null;            // Dados brutos do último pacote (debug)
  dataHistory: string[];             // Histórico de pacotes (últimos 10)
  connect: () => Promise<void>;      // Conecta ao colorímetro
  disconnect: () => Promise<void>;   // Desconecta
  capture: () => Promise<void>;      // No-op (captura é automática)
  clearCapture: () => void;          // Limpa cor capturada
  clearRawData: () => void;          // Limpa dados de debug
}

interface CapturedColor {
  lab: LabColor;  // Valores L, a, b
  hex: string;    // Código hexadecimal (#RRGGBB)
}

interface LabColor {
  L: number;  // 0-100 (luminosidade)
  a: number;  // -128 a 127 (verde-vermelho)
  b: number;  // -128 a 127 (azul-amarelo)
}
```

**Uso**:
```typescript
const { 
  connected, 
  capturedColor, 
  rawData,
  dataHistory,
  connect, 
  clearCapture,
  clearRawData
} = useColorimetro();

// Conectar ao colorímetro
await connect();

// Captura é AUTOMÁTICA via botão físico do dispositivo
// Quando usuário pressiona o botão, dados chegam automaticamente

// Usar cor capturada
if (capturedColor) {
  console.log('LAB:', capturedColor.lab);
  console.log('Hex:', capturedColor.hex);
}

// Debug: ver dados brutos (útil em mobile)
console.log('Último pacote:', rawData);
console.log('Histórico:', dataHistory);
```

**Funcionalidades**:
- **Captura automática**: Dados são capturados quando usuário pressiona botão físico
- Integração com `useBluetooth` para comunicação
- Parse específico para formato LS173
- Conversão LAB → Hex usando fórmulas CIE padrão
- Debug de dados brutos para facilitar testes em mobile

**Formato de Dados do LS173**:

O colorímetro LS173 envia pacotes de 64 bytes com o seguinte formato:

| Campo | Offset | Tipo | Descrição |
|-------|--------|------|-----------|
| Header | 0-1 | bytes | `AB 44` |
| L | 8-9 | int16 LE | Luminosidade × 100 |
| a | 10-11 | int16 LE | Eixo a × 100 |
| b | 12-13 | int16 LE | Eixo b × 100 |

**Exemplo**:
```
Pacote: AB 44 ... [offset 8] 1F 0C ... [offset 10] E3 08 ... [offset 12] EE 02
L = 0x0C1F / 100 = 31.03
a = 0x08E3 / 100 = 22.75  
b = 0x02EE / 100 = 7.50
```

**Formatos de Fallback**:
1. **6 bytes**: L, a, b como int16 × 100
2. **12 bytes**: L, a, b como float32
3. **Texto**: Padrão "L:XX.X a:XX.X b:XX.X"

**Debug em Mobile**:
- `rawData`: String formatada com HEX, DEC e ASCII do último pacote
- `dataHistory`: Array com os últimos 10 pacotes formatados
- Esses dados são exibidos na tela de captura para facilitar debug em dispositivos móveis onde o console não é acessível

---

## Utilitários de Cor

### colorUtils

Funções utilitárias para conversão de cores.

**Localização**: `frontend/src/lib/colorUtils.ts`

**Funções**:

#### labToRgb

Converte valores LAB para RGB usando fórmulas CIE padrão.

```typescript
function labToRgb(lab: { L: number; a: number; b: number }): { r: number; g: number; b: number }
```

**Parâmetros**:
- `lab.L`: Luminosidade (0-100)
- `lab.a`: Eixo verde-vermelho (-128 a 127)
- `lab.b`: Eixo azul-amarelo (-128 a 127)

**Retorno**:
- `r`, `g`, `b`: Valores RGB (0-255)

**Características**:
- Usa iluminante D65 (padrão)
- Aplica correção gamma sRGB
- Valores são clampados entre 0-255

#### rgbToHex

Converte valores RGB para código hexadecimal.

```typescript
function rgbToHex(rgb: { r: number; g: number; b: number }): string
```

**Exemplo**:
```typescript
rgbToHex({ r: 255, g: 87, b: 51 }); // "#FF5733"
```

#### labToHex

Conversão direta de LAB para hexadecimal.

```typescript
function labToHex(lab: { L: number; a: number; b: number }): string
```

**Exemplo**:
```typescript
labToHex({ L: 50, a: 20, b: 30 }); // "#B27350" (aproximado)
```

#### hexToRgb

Converte código hexadecimal para RGB.

```typescript
function hexToRgb(hex: string): { r: number; g: number; b: number } | null
```

**Exemplo**:
```typescript
hexToRgb('#FF5733'); // { r: 255, g: 87, b: 51 }
hexToRgb('invalid'); // null
```

#### rgbToLab

Converte valores RGB para LAB.

```typescript
function rgbToLab(rgb: { r: number; g: number; b: number }): { L: number; a: number; b: number }
```

**Exemplo**:
```typescript
rgbToLab({ r: 255, g: 87, b: 51 }); // { L: 50.2, a: 45.3, b: 32.1 } (aproximado)
```

---

## Utilitários de DeltaE

### deltaE.ts

Utilitários para cálculo de diferença de cores usando Delta E 2000.

**Localização**: `frontend/src/lib/deltaE.ts`

#### Constante Global

```typescript
export const DELTA_E_LIMIAR_CONFLITO = 3;
```

**Descrição**: Limiar global usado em todo o projeto para detectar conflitos de cores. Valores de referência:
- `< 1`: Diferença imperceptível ao olho humano
- `1-3`: Diferença perceptível apenas para observadores experientes
- `3-6`: Diferença perceptível para a maioria das pessoas
- `> 6`: Diferença claramente perceptível

#### deltaE2000

Implementação da fórmula Delta E 2000 (CIE DE2000) - a mais recente e precisa para diferença de cores perceptuais.

```typescript
function deltaE2000(lab1: LabColor, lab2: LabColor): number
```

**Parâmetros**:
- `lab1`: Primeira cor em LAB
- `lab2`: Segunda cor em LAB

**Retorno**: Valor numérico de diferença (quanto menor, mais próximas as cores)

**Exemplo**:
```typescript
const cor1 = { L: 50, a: 20, b: 30 };
const cor2 = { L: 52, a: 22, b: 32 };
const diferenca = deltaE2000(cor1, cor2); // ~2.5
```

#### encontrarConflitos

Encontra conflitos comparando uma cor capturada com todas as cores existentes.

```typescript
function encontrarConflitos(
  corCapturada: LabColor,
  coresExistentes: Cor[],
  limiar: number = DELTA_E_LIMIAR_CONFLITO
): CorConflito | null
```

**Retorno**: Objeto com detalhes do conflito ou `null` se não houver conflito

**Exemplo**:
```typescript
const conflito = encontrarConflitos(corLab, coresCadastradas);
if (conflito) {
  console.log(`Conflito com ${conflito.corNome} (DeltaE: ${conflito.deltaE})`);
}
```

#### temConflito

Valida se uma cor tem conflito com cores existentes.

```typescript
function temConflito(
  corCapturada: LabColor,
  coresExistentes: Cor[],
  limiar: number = DELTA_E_LIMIAR_CONFLITO
): boolean
```

---

## useCapturaLista

Hook para gerenciar lista de capturas de cores com validação automática de conflitos.

**Localização**: `frontend/src/hooks/useCapturaLista.ts`

**Retorno**:
```typescript
{
  capturas: CapturaItem[];              // Lista de capturas
  adicionarCaptura: (data: CreateCapturaData) => void;
  removerCaptura: (id: string) => void;
  atualizarCaptura: (id: string, updates: Partial<CapturaItem>) => void;
  limparLista: () => void;
  validarConflitos: () => void;
  temConflitos: boolean;                // Se há conflitos na lista
}
```

**Uso**:
```typescript
const {
  capturas,
  adicionarCaptura,
  removerCaptura,
  atualizarCaptura,
  temConflitos
} = useCapturaLista();
```

**Funcionalidades**:
- **Validação automática**: Valida conflitos ao adicionar capturas e quando cores mudam
- **Estado de conflito**: Marca capturas com `status: 'conflito'` quando deltaE < limiar
- **Informações de conflito**: Armazena ID, nome e hex da cor conflitante
- **Integração com useCores**: Usa cores cadastradas para validação

**Fluxo de Validação**:
1. Ao adicionar captura, compara com todas as cores existentes
2. Se deltaE < `DELTA_E_LIMIAR_CONFLITO`, marca como conflito
3. Armazena informações da cor conflitante
4. Revalida automaticamente quando cores mudam

---

## useReinhartTingimento

Hook para aplicar algoritmo de tingimento de Reinhart (clássico) em imagens de tecido.

**Localização**: `frontend/src/hooks/useReinhartTingimento.ts`

**Retorno**:
```typescript
{
  aplicarTingimento: (
    imagemBase: string,
    corAlvo: { r: number; g: number; b: number },
    ajustes?: AjustesCor
  ) => Promise<string>; // Retorna dataURL da imagem tingida
}
```

**Uso**:
```typescript
const { aplicarTingimento } = useReinhartTingimento();

const imagemTingida = await aplicarTingimento(
  tecido.imagemPadrao,
  { r: 255, g: 87, b: 51 },
  {
    hue: 10,
    saturation: 5,
    brightness: -5,
    contrast: 0
  }
);
```

**Ajustes de Cor**:
```typescript
interface AjustesCor {
  hue: number;        // -180 a 180 (matiz)
  saturation: number; // -100 a 100 (saturação)
  brightness: number; // -100 a 100 (brilho)
  contrast: number;   // -100 a 100 (contraste)
}
```

**Algoritmo**:
- Multiplica a cor alvo pela luminosidade do pixel original
- Preserva o padrão do tecido enquanto aplica a cor
- Usa suavização para manter detalhes
- Aplica ajustes de hue, saturation, brightness e contrast

**Características**:
- Processamento em canvas HTML5
- Suporte a imagens via URL ou dataURL
- Retorna dataURL da imagem processada
- Preserva transparência (alpha channel)
