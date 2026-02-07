import { useCallback } from 'react';
import { LabColor } from '@/types/cor.types';
import { cropCanvasToSquare } from '@/lib/imageCrop';

/**
 * Método Reinhard — Transferência de Cor no espaço CIELAB
 * Baseado em: "Color Transfer between Images" - Erik Reinhard et al. (2001)
 * 
 * Pipeline:
 * 1. PREPARE: Converte RGB → LAB, calcula estatísticas, extrai textura HF
 * 2. TRANSFER: Aplica transferência Reinhard (média + desvio padrão)
 * 3. TEXTURE: Reaplica textura de alta frequência
 * 4. CROP: Faz crop central para formato quadrado (1:1)
 */

// ============================================
// TIPOS
// ============================================

interface ImageStats {
  meanL: number;
  meanA: number;
  meanB: number;
  stdL: number;
  stdA: number;
  stdB: number;
  minL: number;
  maxL: number;
}

interface AdaptiveMetrics {
  textureIntensity: number;    // 0-1: intensidade de textura
  contrastLevel: number;       // 0-1: nível de contraste
  luminanceRange: number;      // range real de L
  isDarkImage: boolean;        // meanL < 40
  isLightImage: boolean;       // meanL > 70
  hasStrongTexture: boolean;   // textureStdDev > 4
}

export interface ReinhardConfig {
  saturationMultiplier?: number;  // Multiplica a, b do alvo (default: 1.0)
  contrastBoost?: number;         // Aumenta contraste de L (default: 0)
  detailAmount?: number;          // Intensidade da textura HF (default: 1.05)
  luminanceSCurve?: number;       // Força da curva S (default: 0.35)
  darkenAmount?: number;          // Escurece a imagem (0-30, default: 0)
  shadowDesaturation?: number;    // Dessatura sombras (0-1, default: 0.5)
  hueShift?: number;              // Rotação de matiz/hue em graus (-180 a 180, default: 0)
}

interface UseReinhardTingimentoReturn {
  aplicarTingimento: (
    imagemBase: string,
    corAlvo: { r: number; g: number; b: number } | LabColor,
    config?: ReinhardConfig
  ) => Promise<string>;
}

// ============================================
// CONSTANTES
// ============================================

const EPS = 1e-6;
const D65_WHITE = { X: 95.047, Y: 100.0, Z: 108.883 }; // Iluminante D65

// ============================================
// CONVERSÕES DE COR - CIELAB
// ============================================

/**
 * Converte sRGB para XYZ (com gamma correction)
 */
function srgbToXyz(r: number, g: number, b: number): { X: number; Y: number; Z: number } {
  // Normaliza para 0-1
  let rn = r / 255;
  let gn = g / 255;
  let bn = b / 255;

  // Remove gamma sRGB (lineariza)
  rn = rn > 0.04045 ? Math.pow((rn + 0.055) / 1.055, 2.4) : rn / 12.92;
  gn = gn > 0.04045 ? Math.pow((gn + 0.055) / 1.055, 2.4) : gn / 12.92;
  bn = bn > 0.04045 ? Math.pow((bn + 0.055) / 1.055, 2.4) : bn / 12.92;

  // Multiplica por 100 para escala padrão
  rn *= 100;
  gn *= 100;
  bn *= 100;

  // Matriz de conversão sRGB → XYZ (D65)
  const X = rn * 0.4124564 + gn * 0.3575761 + bn * 0.1804375;
  const Y = rn * 0.2126729 + gn * 0.7151522 + bn * 0.0721750;
  const Z = rn * 0.0193339 + gn * 0.1191920 + bn * 0.9503041;

  return { X, Y, Z };
}

/**
 * Converte XYZ para sRGB
 */
