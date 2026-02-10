# Método Reinhard — Transferência de Cor no RazaiSystem

> **Nota**: Para processamento de imagens e regras de Storage, consulte [CLAUDE.md](../../../CLAUDE.md) e [CONTEXT.md](../../../CONTEXT.md).

## Visão Geral

O **método Reinhard** é baseado no artigo seminal de Erik Reinhard et al. (2001): *"Color Transfer between Images"*. É uma técnica de transferência de cor que equaliza as estatísticas de luminância e crominância entre uma imagem fonte e uma cor/imagem alvo no espaço de cor **CIELAB**.

No RazaiSystem, este método é utilizado para recolorir imagens de tecidos, transferindo a cor desejada para a imagem base do tecido, preservando a textura e os detalhes de luminância.

---

## Fundamentação Matemática

### Espaço de Cor CIELAB

O método opera no espaço **CIELAB** por ser perceptualmente uniforme:

| Canal | Descrição | Range |
|-------|-----------|-------|
| **L** | Luminância | 0 (preto) a 100 (branco) |
| **a** | Eixo verde-vermelho | ~-128 a +128 |
| **b** | Eixo azul-amarelo | ~-128 a +128 |

### Conversão RGB → CIELAB

```
RGB → XYZ (com gamma correction) → CIELAB (normalizado por D65)
```

#### Pipeline de Conversão

1. **sRGB → Linear RGB**: Remove gamma (γ = 2.4)
2. **Linear RGB → XYZ**: Matriz de transformação D65
3. **XYZ → CIELAB**: Normalização pelo iluminante D65

### Estatísticas da Imagem Fonte

Para cada canal (L, a, b), calculamos:

**Média:**
$$\mu = \frac{1}{N} \sum_{i=1}^{N} x_i$$

**Desvio Padrão:**
$$\sigma = \sqrt{\frac{1}{N} \sum_{i=1}^{N} (x_i - \mu)^2}$$

### Fórmula de Transferência (Reinhard Clássico)

Para cada pixel $(L_s, a_s, b_s)$ da imagem fonte:

$$L' = \frac{\sigma_t}{\sigma_s} (L_s - \mu_s) + \mu_t$$

$$a' = \frac{\sigma_t^a}{\sigma_s^a} (a_s - \mu_s^a) + \mu_t^a$$

$$b' = \frac{\sigma_t^b}{\sigma_s^b} (b_s - \mu_s^b) + \mu_t^b$$

---

## Implementação no RazaiSystem

### Localização do Código

```
frontend/src/hooks/useReinhardTingimento.ts  → hook principal
frontend/src/lib/colorUtils.ts               → utilitários de cor
```

### Pipeline de 3 Etapas

```
┌─────────────────┐      PREPARE        ┌─────────────────┐
│  Imagem Tecido  │ ─────────────────►  │  LAB Data       │
│  (RGB)          │                     │  + Estatísticas │
└─────────────────┘                     │  + Textura HF   │
                                        └────────┬────────┘
                                                 │
                                                 â–¼
┌─────────────────┐     APPLY_COLOR     ┌─────────────────┐
│  Cor Alvo       │ ─────────────────►  │  Imagem Final   │
│  (RGB → LAB)    │                     │  (Recolorida)   │
└─────────────────┘                     └─────────────────┘
```

#### 1. PREPARE_IMAGE

- Converte RGB → LAB pixel a pixel
- Calcula estatísticas (meanL, stdL, meanA, stdA, meanB, stdB)
- Separa frequências via blur gaussiano
- Extrai textura de alta frequência (highFreqLuminance)
- Calcula métricas adaptativas

#### 2. APPLY_COLOR (Reinhard)

- Calcula desvio do pixel à média da fonte
- Aplica fator de escala de contraste
- Transfere para luminância/crominância alvo
- Reaplica textura de alta frequência

#### 3. CONVERT_BACK

- Converte LAB → RGB
- Aplica no canvas
- Retorna dataURL (PNG, resolução original)

---

## Processamento de Imagem

