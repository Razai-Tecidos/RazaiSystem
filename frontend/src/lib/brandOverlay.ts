import razaiLogo from '@/assets/RazaiW.png';

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
  ctx.drawImage(logo, logoX, logoY, logoW, logoH);

  // 3. Gradiente escuro no fundo (10% inferior)
  const gradH = Math.round(size * 0.10);
  const grad = ctx.createLinearGradient(0, size - gradH, 0, size);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, size - gradH, size, gradH);

  // 4. Nome da cor (bold, 2.8% da largura, centralizado a 96% do topo)
  const fontSize = Math.round(size * 0.028);
  ctx.font = `700 ${fontSize}px Arial, Helvetica, sans-serif`;
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // letter-spacing via canvas (browsers modernos)
  if ('letterSpacing' in ctx) {
    (ctx as any).letterSpacing = `${(fontSize * -0.05).toFixed(1)}px`;
  }
  ctx.fillText(colorName, size / 2, Math.round(size * 0.96));

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  overlayCache.set(cacheKey, dataUrl);
  return dataUrl;
}
