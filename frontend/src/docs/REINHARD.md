# MÃ©todo Reinhard â€” TransferÃªncia de Cor no RazaiSystem

> **Nota**: Para processamento de imagens e regras de Storage, consulte [CLAUDE.md](../../../CLAUDE.md) e [CONTEXT.md](../../../CONTEXT.md).

## VisÃ£o Geral

O **mÃ©todo Reinhard** Ã© baseado no artigo seminal de Erik Reinhard et al. (2001): *"Color Transfer between Images"*. Ã‰ uma tÃ©cnica de transferÃªncia de cor que equaliza as estatÃ­sticas de luminÃ¢ncia e crominÃ¢ncia entre uma imagem fonte e uma cor/imagem alvo no espaÃ§o de cor **CIELAB**.

No RazaiSystem, este mÃ©todo Ã© utilizado para recolorir imagens de tecidos, transferindo a cor desejada para a imagem base do tecido, preservando a textura e os detalhes de luminÃ¢ncia.

---

## FundamentaÃ§Ã£o MatemÃ¡tica

### EspaÃ§o de Cor CIELAB

O mÃ©todo opera no espaÃ§o **CIELAB** por ser perceptualmente uniforme:

| Canal | DescriÃ§Ã£o | Range |
|-------|-----------|-------|
| **L** | LuminÃ¢ncia | 0 (preto) a 100 (branco) |
| **a** | Eixo verde-vermelho | ~-128 a +128 |
| **b** | Eixo azul-amarelo | ~-128 a +128 |

### ConversÃ£o RGB â†’ CIELAB

```
RGB â†’ XYZ (com gamma correction) â†’ CIELAB (normalizado por D65)
```

#### Pipeline de ConversÃ£o

1. **sRGB â†’ Linear RGB**: Remove gamma (Î³ = 2.4)
2. **Linear RGB â†’ XYZ**: Matriz de transformaÃ§Ã£o D65
3. **XYZ â†’ CIELAB**: NormalizaÃ§Ã£o pelo iluminante D65

### EstatÃ­sticas da Imagem Fonte

Para cada canal (L, a, b), calculamos:

**MÃ©dia:**
$$\mu = \frac{1}{N} \sum_{i=1}^{N} x_i$$

**Desvio PadrÃ£o:**
$$\sigma = \sqrt{\frac{1}{N} \sum_{i=1}^{N} (x_i - \mu)^2}$$

### FÃ³rmula de TransferÃªncia (Reinhard ClÃ¡ssico)

Para cada pixel $(L_s, a_s, b_s)$ da imagem fonte:

$$L' = \frac{\sigma_t}{\sigma_s} (L_s - \mu_s) + \mu_t$$

$$a' = \frac{\sigma_t^a}{\sigma_s^a} (a_s - \mu_s^a) + \mu_t^a$$

$$b' = \frac{\sigma_t^b}{\sigma_s^b} (b_s - \mu_s^b) + \mu_t^b$$

---

## ImplementaÃ§Ã£o no RazaiSystem

### LocalizaÃ§Ã£o do CÃ³digo

```
frontend/src/hooks/useReinhardTingimento.ts  â†’ hook principal
frontend/src/lib/colorUtils.ts               â†’ utilitÃ¡rios de cor
```

### Pipeline de 3 Etapas

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”      PREPARE        â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Imagem Tecido  â”‚ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–º  â”‚  LAB Data       â”‚
â”‚  (RGB)          â”‚                     â”‚  + EstatÃ­sticas â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                     â”‚  + Textura HF   â”‚
                                        â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                                 â”‚
                                                 â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”     APPLY_COLOR     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Cor Alvo       â”‚ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–º  â”‚  Imagem Final   â”‚
â”‚  (RGB â†’ LAB)    â”‚                     â”‚  (Recolorida)   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                     â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

#### 1. PREPARE_IMAGE