### Resolução e Qualidade

O sistema preserva a resolução original da imagem em todas as etapas:

- **Entrada**: Qualquer resolução (não há limite de pixels)
- **Processamento**: Canvas com dimensões originais
- **Saída**: PNG sem compressão de qualidade

### Formato de Saída

```typescript
// Saída como PNG (sem perda)
canvas.toBlob(callback, 'image/png', 1.0);
```

### Fluxo de Imagem

```
┌─────────────────┐      ┌──────────────┐      ┌─────────────────┐
│ Imagem Original │ ───► │ Processamento│ ───► │ PNG (resolução  │
│ (qualquer res.) │      │ Reinhard     │      │ original)       │
└─────────────────┘      └──────────────┘      └─────────────────┘
                                                       │
                                                       â–¼
                                               ┌─────────────────┐
                                               │ Storage:        │
                                               │ imagemTingida   │
                                               └────────┬────────┘
                                                        │
                                                        â–¼
                                               ┌─────────────────┐
                                               │ generateOverlay │
                                               │ (logo + nome) │
                                               └────────┬────────┘
                                                        │
                                                        â–¼
                                               ┌─────────────────┐
                                               │ Storage:        │
                                               │ imagemGerada  │
                                               └─────────────────┘
```

### Crop Quadrado

Para imagens com marca, o crop é quadrado e centralizado:

```typescript
// Crop mantém resolução original
await cropToSquare(image, {
  maxSize: 99999,  // Sem limite
  quality: 1.0     // Sem perda
});
```

---

## API do Hook

### useReinhardTingimento

```typescript
import { useReinhardTingimento } from '@/hooks/useReinhardTingimento';

const { aplicarTingimento } = useReinhardTingimento();
```

### aplicarTingimento

```typescript
const resultado = await aplicarTingimento(
  imagemBase: string,           // URL ou dataURL da imagem
  corAlvo: { r, g, b },         // Cor RGB alvo (0-255)
  ajustes?: AjustesCor,         // Ajustes opcionais de cor
  config?: ReinhardConfig       // Configurações do algoritmo
);
```

#### Parâmetros

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `imagemBase` | `string` | URL, dataURL ou blob URL da imagem fonte |
| `corAlvo` | `{ r, g, b }` | Cor RGB de destino (valores 0-255) |
| `ajustes` | `AjustesCor` | Ajustes de hue, saturation, brightness, contrast |
| `config` | `ReinhardConfig` | Configurações do algoritmo |

#### Retorno

`Promise<string>` - dataURL da imagem processada (PNG)

---

## Configuração

### ReinhardConfig

```typescript
interface ReinhardConfig {
  saturationMultiplier?: number;  // Multiplica a, b (default: 1.0)
  contrastBoost?: number;         // Boost de contraste L (default: 0)
  detailAmount?: number;          // Intensidade textura HF (default: 1.05)
  luminanceSCurve?: number;       // Força curva S (default: 0.35)
}
```

| Parâmetro | Default | Descrição |
|-----------|---------|-----------|
| `saturationMultiplier` | 1.0 | Multiplica os canais a e b do alvo |
| `contrastBoost` | 0 | Aumenta o contraste da luminância |
| `detailAmount` | 1.05 | Intensidade da textura de alta frequência |
| `luminanceSCurve` | 0.35 | Força da curva S para contraste local |

### AjustesCor

```typescript
interface AjustesCor {
  hue: number;        // -180 a +180 (rotação de matiz)
  saturation: number; // -100 a +100 (ajuste de saturação)
  brightness: number; // -100 a +100 (ajuste de brilho)
  contrast: number;   // -100 a +100 (ajuste de contraste)
}
```

---

## Exemplos de Uso

### Uso Básico

```tsx
import { useReinhardTingimento } from '@/hooks/useReinhardTingimento';
import { hexToRgb } from '@/lib/colorUtils';

function MeuComponente() {
  const { aplicarTingimento } = useReinhardTingimento();

  const aplicarCor = async () => {
    const rgb = hexToRgb('#69373c');
    if (!rgb) return;

    const resultado = await aplicarTingimento(
      'https://exemplo.com/tecido.png',
      rgb
    );

    // resultado é um dataURL da imagem processada
    console.log(resultado);
  };
}
```

