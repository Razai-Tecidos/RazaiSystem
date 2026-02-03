/**
 * Utilitários para conversão de cores
 * Conversão LAB → RGB → Hex usando fórmulas CIE padrão
 */

/**
 * Converte valores LAB para RGB
 * @param lab Objeto com valores L, a, b
 * @returns Objeto RGB com valores entre 0-255
 */
export function labToRgb(lab: { L: number; a: number; b: number }): {
  r: number;
  g: number;
  b: number;
} {
  const { L, a, b } = lab;

  // Iluminante D65 (padrão)
  const Xn = 95.047;
  const Yn = 100.0;
  const Zn = 108.883;

  // Converter LAB para XYZ
  let y = (L + 16) / 116;
  let x = a / 500 + y;
  let z = y - b / 200;

  const x3 = x * x * x;
  const y3 = y * y * y;
  const z3 = z * z * z;

  x = x3 > 0.008856 ? x3 : (x - 16 / 116) / 7.787;
  y = y3 > 0.008856 ? y3 : (y - 16 / 116) / 7.787;
  z = z3 > 0.008856 ? z3 : (z - 16 / 116) / 7.787;

  x = x * Xn / 100;
  y = y * Yn / 100;
  z = z * Zn / 100;

  // Converter XYZ para RGB (sRGB)
  let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
  let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
  let blue = x * 0.0557 + y * -0.204 + z * 1.057;

  // Aplicar correção gamma
  r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
  blue = blue > 0.0031308 ? 1.055 * Math.pow(blue, 1 / 2.4) - 0.055 : 12.92 * blue;

  // Clampar valores entre 0-255 e arredondar
  r = Math.max(0, Math.min(255, Math.round(r * 255)));
  g = Math.max(0, Math.min(255, Math.round(g * 255)));
  blue = Math.max(0, Math.min(255, Math.round(blue * 255)));

  return { r, g, b: blue };
}

/**
 * Converte valores RGB para hexadecimal
 * @param rgb Objeto com valores r, g, b (0-255)
 * @returns String hexadecimal no formato #RRGGBB
 */