function xyzToSrgb(X: number, Y: number, Z: number): { r: number; g: number; b: number } {
  // Normaliza de volta
  X /= 100;
  Y /= 100;
  Z /= 100;

  // Matriz inversa XYZ → sRGB (D65)
  let r = X * 3.2404542 + Y * -1.5371385 + Z * -0.4985314;
  let g = X * -0.9692660 + Y * 1.8760108 + Z * 0.0415560;
  let b = X * 0.0556434 + Y * -0.2040259 + Z * 1.0572252;

  // Aplica gamma sRGB
  r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
  b = b > 0.0031308 ? 1.055 * Math.pow(b, 1 / 2.4) - 0.055 : 12.92 * b;

  // Clamp e converte para 0-255
  return {
    r: Math.round(Math.min(255, Math.max(0, r * 255))),
    g: Math.round(Math.min(255, Math.max(0, g * 255))),
    b: Math.round(Math.min(255, Math.max(0, b * 255))),
  };
}

/**
 * Converte XYZ para CIELAB
 */
function xyzToLab(X: number, Y: number, Z: number): { L: number; a: number; b: number } {
  // Normaliza pelo iluminante D65
  let xn = X / D65_WHITE.X;
  let yn = Y / D65_WHITE.Y;
  let zn = Z / D65_WHITE.Z;

  // Função f(t) do CIELAB
  const f = (t: number) => {
    const delta = 6 / 29;
    return t > Math.pow(delta, 3)
      ? Math.pow(t, 1 / 3)
      : t / (3 * delta * delta) + 4 / 29;
  };

  const fx = f(xn);
  const fy = f(yn);
  const fz = f(zn);

  const L = 116 * fy - 16;           // L: 0 a 100
  const a = 500 * (fx - fy);         // a: ~-128 a +128
  const b = 200 * (fy - fz);         // b: ~-128 a +128

  return { L, a, b };
}

/**
 * Converte CIELAB para XYZ
 */
function labToXyz(L: number, a: number, b: number): { X: number; Y: number; Z: number } {
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;

  const delta = 6 / 29;

  const xn = fx > delta ? Math.pow(fx, 3) : (fx - 4 / 29) * 3 * delta * delta;
  const yn = fy > delta ? Math.pow(fy, 3) : (fy - 4 / 29) * 3 * delta * delta;
  const zn = fz > delta ? Math.pow(fz, 3) : (fz - 4 / 29) * 3 * delta * delta;

  return {
    X: xn * D65_WHITE.X,
    Y: yn * D65_WHITE.Y,
    Z: zn * D65_WHITE.Z,
  };
}

/**
 * Converte RGB diretamente para CIELAB
 */
function rgbToLab(r: number, g: number, b: number): { L: number; a: number; b: number } {
  const xyz = srgbToXyz(r, g, b);
  return xyzToLab(xyz.X, xyz.Y, xyz.Z);
}

/**
 * Converte CIELAB diretamente para RGB
 */
function labToRgb(L: number, a: number, b: number): { r: number; g: number; b: number } {
  const xyz = labToXyz(L, a, b);
  return xyzToSrgb(xyz.X, xyz.Y, xyz.Z);
}

// ============================================
// SEPARAÇÃO DE FREQUÊNCIAS (Textura)
// ============================================

/**
 * Blur gaussiano 1D para separar frequências
 */
function gaussianKernel(sigma: number): number[] {
  const size = Math.ceil(sigma * 3) * 2 + 1;
  const kernel: number[] = [];
  const center = Math.floor(size / 2);
  let sum = 0;

  for (let i = 0; i < size; i++) {
    const x = i - center;
    const value = Math.exp(-(x * x) / (2 * sigma * sigma));
    kernel.push(value);
    sum += value;
  }

  // Normaliza
  for (let i = 0; i < size; i++) {
    kernel[i] /= sum;
  }

  return kernel;
}

/**
 * Aplica blur gaussiano 2D separável em um array de luminância
 */
function gaussianBlur2D(
  luminance: Float32Array,
  width: number,
  height: number,
  sigma: number
): Float32Array {
  const kernel = gaussianKernel(sigma);
  const radius = Math.floor(kernel.length / 2);
  const temp = new Float32Array(luminance.length);
  const result = new Float32Array(luminance.length);

  // Passa horizontal
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let weightSum = 0;

      for (let k = -radius; k <= radius; k++) {
        const nx = Math.min(width - 1, Math.max(0, x + k));
        const weight = kernel[k + radius];
        sum += luminance[y * width + nx] * weight;
        weightSum += weight;
      }

      temp[y * width + x] = sum / weightSum;
    }
  }

  // Passa vertical
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let weightSum = 0;

      for (let k = -radius; k <= radius; k++) {
        const ny = Math.min(height - 1, Math.max(0, y + k));
        const weight = kernel[k + radius];
        sum += temp[ny * width + x] * weight;
        weightSum += weight;
      }

      result[y * width + x] = sum / weightSum;
    }
  }

  return result;
}

