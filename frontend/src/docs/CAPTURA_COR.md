# Módulo de Captura de Cor com Colorímetro

## Visão Geral

O módulo de Captura de Cor permite capturar cores diretamente de um colorímetro LS173 da Linshang via Bluetooth. O sistema oferece um fluxo simplificado:

### Fluxo de Captura (Tela de Captura)
1. **Conexão Bluetooth** com colorímetro LS173
2. **Captura automática** via botão físico do dispositivo
3. **Lista de capturas** com associação a tecidos
4. **Validação automática** de conflitos usando Delta E 2000
5. **Envio** das cores para "Gerenciar Cores"

### Edição e Visualização (Tela de Gerenciar Cores)
6. **Visualização** do tecido tingido com algoritmo de Reinhart
7. **Ajustes finos** de cor com sliders interativos
8. **Edição de nome** e informações

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                        CapturaCor.tsx                           │
│                    (Página Principal)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │ useColorimetro  │───▶│  useBluetooth   │                    │
│  │   (LS173)       │    │   (Genérico)    │                    │
│  └────────┬────────┘    └────────┬────────┘                    │
│           │                      │                              │
│           ▼                      ▼                              │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │  colorUtils.ts  │    │  Web Bluetooth  │                    │
│  │  (LAB → Hex)    │    │      API        │                    │
│  └─────────────────┘    └─────────────────┘                    │
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │  ColorSwatch    │    │ CapturaCorForm  │                    │
│  │  (Visual)       │    │  (Formulário)   │                    │
│  └─────────────────┘    └─────────────────┘                    │
│                                                                 │
│  ┌─────────────────┐                                           │
│  │    useCores     │◀── Salvar cor no Firebase                 │
│  └─────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
```

## Fluxo de Funcionamento

### 1. Conexão Bluetooth

```
Usuário clica "Conectar"
         │
         ▼
navigator.bluetooth.requestDevice()
         │
         ▼
Seleciona dispositivo LS173
         │
         ▼
device.gatt.connect()
         │
         ▼
Obtém serviços e características
         │
         ▼
Habilita notificações (0xFFE4)
         │
         ▼
✅ Conectado
```

### 2. Captura de Cor (Automática via Botão Físico)

```
Usuário pressiona BOTÃO FÍSICO no colorímetro
         │
         ▼
Dispositivo envia dados automaticamente
         │
         ▼
Hook recebe via notificação BLE
         │
         ▼
Recebe pacote de 64 bytes (header AB 44)
         │
         ▼
Parse para valores LAB (offsets 8,10,12)
         │
         ▼
Converte LAB → Hex
         │
         ▼
✅ Cor capturada e exibida
```

**Formato de dados do LS173:**
- Pacote de 64 bytes
- Header: `AB 44`
- L: int16 little-endian em offset 8 (÷100)
- a: int16 little-endian em offset 10 (÷100)
- b: int16 little-endian em offset 12 (÷100)

### 3. Adicionar à Lista

```
Usuário clica "Adicionar à Lista"
         │
         ▼
Abre modal de seleção de tecido
         │
         ▼
Seleciona tecido
         │
         ▼
Cria CapturaItem com:
- LAB e Hex da cor
- ID e dados do tecido
- Nome gerado automaticamente
         │
         ▼
Valida conflitos automaticamente
(compara com todas as cores cadastradas)
         │
         ├──▶ DeltaE < 3 ──▶ Marca como conflito
         │                    Armazena info da cor próxima
         │
         ▼
✅ Adicionado à lista
```

### 4. Enviar Cores para Gerenciar Cores

```
Usuário clica "Enviar para Gerenciar Cores"
         │
         ▼
Sistema processa cada captura da lista
         │
         ▼
Cria cor no Firebase com:
- Nome, LAB original, RGB/Hex
- Informações do tecido associado
         │
         ▼
Limpa lista de capturas
         │
         ▼
✅ Cores disponíveis em "Gerenciar Cores"
```

### 5. Edição e Visualização (em Gerenciar Cores)

```
Usuário acessa "Gerenciar Cores"
         │
         ▼
Clica em "Editar" em uma cor capturada
         │
         ▼
Modal de edição abre com:
- Formulário de nome/hex
- Botão "Ver Preview no Tecido"
         │
         ▼
Clica no botão de preview
         │
         ▼
Carrega imagem padrão do tecido associado
         │
         ▼
Aplica algoritmo de Reinhart
(tinge tecido com cor)
         │
         ▼
Usuário ajusta sliders:
- Matiz, Saturação, Brilho, Contraste
         │
         ▼