- Converte RGB â†’ LAB pixel a pixel
- Calcula estatÃ­sticas (meanL, stdL, meanA, stdA, meanB, stdB)
- Separa frequÃªncias via blur gaussiano
- Extrai textura de alta frequÃªncia (highFreqLuminance)
- Calcula mÃ©tricas adaptativas

#### 2. APPLY_COLOR (Reinhard)

- Calcula desvio do pixel Ã  mÃ©dia da fonte
- Aplica fator de escala de contraste
- Transfere para luminÃ¢ncia/crominÃ¢ncia alvo
- Reaplica textura de alta frequÃªncia

#### 3. CONVERT_BACK

- Converte LAB â†’ RGB
- Aplica no canvas
- Retorna dataURL (PNG, resoluÃ§Ã£o original)

---

## Processamento de Imagem

### ResoluÃ§Ã£o e Qualidade

O sistema preserva a resoluÃ§Ã£o original da imagem em todas as etapas:

- **Entrada**: Qualquer resoluÃ§Ã£o (nÃ£o hÃ¡ limite de pixels)
- **Processamento**: Canvas com dimensÃµes originais
- **SaÃ­da**: PNG sem compressÃ£o de qualidade

### Formato de SaÃ­da

```typescript
// SaÃ­da como PNG (sem perda)
canvas.toBlob(callback, 'image/png', 1.0);
```

### Fluxo de Imagem

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”      â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”      â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Imagem Original â”‚ â”€â”€â”€â–º â”‚ Processamentoâ”‚ â”€â”€â”€â–º â”‚ PNG (resoluÃ§Ã£o  â”‚
â”‚ (qualquer res.) â”‚      â”‚ Reinhard     â”‚      â”‚ original)       â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜      â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜      â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                                       â”‚
                                                       â–¼
                                               â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                                               â”‚ Storage:        â”‚
                                               â”‚ imagemTingida   â”‚
                                               â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                                        â”‚
                                                        â–¼
                                               â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                                               â”‚ generateOverlay â”‚
                                               â”‚ (logo + nome) â”‚
                                               â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                                        â”‚
                                                        â–¼
                                               â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                                               â”‚ Storage:        â”‚
                                               â”‚ imagemGerada  â”‚
                                               â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Crop Quadrado

Para imagens com marca, o crop Ã© quadrado e centralizado:

```typescript
// Crop mantÃ©m resoluÃ§Ã£o original
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
  config?: ReinhardConfig       // ConfiguraÃ§Ãµes do algoritmo
);
```

#### ParÃ¢metros

| ParÃ¢metro | Tipo | DescriÃ§Ã£o |
|-----------|------|-----------|
| `imagemBase` | `string` | URL, dataURL ou blob URL da imagem fonte |
| `corAlvo` | `{ r, g, b }` | Cor RGB de destino (valores 0-255) |
| `ajustes` | `AjustesCor` | Ajustes de hue, saturation, brightness, contrast |
| `config` | `ReinhardConfig` | ConfiguraÃ§Ãµes do algoritmo |

#### Retorno

`Promise<string>` - dataURL da imagem processada (PNG)

---

## ConfiguraÃ§Ã£o

### ReinhardConfig

```typescript
interface ReinhardConfig {
  saturationMultiplier?: number;  // Multiplica a, b (default: 1.0)
  contrastBoost?: number;         // Boost de contraste L (default: 0)
  detailAmount?: number;          // Intensidade textura HF (default: 1.05)
  luminanceSCurve?: number;       // ForÃ§a curva S (default: 0.35)
}
```

| ParÃ¢metro | Default | DescriÃ§Ã£o |
|-----------|---------|-----------|
| `saturationMultiplier` | 1.0 | Multiplica os canais a e b do alvo |
| `contrastBoost` | 0 | Aumenta o contraste da luminÃ¢ncia |
| `detailAmount` | 1.05 | Intensidade da textura de alta frequÃªncia |
| `luminanceSCurve` | 0.35 | ForÃ§a da curva S para contraste local |

