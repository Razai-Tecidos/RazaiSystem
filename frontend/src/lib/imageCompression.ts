/**
 * Utilitário para processamento de imagens
 * Usa PNG por padrão (máxima qualidade, sem perda)
 * NÃO faz compressão ou redução de resolução
 */

interface ProcessOptions {
  maxDimension?: number;
}

/**
 * Processa uma imagem para PNG sem compressão
 * Mantém resolução e qualidade originais
 */
export async function compressToMaxSize(
  source: HTMLCanvasElement | Blob | string,
  options: ProcessOptions = {}
): Promise<Blob> {
  const { maxDimension = 4096 } = options;

  // Converter source para canvas
  let canvas: HTMLCanvasElement;
  
  if (source instanceof HTMLCanvasElement) {
    canvas = source;
  } else {
    canvas = await sourceToCanvas(source, maxDimension);
  }

  // Gerar PNG sem compressão
  const blob = await canvasToBlob(canvas, 'image/png');
  
  console.log(`[Imagem] PNG gerado: ${(blob.size / 1024 / 1024).toFixed(2)}MB (${canvas.width}x${canvas.height})`);

  return blob;
}

/**
 * Converte source (Blob ou dataURL) para canvas
 */
async function sourceToCanvas(source: Blob | string, maxDimension: number): Promise<HTMLCanvasElement> {
  const img = await loadImage(source);
  
  let { width, height } = img;
  
  // Só redimensionar se exceder limite muito alto (4K por padrão)
  if (width > maxDimension || height > maxDimension) {
    const ratio = Math.min(maxDimension / width, maxDimension / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);
  
  return canvas;
}

/**
 * Carrega uma imagem a partir de Blob ou dataURL
 */
function loadImage(source: Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      if (typeof source === 'string' && source.startsWith('blob:')) {
        URL.revokeObjectURL(source);
      }
      resolve(img);
    };
    
    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    
    if (source instanceof Blob) {
      img.src = URL.createObjectURL(source);
    } else {
      img.src = source;
    }
  });
}

/**
 * Converte canvas para Blob PNG
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string = 'image/png'
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Falha ao converter canvas para blob'));
        }
      },
      type
    );
  });
}

/**
 * Verifica o tamanho de um Blob/File em MB
 */
export function getSizeMB(blob: Blob): number {
  return blob.size / 1024 / 1024;
}

/**
 * Verifica se o tamanho está dentro do limite
 */
export function isWithinSizeLimit(blob: Blob, maxSizeMB: number = 2): boolean {
  return getSizeMB(blob) <= maxSizeMB;
}

/**
 * Verifica se uma imagem precisa de compressão
 */
export function needsCompression(sizeBytes: number): boolean {
  return sizeBytes > 2 * 1024 * 1024;
}