Preview atualiza em tempo real
         │
         ▼
Clica "Salvar"
         │
         ▼
✅ Cor atualizada
```

## Componentes

### CapturaCor.tsx

Página principal que integra todos os componentes.

**Estados**:
- `disconnected`: Dispositivo não conectado
- `connecting`: Tentando conectar
- `connected`: Conectado e pronto
- `capturing`: Aguardando leitura
- `captured`: Cor capturada, aguardando ação

**Layout**:
```
┌─────────────────────────────────────┐
│ Header + Breadcrumb                │
├─────────────────────────────────────┤
│ Captura de Cor                      │
│                                     │
│ Status Bluetooth: [Conectado]      │
│ [Conectar] [Desconectar]           │
│                                     │
│ ┌─────────────────────────────┐    │
│ │   SWATCH (Grande)           │    │
│ │   [Cor Capturada]           │    │
│ │   LAB: L=50 a=20 b=30       │    │
│ │   Hex: #FF5733              │    │
│ └─────────────────────────────┘    │
│                                     │
│ ┌─────────────────────────────┐    │
│ │ Cor Capturada               │    │
│ │ [Adicionar à Lista]         │    │
│ │ [Descartar]                 │    │
│ └─────────────────────────────┘    │
│                                     │
│ Instruções: Pressione o botão      │
│ físico no colorímetro para capturar│
│                                     │
│ Debug: Dados Bluetooth (visível)   │
│ [HEX] [DEC] [ASCII] dos pacotes    │
│                                     │
│ ┌─────────────────────────────┐    │
│ │ Lista de Capturas (3)       │    │
│ │ ⚠️ Algumas cores têm conflitos│
│ │ [Limpar] [Enviar p/ Gerenciar]│
│ │                             │    │
│ │ ├─ Verde Floresta           │    │
│ │ │  T001 Algodão #50B050    │    │
│ │ │  ⚠️ Similar a "Verde Limão"│    │
│ │ │  [X Remover]             │    │
│ │ │                            │    │
│ │ └─ Azul Royal               │    │
│ │    T002 Seda #4169E1 ✓     │    │
│ │    [X Remover]             │    │
│ └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

**Notas sobre o layout:**
- Captura é automática pelo botão físico do colorímetro
- Não há botão "Capturar" no app
- Lista de capturas simplificada (sem edição)
- Debug de dados Bluetooth visível para facilitar testes em mobile
- Botão "Enviar para Gerenciar Cores" para finalizar fluxo

### ColorSwatch.tsx

Exibe a cor capturada em formato visual grande.

**Características**:
- Área de 256px de altura com a cor de fundo
- Código hex centralizado com contraste automático
- Valores LAB e Hex em seção informativa
- Estado vazio com mensagem quando sem cor

### CapturaLista.tsx

Componente principal da lista de capturas.

**Funcionalidades**:
- Exibe todas as capturas com informações completas
- Mostra contador de itens
- Alerta visual quando há conflitos
- Botão para limpar toda a lista
- Mensagem quando lista está vazia

### CapturaItemComponente.tsx

Item individual da lista de capturas.

**Exibe**:
- Swatch miniatura da cor
- Nome da cor e tecido associado
- SKU do tecido
- Valores LAB e código hex
- Badge de conflito (se deltaE < limiar)
- Informações detalhadas do conflito
- Botões de edição e exclusão

### TecidoSelecaoModal.tsx

Modal simplificado para selecionar tecido ao adicionar captura.

**Funcionalidades**:
- Lista de tecidos sem campo de busca (otimizado para mobile)
- Preview da imagem padrão de cada tecido
- Seleção direta com toque (fecha modal automaticamente)
- Layout compacto e responsivo
- Informações: nome e SKU do tecido

**Notas de UX**:
- Sem input de busca para evitar teclado no mobile
- Toque no tecido seleciona e confirma em uma ação
- Altura máxima de 70vh para não ocupar tela inteira

### CapturaListaSimples.tsx

Lista simplificada de capturas (usada na tela de Captura).

**Funcionalidades**:
- Exibe capturas com swatch miniatura, nome, tecido e hex
- Indicação de conflitos (badge amarelo)
- Botão de remover em cada item
- Botões "Limpar" e "Enviar para Gerenciar Cores"
- Dica para editar cores em "Gerenciar Cores"

**Notas**:
- Sem botão de edição (edição é feita em Gerenciar Cores)
- Layout responsivo para mobile

## Hooks

### useColorimetro

Hook específico para o colorímetro LS173 com captura automática.