### AjustesCor

```typescript
interface AjustesCor {
  hue: number;        // -180 a +180 (rotaÃ§Ã£o de matiz)
  saturation: number; // -100 a +100 (ajuste de saturaÃ§Ã£o)
  brightness: number; // -100 a +100 (ajuste de brilho)
  contrast: number;   // -100 a +100 (ajuste de contraste)
}
```

---

## Exemplos de Uso

### Uso BÃ¡sico

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

    // resultado Ã© um dataURL da imagem processada
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
    saturation: 10,    // +10% saturaÃ§Ã£o
    brightness: 0,
    contrast: 5,       // +5% contraste
  }
);
```

### Com ConfiguraÃ§Ã£o Personalizada

```tsx
const resultado = await aplicarTingimento(
  imagemUrl,
  rgb,
  undefined,  // sem ajustes
  {
    saturationMultiplier: 1.2,  // 20% mais saturaÃ§Ã£o
    contrastBoost: 0.1,         // 10% mais contraste
    detailAmount: 1.1,          // mais textura
  }
);
```

---

## PreservaÃ§Ã£o de Textura

### SeparaÃ§Ã£o de FrequÃªncias

O mÃ©todo clÃ¡ssico de Reinhard nÃ£o preserva bem a textura. O RazaiSystem adiciona separaÃ§Ã£o de frequÃªncias:

```typescript
// 1. Blur gaussiano para extrair baixa frequÃªncia
const blurred = gaussianBlur2D(luminance, width, height, sigma);

// 2. Alta frequÃªncia = diferenÃ§a entre original e blur
const highFreq = luminance - blurred;

// 3. ApÃ³s transferÃªncia, reaplicar textura
finalL += highFreq * detailAmount * shadowFactor;
```

### Fator de Sombra

A textura Ã© atenuada em Ã¡reas escuras para evitar artefatos:

```typescript
const shadowFactor = Math.max(0.3, newL / 100);
```

---

## MÃ©tricas Adaptativas

O sistema analisa a imagem para ajustes automÃ¡ticos:

```typescript
interface AdaptiveMetrics {
  textureIntensity: number;    // 0-1: intensidade de textura
  contrastLevel: number;       // 0-1: nÃ­vel de contraste
  luminanceRange: number;      // range real de L (maxL - minL)
  isDarkImage: boolean;        // meanL < 40
  isLightImage: boolean;       // meanL > 70
  hasStrongTexture: boolean;   // textureStdDev > 4
}
```

### Ajuste AutomÃ¡tico para Imagens Claras

Quando a imagem fonte Ã© clara e a cor alvo Ã© escura, o sistema intensifica a cor:

```typescript
if (metrics.isLightImage && targetLab.L < 50) {
  const darkBoost = (50 - targetLab.L) / 50;
  newA *= 1 + darkBoost * 0.3;
  newB *= 1 + darkBoost * 0.3;
}
```

---

## FunÃ§Ãµes Exportadas

AlÃ©m do hook, sÃ£o exportadas funÃ§Ãµes de conversÃ£o:

```typescript
import { rgbToLab, labToRgb } from '@/hooks/useReinhardTingimento';

// RGB â†’ LAB
const lab = rgbToLab(255, 128, 64);
// { L: 65.48, a: 32.21, b: 54.87 }

// LAB â†’ RGB
const rgb = labToRgb(50, 20, -30);
// { r: 112, g: 117, b: 178 }
```

---

## ReferÃªncias

1. **Reinhard, E., Ashikhmin, M., Gooch, B., & Shirley, P.** (2001). *Color Transfer between Images*. IEEE Computer Graphics and Applications.

2. **EspaÃ§o CIELAB**: [CIE 1976 L*a*b* Color Space](https://en.wikipedia.org/wiki/CIELAB_color_space)

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

