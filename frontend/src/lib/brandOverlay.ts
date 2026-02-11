import razaiLogo from '@/assets/RazaiW.png';
import { ensureInterCanvasFontLoaded, getInterCanvasFont } from '@/lib/interCanvasFont';

// Cache para evitar re-processamento
const overlayCache = new Map<string, string>();

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('blob:') && !src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.src = src;
  });
}

/**
 * Gera preview da imagem de variação com overlay:
 * - Crop quadrado (1:1)
 * - Logo Razai branco no topo-centro
 * - Gradiente escuro + nome da cor no fundo
 */
export async function generateBrandOverlay(
  imageUrl: string,
  colorName: string
): Promise<string> {
  const cacheKey = `${imageUrl}::${colorName}`;
  if (overlayCache.has(cacheKey)) return overlayCache.get(cacheKey)!;

  const [img, logo] = await Promise.all([
    loadImage(imageUrl),
    loadImage(razaiLogo),
  ]);

  // Crop quadrado central
  const srcSize = Math.min(img.width, img.height);
  const srcX = (img.width - srcSize) / 2;
  const srcY = (img.height - srcSize) / 2;
  const size = Math.min(srcSize, 1024); // Limitar a 1024px para performance

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // 1. Desenhar imagem (crop central quadrado)
  ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, size, size);

  // 2. Logo no topo-centro (~22% da largura, ~12% do topo)
  const logoW = Math.round(size * 0.22);
  const logoH = Math.round(logoW * (logo.naturalHeight / logo.naturalWidth));
  const logoX = (size - logoW) / 2;
  const logoY = Math.round(size * 0.12);
  // Sombra suave no logo para destacar sem pesar.
  ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
  ctx.shadowBlur = Math.round(size * 0.016);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = Math.round(size * 0.005);
  ctx.drawImage(logo, logoX, logoY, logoW, logoH);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // 3. Nome da cor sem faixa/gradiente no rodape.
  // Distancia da borda inferior: ~16% (4x maior que os ~4% anteriores).
  const fontSize = Math.round(size * 0.032);
  await ensureInterCanvasFontLoaded(fontSize, 700);
  ctx.font = getInterCanvasFont(fontSize, 700);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.30)';
  ctx.shadowBlur = Math.round(size * 0.013);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = Math.round(size * 0.0042);
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // letter-spacing via canvas (browsers modernos)
  if ('letterSpacing' in ctx) {
    (ctx as any).letterSpacing = `${(fontSize * -0.01).toFixed(1)}px`;
  }
  const textY = Math.round(size * 0.84);
  ctx.fillText(colorName, size / 2, textY);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // PNG: preserva qualidade sem compressao com perdas (lossless).
  const dataUrl = canvas.toDataURL('image/png');
  overlayCache.set(cacheKey, dataUrl);
  return dataUrl;
}
