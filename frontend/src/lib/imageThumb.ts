interface ThumbnailOptions {
  maxDimension?: number;
  quality?: number;
}

const DEFAULT_MAX_DIMENSION = 160;
const DEFAULT_QUALITY = 0.62;

function loadImageForThumbnail(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Falha ao carregar imagem para thumb: ${url}`));
    image.src = url;
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Falha ao converter thumb para blob JPEG'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      quality
    );
  });
}

export async function createThumbnailBlobFromUrl(
  imageUrl: string,
  options: ThumbnailOptions = {}
): Promise<Blob> {
  const { maxDimension = DEFAULT_MAX_DIMENSION, quality = DEFAULT_QUALITY } = options;
  const image = await loadImageForThumbnail(imageUrl);

  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const largestSide = Math.max(sourceWidth, sourceHeight, 1);
  const scale = Math.min(1, maxDimension / largestSide);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Nao foi possivel obter contexto de canvas para thumb');
  }

  ctx.drawImage(image, 0, 0, width, height);
  return canvasToJpegBlob(canvas, quality);
}

export function isThumbStorageUrl(url?: string | null): boolean {
  if (!url) return false;
  return /thumb_/i.test(url) || /\/thumbs\//i.test(url);
}