export function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  const { r, g, b } = rgb;
  const toHex = (n: number) => {
    const hex = Math.round(n).toString(16).padStart(2, '0');
    return hex.toUpperCase();
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Converte valores LAB diretamente para hexadecimal
 * @param lab Objeto com valores L, a, b
 * @returns String hexadecimal no formato #RRGGBB
 */
export function labToHex(lab: { L: number; a: number; b: number }): string {
  const rgb = labToRgb(lab);
  return rgbToHex(rgb);
}

/**
 * Converte código hexadecimal para RGB
 * @param hex String hexadecimal no formato #RRGGBB
 * @returns Objeto RGB com valores entre 0-255 ou null se inválido
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!hex || !hex.startsWith('#')) {
    return null;
  }

  const hexClean = hex.replace('#', '');
  if (hexClean.length !== 6) {
    return null;
  }

  const r = parseInt(hexClean.substring(0, 2), 16);
  const g = parseInt(hexClean.substring(2, 4), 16);
  const b = parseInt(hexClean.substring(4, 6), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return null;
  }

  return { r, g, b };
}

/**
 * Converte valores RGB para LAB
 * @param rgb Objeto com valores r, g, b (0-255)
 * @returns Objeto LAB com valores L (0-100), a e b (-128 a 127)
 */
export function rgbToLab(rgb: { r: number; g: number; b: number }): {
  L: number;
  a: number;
  b: number;
} {
  const { r, g, b } = rgb;

  // Normalizar RGB para 0-1
  let rNorm = r / 255;
  let gNorm = g / 255;
  let bNorm = b / 255;

  // Aplicar correção gamma inversa (sRGB)
  rNorm = rNorm > 0.04045 ? Math.pow((rNorm + 0.055) / 1.055, 2.4) : rNorm / 12.92;
  gNorm = gNorm > 0.04045 ? Math.pow((gNorm + 0.055) / 1.055, 2.4) : gNorm / 12.92;
  bNorm = bNorm > 0.04045 ? Math.pow((bNorm + 0.055) / 1.055, 2.4) : bNorm / 12.92;

  // Converter RGB para XYZ (sRGB)
  let x = rNorm * 0.4124564 + gNorm * 0.3575761 + bNorm * 0.1804375;
  let y = rNorm * 0.2126729 + gNorm * 0.7151522 + bNorm * 0.072175;
  let z = rNorm * 0.0193339 + gNorm * 0.119192 + bNorm * 0.9503041;

  // Iluminante D65 (padrão)
  const Xn = 95.047 / 100;
  const Yn = 100.0 / 100;
  const Zn = 108.883 / 100;

  // Normalizar por iluminante
  x = x / Xn;
  y = y / Yn;
  z = z / Zn;

  // Converter XYZ para LAB
  const fx = x > 0.008856 ? Math.pow(x, 1 / 3) : (7.787 * x + 16 / 116);
  const fy = y > 0.008856 ? Math.pow(y, 1 / 3) : (7.787 * y + 16 / 116);
  const fz = z > 0.008856 ? Math.pow(z, 1 / 3) : (7.787 * z + 16 / 116);

  const L = 116 * fy - 16;
  const aLab = 500 * (fx - fy);
  const bLab = 200 * (fy - fz);

  return {
    L: Math.max(0, Math.min(100, L)),
    a: Math.max(-128, Math.min(127, aLab)),
    b: Math.max(-128, Math.min(127, bLab)),
  };
}

/**
 * Aplica ajustes de cor e converte LAB para RGB
 * Primeiro converte LAB → RGB, depois aplica ajustes (hue, saturation, brightness, contrast)
 * 
 * @param lab Valores LAB originais
 * @param ajustes Ajustes de cor a aplicar (opcional)
 * @returns RGB com ajustes aplicados
 */
export function aplicarAjustesERGB(
  lab: { L: number; a: number; b: number },
  ajustes?: { hue: number; saturation: number; brightness: number; contrast: number }
): { r: number; g: number; b: number } {
  // Primeiro converter LAB para RGB
  let rgb = labToRgb(lab);

  // Se não há ajustes, retornar RGB direto
  if (!ajustes || (
    ajustes.hue === 0 &&
    ajustes.saturation === 0 &&
    ajustes.brightness === 0 &&
    ajustes.contrast === 0
  )) {
    return rgb;
  }

  // Aplicar ajustes usando a mesma lógica do hook useReinhartTingimento
  // Converter RGB para HSL para ajustar hue e saturation
  let hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // Aplicar ajuste de hue (-180 a 180 graus)
  hsl.h = (hsl.h + ajustes.hue) % 360;
  if (hsl.h < 0) hsl.h += 360;

  // Aplicar ajuste de saturation (-100 a 100%)
  hsl.s = Math.max(0, Math.min(100, hsl.s + ajustes.saturation));

  // Converter de volta para RGB
  rgb = hslToRgb(hsl.h, hsl.s, hsl.l);

  // Aplicar ajuste de brightness (-100 a 100%)
  const brightnessFactor = 1 + ajustes.brightness / 100;
  rgb.r = Math.max(0, Math.min(255, rgb.r * brightnessFactor));
  rgb.g = Math.max(0, Math.min(255, rgb.g * brightnessFactor));
  rgb.b = Math.max(0, Math.min(255, rgb.b * brightnessFactor));

  // Aplicar ajuste de contrast (-100 a 100%)
  const contrastFactor = (100 + ajustes.contrast) / 100;
  const midpoint = 128;
  rgb.r = Math.max(0, Math.min(255, midpoint + (rgb.r - midpoint) * contrastFactor));
  rgb.g = Math.max(0, Math.min(255, midpoint + (rgb.g - midpoint) * contrastFactor));
  rgb.b = Math.max(0, Math.min(255, midpoint + (rgb.b - midpoint) * contrastFactor));

  return {
    r: Math.round(rgb.r),
    g: Math.round(rgb.g),
    b: Math.round(rgb.b),
  };
}

/**
 * Converte RGB para HSL
 */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: h * 360,
    s: s * 100,
    l: l * 100,
  };
}

/**
 * Converte HSL para RGB
 */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}
