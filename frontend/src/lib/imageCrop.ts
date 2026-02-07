/**
 * Utilitários para crop e redimensionamento de imagens
 */

/**
 * Carrega uma imagem a partir de uma URL ou data URL
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('blob:') && !src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Falha ao carregar imagem: ${src}`));
    img.src = src;
  });
}

export interface CropOptions {
  /** Tamanho máximo da imagem de saída (default: 4096 para não limitar) */
  maxSize?: number;
  /** Qualidade da imagem (0-1, default: 1.0 para máxima qualidade) */
  quality?: number;
  /** Formato de saída (default: 'image/png') */
  format?: 'image/png' | 'image/jpeg' | 'image/webp';
}

/**
 * Faz crop central de uma imagem para proporção 1:1 (quadrada)
 * 
 * @param imageSrc - URL ou data URL da imagem
 * @param options - Opções de processamento
 * @returns Data URL da imagem quadrada
 */
export async function cropToSquare(
  imageSrc: string,
  options: CropOptions = {}
): Promise<string> {
  const {
    maxSize = 4096,
    quality = 1.0,
    format = 'image/png'
  } = options;

  const img = await loadImage(imageSrc);
  
  // Calcular dimensões do crop central
  const srcSize = Math.min(img.width, img.height);
  const srcX = (img.width - srcSize) / 2;
  const srcY = (img.height - srcSize) / 2;
  
  // Tamanho final (não exceder maxSize nem o srcSize original)
  const outputSize = Math.min(srcSize, maxSize);
  
  // Criar canvas quadrado
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Não foi possível criar contexto do canvas');
  }
  
  // Desenhar crop central
  ctx.drawImage(
    img,
    srcX, srcY, srcSize, srcSize, // Source (crop central)
    0, 0, outputSize, outputSize   // Destination (canvas inteiro)
  );
  
  return canvas.toDataURL(format, quality);
}

/**
 * Faz crop central de um canvas para proporção 1:1 (quadrada)
 * Retorna um novo canvas com a imagem quadrada
 * 
 * @param sourceCanvas - Canvas fonte
 * @param outputSize - Tamanho de saída desejado (opcional, usa o menor lado se não informado)
 * @returns Novo canvas quadrado
 */
export function cropCanvasToSquare(
  sourceCanvas: HTMLCanvasElement,
  outputSize?: number
): HTMLCanvasElement {
  const srcSize = Math.min(sourceCanvas.width, sourceCanvas.height);
  const srcX = (sourceCanvas.width - srcSize) / 2;
  const srcY = (sourceCanvas.height - srcSize) / 2;
  
  const finalSize = outputSize ?? srcSize;
  
  const newCanvas = document.createElement('canvas');
  newCanvas.width = finalSize;
  newCanvas.height = finalSize;
  const ctx = newCanvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Não foi possível criar contexto do canvas');
  }
  
  ctx.drawImage(
    sourceCanvas,
    srcX, srcY, srcSize, srcSize,
    0, 0, finalSize, finalSize
  );
  
  return newCanvas;
}

/**
 * Expande uma imagem quadrada para proporção 3:4 usando fill/stretch
 * Mantém a imagem centralizada e preenche as laterais com a cor média das bordas
 * 
 * @param squareImageSrc - URL ou data URL da imagem quadrada
 * @param options - Opções de processamento
 * @returns Data URL da imagem em proporção 3:4
 */
export async function expandTo3x4(
  squareImageSrc: string,
  options: CropOptions = {}
): Promise<string> {
  const {
    maxSize = 4096,
    quality = 1.0,
    format = 'image/png'
  } = options;

  const img = await loadImage(squareImageSrc);
  
  // Verificar se é quadrada
  if (img.width !== img.height) {
    console.warn('Imagem não é quadrada, fazendo crop primeiro');
  }
  
  const srcSize = Math.min(img.width, img.height);
  
  // Proporção 3:4 - largura:altura
  // Se a altura é srcSize, largura será srcSize * 3/4
  const outputWidth = Math.min(maxSize, Math.round(srcSize * 3 / 4));
  const outputHeight = Math.min(maxSize, srcSize);
  
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Não foi possível criar contexto do canvas');
  }
  
  // Calcular amostragem de cor das bordas para fill
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = img.width;
  sampleCanvas.height = img.height;
  const sampleCtx = sampleCanvas.getContext('2d');
  
  if (sampleCtx) {
    sampleCtx.drawImage(img, 0, 0);
    
    // Pegar cor média das bordas laterais
    const leftPixels = sampleCtx.getImageData(0, 0, 10, img.height);
    const rightPixels = sampleCtx.getImageData(img.width - 10, 0, 10, img.height);
    
    let r = 0, g = 0, b = 0, count = 0;
    
    for (let i = 0; i < leftPixels.data.length; i += 4) {
      r += leftPixels.data[i];
      g += leftPixels.data[i + 1];
      b += leftPixels.data[i + 2];
      count++;
    }
    for (let i = 0; i < rightPixels.data.length; i += 4) {
      r += rightPixels.data[i];
      g += rightPixels.data[i + 1];
      b += rightPixels.data[i + 2];
      count++;
    }
    
    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);
    
    // Preencher com a cor média
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(0, 0, outputWidth, outputHeight);
  }
  
  // Desenhar imagem centralizada (crop central das laterais)
  const srcCropX = (img.width - img.height * 3 / 4) / 2;
  ctx.drawImage(
    img,
    srcCropX, 0, img.height * 3 / 4, img.height,
    0, 0, outputWidth, outputHeight
  );
  
  return canvas.toDataURL(format, quality);
}

/**
 * Verifica se uma imagem é quadrada (com tolerância)
 */
export async function isSquareImage(imageSrc: string, tolerance: number = 0.02): Promise<boolean> {
  const img = await loadImage(imageSrc);
  const ratio = img.width / img.height;
  return Math.abs(ratio - 1) <= tolerance;
}