/**
 * Extrai textura de alta frequência (diferença entre original e blur)
 */
function extractHighFrequency(
  luminance: Float32Array,
  width: number,
  height: number,
  sigma: number = 3
): Float32Array {
  const blurred = gaussianBlur2D(luminance, width, height, sigma);
  const highFreq = new Float32Array(luminance.length);

  for (let i = 0; i < luminance.length; i++) {
    highFreq[i] = luminance[i] - blurred[i];
  }

  return highFreq;
}

// ============================================
// ESTATÍSTICAS E MÉTRICAS
// ============================================

/**
 * Calcula estatísticas LAB de uma imagem
 */
function calculateImageStats(
  labData: Array<{ L: number; a: number; b: number }>
): ImageStats {
  const n = labData.length;
  if (n === 0) {
    return {
      meanL: 50, meanA: 0, meanB: 0,
      stdL: 1, stdA: 1, stdB: 1,
      minL: 0, maxL: 100,
    };
  }

  let sumL = 0, sumA = 0, sumB = 0;
  let minL = Infinity, maxL = -Infinity;

  for (const lab of labData) {
    sumL += lab.L;
    sumA += lab.a;
    sumB += lab.b;
    minL = Math.min(minL, lab.L);
    maxL = Math.max(maxL, lab.L);
  }

  const meanL = sumL / n;
  const meanA = sumA / n;
  const meanB = sumB / n;

  let varL = 0, varA = 0, varB = 0;
  for (const lab of labData) {
    varL += (lab.L - meanL) ** 2;
    varA += (lab.a - meanA) ** 2;
    varB += (lab.b - meanB) ** 2;
  }

  return {
    meanL,
    meanA,
    meanB,
    stdL: Math.sqrt(varL / n) || EPS,
    stdA: Math.sqrt(varA / n) || EPS,
    stdB: Math.sqrt(varB / n) || EPS,
    minL,
    maxL,
  };
}

/**
 * Calcula métricas adaptativas da imagem
 */
function calculateAdaptiveMetrics(
  stats: ImageStats,
  highFreqLuminance: Float32Array
): AdaptiveMetrics {
  // Calcula intensidade de textura
  let textureSum = 0;
  for (let i = 0; i < highFreqLuminance.length; i++) {
    textureSum += Math.abs(highFreqLuminance[i]);
  }
  const textureIntensity = Math.min(1, textureSum / highFreqLuminance.length / 10);

  // Calcula desvio padrão da textura
  let textureVar = 0;
  const textureMean = textureSum / highFreqLuminance.length;
  for (let i = 0; i < highFreqLuminance.length; i++) {
    textureVar += (Math.abs(highFreqLuminance[i]) - textureMean) ** 2;
  }
  const textureStdDev = Math.sqrt(textureVar / highFreqLuminance.length);

  const luminanceRange = stats.maxL - stats.minL;
  const contrastLevel = Math.min(1, luminanceRange / 100);

  return {
    textureIntensity,
    contrastLevel,
    luminanceRange,
    isDarkImage: stats.meanL < 40,
    isLightImage: stats.meanL > 70,
    hasStrongTexture: textureStdDev > 4,
  };
}

// ============================================
// REINHARD COLOR TRANSFER
// ============================================

/**
 * Aplica transferência de cor Reinhard
 * 
 * Fórmula clássica:
 * L' = (σt/σs) * (Ls - μs) + μt
 * a' = (σt_a/σs_a) * (as - μs_a) + μt_a
 * b' = (σt_b/σs_b) * (bs - μs_b) + μt_b
 */
