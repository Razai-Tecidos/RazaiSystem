import { ImageStats } from '@/types/ml.types';

/**
 * Calcula estatísticas de uma imagem a partir de sua URL
 * Converte para LAB e calcula métricas de luminância e contraste
 */
export async function calculateImageStats(imageUrl: string): Promise<ImageStats> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
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
        
        // Converter pixels RGB para LAB e calcular estatísticas
        const luminanceValues: number[] = [];
        
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha === 0) continue; // Pular pixels transparentes
          
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Converter RGB para LAB
          const lab = rgbToLab(r, g, b);
          luminanceValues.push(lab.L);
        }
        
        if (luminanceValues.length === 0) {
          reject(new Error('Imagem não contém pixels válidos'));
          return;
        }
        
        // Calcular estatísticas
        const meanLuminance = luminanceValues.reduce((a, b) => a + b, 0) / luminanceValues.length;
        const variance = luminanceValues.reduce((sum, val) => sum + Math.pow(val - meanLuminance, 2), 0) / luminanceValues.length;
        const stdLuminance = Math.sqrt(variance);
        
        // Calcular contraste médio (diferença entre pixels adjacentes)
        const contrastValues: number[] = [];
        const width = canvas.width;
        const height = canvas.height;
        
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            if (data[idx + 3] === 0) continue;
            
            const lab1 = rgbToLab(data[idx], data[idx + 1], data[idx + 2]);
            
            // Comparar com pixel à direita
            if (x < width - 1) {
              const idx2 = (y * width + (x + 1)) * 4;
              if (data[idx2 + 3] !== 0) {
                const lab2 = rgbToLab(data[idx2], data[idx2 + 1], data[idx2 + 2]);
                const contrast = Math.abs(lab1.L - lab2.L);
                contrastValues.push(contrast);
              }
            }
            
            // Comparar com pixel abaixo
            if (y < height - 1) {
              const idx3 = ((y + 1) * width + x) * 4;
              if (data[idx3 + 3] !== 0) {
                const lab3 = rgbToLab(data[idx3], data[idx3 + 1], data[idx3 + 2]);
                const contrast = Math.abs(lab1.L - lab3.L);
                contrastValues.push(contrast);
              }
            }
          }
        }
        
        const meanContrast = contrastValues.length > 0
          ? contrastValues.reduce((a, b) => a + b, 0) / contrastValues.length
          : 0;
        
        // Usar reduce para evitar stack overflow com arrays grandes
        const minLuminance = luminanceValues.reduce((min, val) => val < min ? val : min, luminanceValues[0] || 0);
        const maxLuminance = luminanceValues.reduce((max, val) => val > max ? val : max, luminanceValues[0] || 0);
        
        resolve({
          meanLuminance,
          stdLuminance,
          meanContrast,
          minLuminance,
          maxLuminance,
        });
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Erro ao carregar imagem'));
    };
    
    img.src = imageUrl;
  });
}

/**
 * Converte RGB para LAB (função auxiliar)
 */
function rgbToLab(r: number, g: number, b: number): { L: number; a: number; b: number } {
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
