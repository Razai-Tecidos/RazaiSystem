import { MosaicTemplateId } from '@/types/gestao-imagens.types';

interface MosaicBuildInput {
  images: string[];
  tecidoNome: string;
  templateId: MosaicTemplateId;
}

interface MosaicOutputs {
  squareBlob: Blob;
  portraitBlob: Blob;
  squarePreviewUrl: string;
  portraitPreviewUrl: string;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Falha ao carregar imagem: ${src}`));
    img.src = src;
  });
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const imageRatio = image.width / image.height;
  const targetRatio = width / height;

  let sx = 0;
  let sy = 0;
  let sw = image.width;
  let sh = image.height;

  if (imageRatio > targetRatio) {
    sw = image.height * targetRatio;
    sx = (image.width - sw) / 2;
  } else {
    sh = image.width / targetRatio;
    sy = (image.height - sh) / 2;
  }

  ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
}

function drawFooterLabel(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  tecidoNome: string
) {
  const footerHeight = Math.round(height * 0.14);
  const footerY = height - footerHeight;

  const gradient = ctx.createLinearGradient(0, footerY, 0, height);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.15)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.78)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, footerY, width, footerHeight);

  const text = `Tecido ${tecidoNome}`.trim();
  const fontSize = Math.max(26, Math.round(width * 0.045));
  ctx.font = `700 ${fontSize}px "Montserrat", "Segoe UI", sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, footerY + footerHeight / 2);
}

function drawGridTemplate(
  ctx: CanvasRenderingContext2D,
  images: HTMLImageElement[],
  width: number,
  height: number
) {
  const gap = Math.round(width * 0.01);
  const cellWidth = Math.floor((width - gap) / 2);
  const cellHeight = Math.floor((height - gap) / 2);
  const cells = [
    [0, 0],
    [cellWidth + gap, 0],
    [0, cellHeight + gap],
    [cellWidth + gap, cellHeight + gap],
  ];

  cells.forEach(([x, y], index) => {
    const image = images[index % images.length];
    drawImageCover(ctx, image, x, y, cellWidth, cellHeight);
  });
}

function drawHeroVerticalTemplate(
  ctx: CanvasRenderingContext2D,
  images: HTMLImageElement[],
  width: number,
  height: number
) {
  const gap = Math.round(width * 0.01);
  const leftWidth = Math.floor(width * 0.62);
  const rightWidth = width - leftWidth - gap;

  drawImageCover(ctx, images[0], 0, 0, leftWidth, height);

  const topHeight = Math.floor((height - gap) / 2);
  const bottomY = topHeight + gap;
  drawImageCover(ctx, images[1 % images.length], leftWidth + gap, 0, rightWidth, topHeight);
  drawImageCover(
    ctx,
    images[2 % images.length],
    leftWidth + gap,
    bottomY,
    rightWidth,
    height - bottomY
  );
}

function drawTriptychTemplate(
  ctx: CanvasRenderingContext2D,
  images: HTMLImageElement[],
  width: number,
  height: number
) {
  const gap = Math.round(width * 0.01);
  const columnWidth = Math.floor((width - gap * 2) / 3);

  for (let index = 0; index < 3; index += 1) {
    const x = index * (columnWidth + gap);
    const image = images[index % images.length];
    drawImageCover(ctx, image, x, 0, columnWidth, height);
  }
}

function renderTemplate(
  ctx: CanvasRenderingContext2D,
  images: HTMLImageElement[],
  templateId: MosaicTemplateId,
  width: number,
  height: number
) {
  if (templateId === 'hero-vertical') {
    drawHeroVerticalTemplate(ctx, images, width, height);
    return;
  }

  if (templateId === 'triptych') {
    drawTriptychTemplate(ctx, images, width, height);
    return;
  }

  drawGridTemplate(ctx, images, width, height);
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Falha ao gerar imagem do mosaico'));
        return;
      }
      resolve(blob);
    }, 'image/jpeg', 0.9);
  });
}

async function renderMosaicBlob(
  images: HTMLImageElement[],
  tecidoNome: string,
  templateId: MosaicTemplateId,
  width: number,
  height: number
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Falha ao criar contexto de canvas');
  }

  renderTemplate(ctx, images, templateId, width, height);
  drawFooterLabel(ctx, width, height, tecidoNome);
  return canvasToBlob(canvas);
}

export async function buildMosaicOutputs(input: MosaicBuildInput): Promise<MosaicOutputs> {
  if (input.images.length === 0) {
    throw new Error('Selecione pelo menos uma imagem para gerar o mosaico');
  }

  const loadedImages = await Promise.all(input.images.map((url) => loadImage(url)));

  const squareBlob = await renderMosaicBlob(
    loadedImages,
    input.tecidoNome,
    input.templateId,
    1024,
    1024
  );

  const portraitBlob = await renderMosaicBlob(
    loadedImages,
    input.tecidoNome,
    input.templateId,
    1062,
    1416
  );

  return {
    squareBlob,
    portraitBlob,
    squarePreviewUrl: URL.createObjectURL(squareBlob),
    portraitPreviewUrl: URL.createObjectURL(portraitBlob),
  };
}