function applyReinhardTransfer(
  labData: Array<{ L: number; a: number; b: number }>,
  sourceStats: ImageStats,
  targetLab: { L: number; a: number; b: number },
  highFreqLuminance: Float32Array,
  metrics: AdaptiveMetrics,
  config: ReinhardConfig
): Array<{ L: number; a: number; b: number }> {
  const {
    saturationMultiplier = 0.85,  // Dessatura levemente por padrão (era 1.4)
    contrastBoost = 0.15,
    detailAmount = 1.15,
    luminanceSCurve = 0,
    darkenAmount = 5,
    shadowDesaturation = 0.6,
    hueShift = 0,  // Rotação de matiz em graus (default: 0)
  } = config;
  
  // Converter graus para radianos para rotação
  const hueShiftRad = hueShift * (Math.PI / 180);

  // Estatísticas do alvo (cor sólida tem std muito baixo)
  // Usamos o std da fonte para preservar a textura
  const targetStdL = Math.max(sourceStats.stdL * 0.8, 5); // Preserva variação
  const targetStdA = Math.max(sourceStats.stdA * 0.3, 0.1);
  const targetStdB = Math.max(sourceStats.stdB * 0.3, 0.1);

  const result: Array<{ L: number; a: number; b: number }> = [];

  // Fator de contraste
  const contrastScale = 1.0 + contrastBoost;

  for (let i = 0; i < labData.length; i++) {
    const lab = labData[i];

    // ===============================
    // 1. Transferência de Luminância
    // ===============================
    // Desvio do pixel à média da fonte
    const deviationFromMean = lab.L - sourceStats.meanL;

    // Transferência Reinhard para L
    let newL = targetLab.L + (deviationFromMean * (targetStdL / sourceStats.stdL)) * contrastScale;

    // Aplica curva S para contraste local (suave)
    if (luminanceSCurve > 0) {
      const t = (newL - targetLab.L) / 50; // Normaliza
      const sCurve = t / (1 + Math.abs(t) * luminanceSCurve);
      newL = targetLab.L + sCurve * 50;
    }

    // Reaplica textura de alta frequência
    const shadowFactor = Math.max(0.3, newL / 100); // Menos textura em áreas escuras
    newL += highFreqLuminance[i] * detailAmount * shadowFactor;

    // Aplica escurecimento
    newL -= darkenAmount;

    // ===============================
    // 2. Transferência de Crominância
    // ===============================
    // Transferência Reinhard para a e b
    let newA = targetLab.a + (lab.a - sourceStats.meanA) * (targetStdA / sourceStats.stdA);
    let newB = targetLab.b + (lab.b - sourceStats.meanB) * (targetStdB / sourceStats.stdB);

    // Aplica multiplicador de saturação
    newA *= saturationMultiplier;
    newB *= saturationMultiplier;

    // Aplica rotação de matiz/hue (rotação no plano a-b do espaço LAB)
    if (hueShiftRad !== 0) {
      const cosAngle = Math.cos(hueShiftRad);
      const sinAngle = Math.sin(hueShiftRad);
      const aRotated = newA * cosAngle - newB * sinAngle;
      const bRotated = newA * sinAngle + newB * cosAngle;
      newA = aRotated;
      newB = bRotated;
    }

    // ===============================
    // 3. Ajustes adaptativos
    // ===============================
    // Se imagem original era clara e alvo é escuro, intensifica a cor
    if (metrics.isLightImage && targetLab.L < 50) {
      const darkBoost = (50 - targetLab.L) / 50;
      newA *= 1 + darkBoost * 0.3;
      newB *= 1 + darkBoost * 0.3;
    }

    // Clamp L para range válido
    newL = Math.max(0, Math.min(100, newL));

    // Dessatura sombras - quanto mais escuro, menos saturação
    if (shadowDesaturation > 0 && newL < 50) {
      // Fator de 0 (L=50) a 1 (L=0)
      const shadowIntensity = (50 - newL) / 50;
      const desatFactor = 1 - (shadowIntensity * shadowDesaturation);
      newA *= desatFactor;
      newB *= desatFactor;
    }

    result.push({ L: newL, a: newA, b: newB });
  }

  return result;
}

// ============================================
// HOOK PRINCIPAL
// ============================================