```typescript
const {
  connected,      // boolean - status de conexão
  connecting,     // boolean - se está conectando
  capturedColor,  // { lab, hex } | null
  error,          // string | null
  rawData,        // string | null - dados brutos para debug
  dataHistory,    // string[] - histórico de pacotes recebidos
  connect,        // () => Promise<void>
  disconnect,     // () => Promise<void>
  capture,        // () => Promise<void> (no-op, captura é automática)
  clearCapture,   // () => void
  clearRawData,   // () => void - limpa debug
} = useColorimetro();
```

**Características**:
- Captura automática via botão físico do colorímetro
- Debug de dados brutos visível no app (para testes mobile)
- Parser específico para formato LS173 (64 bytes, header AB 44)
- Histórico dos últimos 10 pacotes recebidos

### useBluetooth

Hook genérico para comunicação Bluetooth BLE.

```typescript
const {
  device,         // BluetoothDevice | null
  connected,      // boolean
  connecting,     // boolean
  error,          // string | null
  connect,        // () => Promise<void>
  disconnect,     // () => Promise<void>
  sendCommand,    // (data) => Promise<void>
  onDataReceived, // (callback) => void
} = useBluetooth();
```

### useCapturaLista

Hook para gerenciar lista de capturas com validação automática.

```typescript
const {
  capturas,           // CapturaItem[]
  adicionarCaptura,   // (data) => void
  removerCaptura,     // (id) => void
  atualizarCaptura,   // (id, updates) => void
  limparLista,        // () => void
  validarConflitos,   // () => void
  temConflitos,       // boolean
} = useCapturaLista();
```

**Características**:
- Valida conflitos automaticamente ao adicionar
- Revalida quando cores cadastradas mudam
- Gerencia estado de conflito de cada captura

### useReinhartTingimento

Hook para aplicar algoritmo de tingimento de Reinhart.

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

## Validação de Conflitos

### Delta E 2000

O sistema usa a fórmula **Delta E 2000 (CIE DE2000)** para calcular diferença perceptual entre cores.

**Constante Global**:
```typescript
export const DELTA_E_LIMIAR_CONFLITO = 3;
```

**Valores de Referência**:
- `< 1`: Diferença imperceptível ao olho humano
- `1-3`: Diferença perceptível apenas para observadores experientes
- `3-6`: Diferença perceptível para a maioria das pessoas
- `> 6`: Diferença claramente perceptível

**Como Funciona**:
1. Ao adicionar captura à lista, compara com todas as cores cadastradas
2. Calcula deltaE entre cor capturada e cada cor existente
3. Se deltaE < `DELTA_E_LIMIAR_CONFLITO`, marca como conflito
4. Armazena informações da cor conflitante (ID, nome, hex, deltaE)
5. Exibe alertas visuais na lista e no modal de edição

**Comparação Global**:
- A comparação é feita apenas por cor (LAB)
- Não considera tecido na validação
- Uma cor pode ter conflito mesmo em tecidos diferentes

## Conversão de Cores

### LAB para RGB

Usa fórmulas CIE padrão com iluminante D65:

1. Converte LAB → XYZ
2. Converte XYZ → RGB (sRGB)
3. Aplica correção gamma
4. Clampa valores entre 0-255

### RGB para Hex

Converte cada componente para hexadecimal de 2 dígitos:

```typescript
`#${r.toString(16)}${g.toString(16)}${b.toString(16)}`
```

### Hex para LAB

Conversão reversa para comparar cores cadastradas (que têm apenas hex):

1. Hex → RGB
2. RGB → XYZ
3. XYZ → LAB

Permite comparar cores capturadas (LAB) com cores cadastradas (hex).

## Protocolo Bluetooth

### Serviços Utilizados

| UUID   | Nome                        | Uso             |
|--------|-----------------------------| ----------------|
| 0xFFE0 | Serial Port Data Channel    | Receber dados   |
| 0xFFE5 | Bluetooth Data Channel      | Enviar comandos |

### Características

| UUID   | Tipo   | Uso                    |
|--------|--------|------------------------|
| 0xFFE4 | Notify | Receber notificações   |
| 0xFFE9 | Write  | Enviar comandos        |

### Formato de Dados do LS173

**Formato Primário (identificado via testes):**

| Campo | Offset | Tipo | Descrição |
|-------|--------|------|-----------|
| Header | 0-1 | bytes | `AB 44` |
| ... | 2-7 | - | Dados internos |
| L | 8-9 | int16 LE | Luminosidade × 100 |
| a | 10-11 | int16 LE | Eixo a × 100 |
| b | 12-13 | int16 LE | Eixo b × 100 |
| ... | 14-63 | - | Dados adicionais |

**Exemplo de pacote:**
```
Bytes recebidos: AB 44 ... [offset 8] 1F 0C [offset 10] E3 08 [offset 12] EE 02
L = 0x0C1F / 100 = 31.03
a = 0x08E3 / 100 = 22.75
b = 0x02EE / 100 = 7.50
```

**Fallbacks (para compatibilidade):**
- 6 bytes: L, a, b como int16 (×100)
- 12 bytes: L, a, b como float32
- Texto: Padrão "L:XX.X a:XX.X b:XX.X"

## Tratamento de Erros

| Erro                  | Causa                           | Solução                        |
|-----------------------|---------------------------------|--------------------------------|
| NotFoundError         | Dispositivo não encontrado      | Ligar/aproximar colorímetro    |
| SecurityError         | Permissão negada                | Permitir Bluetooth no navegador|
| NetworkError          | Falha de conexão                | Reconectar                     |
| Timeout               | Sem resposta do dispositivo     | Verificar posicionamento       |
| Parse error           | Dados inválidos                 | Tentar nova captura            |

## Requisitos

### Navegador

- Chrome 56+ ou Edge 79+ (com Web Bluetooth)
- HTTPS (obrigatório para Web Bluetooth)
- Permissão de Bluetooth habilitada

### Hardware

- Colorímetro Linshang LS173
- Bluetooth 4.0+ (BLE)

## Testes e Ajustes

### Para testar com dispositivo físico:

1. Conectar ao LS173
2. Observar logs no console para dados recebidos
3. Ajustar `parseLabData()` conforme formato real
4. Ajustar comando de captura se necessário

### Logs de Debug

O hook `useColorimetro` loga no console:
- Dados recebidos em hexadecimal
- Tamanho do buffer
- Erros de parse

```javascript
console.log('Dados recebidos (hex):', ...);
console.log('Tamanho do buffer:', buffer.byteLength);
```

## Algoritmo de Reinhart

O algoritmo de tingimento de Reinhart (clássico) simula como um tecido ficaria tingido com uma cor específica.

**Processo**:
1. Carrega imagem padrão do tecido
2. Para cada pixel:
   - Calcula luminosidade original (média ponderada RGB)
   - Multiplica cor alvo pela luminosidade
   - Aplica suavização (70% nova cor, 30% original)
3. Preserva padrão do tecido enquanto aplica a cor
4. Aplica ajustes de hue, saturation, brightness e contrast

**Características**:
- Processamento em tempo real
- Preview atualiza conforme sliders mudam
- Preserva detalhes e textura do tecido
- Suporta ajustes finos de cor

## Fluxo Completo do Usuário

### Tela de Captura de Cor
1. **Conectar** ao colorímetro LS173 via Bluetooth
2. **Capturar** cor pressionando botão físico no dispositivo
3. **Revisar** cor capturada no swatch grande
4. **Adicionar à lista** tocando no tecido associado (modal simplificado)
5. **Visualizar** lista de capturas com indicação de conflitos
6. **Remover** itens indesejados da lista
7. **Enviar** cores para "Gerenciar Cores"

### Tela de Gerenciar Cores
8. **Editar** cor para:
   - Ver preview do tecido tingido (algoritmo Reinhart)
   - Ajustar cor com sliders (matiz, saturação, brilho, contraste)
   - Editar nome
   - Ver informações de conflito e dados LAB
9. **Salvar** alterações

## Status da Implementação

- [x] Conexão Bluetooth com LS173
- [x] Captura automática via botão físico
- [x] Parse de dados do formato LS173 (64 bytes, AB 44)
- [x] Debug de dados brutos visível no app (para mobile)
- [x] Lista de capturas simplificada
- [x] Validação de conflitos com Delta E 2000
- [x] Envio de cores para Firebase
- [x] Modal de seleção de tecido otimizado para mobile
- [x] Preview com algoritmo Reinhart (em Gerenciar Cores)
- [x] Sliders de ajuste de cor (em Gerenciar Cores)
- [x] Responsividade mobile em todas as telas
- [ ] Persistência dos ajustes de cor no Firebase (opcional)

## Observações Técnicas

### Mobile-First
- Modal de seleção de tecido sem campo de busca (evita teclado)
- Seleção direta com toque (uma ação)
- Debug de Bluetooth visível na tela (sem console)
- Layout responsivo em todos os componentes

### Performance
- Preview Reinhart carregado sob demanda (botão "Ver Preview")
- Histórico de pacotes limitado a 10 (evita memory leak)
- Processamento de imagem em canvas off-screen