### Com Ajustes de Cor

```tsx
const resultado = await aplicarTingimento(
  imagemUrl,
  { r: 105, g: 55, b: 60 },
  {
    hue: 0,
    saturation: 10,    // +10% saturação
    brightness: 0,
    contrast: 5,       // +5% contraste
  }
);
```

### Com Configuração Personalizada

```tsx
const resultado = await aplicarTingimento(
  imagemUrl,
  rgb,
  undefined,  // sem ajustes
  {
    saturationMultiplier: 1.2,  // 20% mais saturação
    contrastBoost: 0.1,         // 10% mais contraste
    detailAmount: 1.1,          // mais textura
  }
);
```

---

## Preservação de Textura

### Separação de Frequências

O método clássico de Reinhard não preserva bem a textura. O RazaiSystem adiciona separação de frequências:

```typescript
// 1. Blur gaussiano para extrair baixa frequência
const blurred = gaussianBlur2D(luminance, width, height, sigma);

// 2. Alta frequência = diferença entre original e blur
const highFreq = luminance - blurred;

// 3. Após transferência, reaplicar textura
finalL += highFreq * detailAmount * shadowFactor;
```

### Fator de Sombra

A textura é atenuada em áreas escuras para evitar artefatos:

```typescript
const shadowFactor = Math.max(0.3, newL / 100);
```

---

## Métricas Adaptativas

O sistema analisa a imagem para ajustes automáticos:

```typescript
interface AdaptiveMetrics {
  textureIntensity: number;    // 0-1: intensidade de textura
  contrastLevel: number;       // 0-1: nível de contraste
  luminanceRange: number;      // range real de L (maxL - minL)
  isDarkImage: boolean;        // meanL < 40
  isLightImage: boolean;       // meanL > 70
  hasStrongTexture: boolean;   // textureStdDev > 4
}
```

### Ajuste Automático para Imagens Claras

Quando a imagem fonte é clara e a cor alvo é escura, o sistema intensifica a cor:

```typescript
if (metrics.isLightImage && targetLab.L < 50) {
  const darkBoost = (50 - targetLab.L) / 50;
  newA *= 1 + darkBoost * 0.3;
  newB *= 1 + darkBoost * 0.3;
}
```

---

## Funções Exportadas

Além do hook, são exportadas funções de conversão:

```typescript
import { rgbToLab, labToRgb } from '@/hooks/useReinhardTingimento';

// RGB → LAB
const lab = rgbToLab(255, 128, 64);
// { L: 65.48, a: 32.21, b: 54.87 }

// LAB → RGB
const rgb = labToRgb(50, 20, -30);
// { r: 112, g: 117, b: 178 }
```

---

## Referências

1. **Reinhard, E., Ashikhmin, M., Gooch, B., & Shirley, P.** (2001). *Color Transfer between Images*. IEEE Computer Graphics and Applications.

2. **Espaço CIELAB**: [CIE 1976 L*a*b* Color Space](https://en.wikipedia.org/wiki/CIELAB_color_space)

3. **Iluminante D65**: [Standard Illuminant D65](https://en.wikipedia.org/wiki/Illuminant_D65)

---

## Troubleshooting

### Imagem muito clara/lavada

Aumente `saturationMultiplier`:

```typescript
{ saturationMultiplier: 1.3 }
```

### Textura perdida

Aumente `detailAmount`:

```typescript
{ detailAmount: 1.2 }
```

### Contraste baixo

Aumente `contrastBoost`:

```typescript
{ contrastBoost: 0.15 }
```

### Erro de CORS

Use blob URL via Firebase SDK:

```typescript
import { ref, getBlob } from 'firebase/storage';

const storageRef = ref(storage, path);
const blob = await getBlob(storageRef);
const blobUrl = URL.createObjectURL(blob);
```