export function useReinhardTingimento(): UseReinhardTingimentoReturn {
  const aplicarTingimento = useCallback(
    async (
      imagemBase: string,
      corAlvo: { r: number; g: number; b: number } | LabColor,
      config: ReinhardConfig = {}
    ): Promise<string> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        if (!imagemBase.startsWith('blob:')) {
          img.crossOrigin = 'anonymous';
        }

        img.onload = () => {
          try {
            // ===============================
            // 1. PREPARE_IMAGE
            // ===============================
            const canvas = document.createElement('canvas');
            const maxSize = 800;
            const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext('2d');

            if (!ctx) {
              reject(new Error('Não foi possível criar contexto do canvas'));
              return;
            }

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // Detectar se corAlvo é LAB ou RGB
            const isLab = 'L' in corAlvo && 'a' in corAlvo && 'b' in corAlvo;
            
            // Converter para LAB se necessário (sem ajustes intermediários)
            const targetLab: { L: number; a: number; b: number } = isLab
              ? (corAlvo as LabColor) // Já está em LAB - usar diretamente
              : rgbToLab((corAlvo as { r: number; g: number; b: number }).r, 
                         (corAlvo as { r: number; g: number; b: number }).g, 
                         (corAlvo as { r: number; g: number; b: number }).b); // Converter RGB → LAB

            // Converte todos os pixels para LAB e extrai luminância
            const labData: Array<{ L: number; a: number; b: number }> = [];
            const luminanceArray = new Float32Array(canvas.width * canvas.height);
            const pixelIndices: number[] = [];

            for (let i = 0, j = 0; i < data.length; i += 4, j++) {
              const alpha = data[i + 3];
              if (alpha === 0) {
                luminanceArray[j] = 50; // Valor neutro para pixels transparentes
                continue;
              }

              const lab = rgbToLab(data[i], data[i + 1], data[i + 2]);
              labData.push(lab);
              luminanceArray[j] = lab.L;
              pixelIndices.push(i);
            }

            if (labData.length === 0) {
              resolve(canvas.toDataURL('image/png'));
              return;
            }

            // Calcula estatísticas da fonte
            const sourceStats = calculateImageStats(labData);

            // Extrai textura de alta frequência
            const highFreqLuminance = extractHighFrequency(
              luminanceArray,
              canvas.width,
              canvas.height,
              3 // sigma do blur
            );

            // Mapeia high freq para apenas os pixels não-transparentes
            const highFreqForPixels = new Float32Array(labData.length);
            for (let i = 0; i < pixelIndices.length; i++) {
              const pixelIdx = pixelIndices[i] / 4;
              highFreqForPixels[i] = highFreqLuminance[pixelIdx];
            }

            // Calcula métricas adaptativas
            const metrics = calculateAdaptiveMetrics(sourceStats, highFreqForPixels);

            // ===============================
            // 2. APPLY_COLOR (Reinhard)
            // ===============================
            // targetLab já foi calculado acima (diretamente em LAB ou convertido de RGB)

            const resultLab = applyReinhardTransfer(
              labData,
              sourceStats,
              targetLab,
              highFreqForPixels,
              metrics,
              config
            );

            // ===============================
            // 3. Converte de volta para RGB
            // ===============================
            for (let i = 0; i < resultLab.length; i++) {
              const lab = resultLab[i];
              const rgb = labToRgb(lab.L, lab.a, lab.b);
              const pixelIdx = pixelIndices[i];

              data[pixelIdx] = rgb.r;
              data[pixelIdx + 1] = rgb.g;
              data[pixelIdx + 2] = rgb.b;
            }

            ctx.putImageData(imageData, 0, 0);
            
            // ===============================
            // 4. Crop para formato quadrado (1:1)
            // ===============================
            const squareCanvas = cropCanvasToSquare(canvas);
            const dataURL = squareCanvas.toDataURL('image/png');
            resolve(dataURL);

          } catch (error) {
            reject(error);
          }
        };

        img.onerror = () => {
          reject(new Error('Erro ao carregar imagem'));
        };

        img.src = imagemBase;
      });
    },
    []
  );

  return { aplicarTingimento };
}

// Export das funções de conversão para uso externo
export { rgbToLab, labToRgb };
