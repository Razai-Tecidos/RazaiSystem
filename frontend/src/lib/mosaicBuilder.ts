import { MosaicTemplateId } from '@/types/gestao-imagens.types';
import razaiLogo from '@/assets/RazaiW.png';
import { ensureInterCanvasFontLoaded, getInterCanvasFont } from '@/lib/interCanvasFont';

interface MosaicBuildInput {
  images: string[];
  tecidoNome: string;
  templateId: MosaicTemplateId;
  tecidoLargura?: number | null;
  tecidoComposicao?: string | null;
  modelImageUrl?: string | null;
  premiumColorName?: string | null;
}

interface MosaicOutputs {
  squareBlob: Blob;
  portraitBlob: Blob;
  squarePreviewUrl: string;
  portraitPreviewUrl: string;
}

interface PremiumVinculoBuildInput {
  fabricImageUrl: string;
  modelImageUrl: string;
  tecidoNome: string;
  corNome: string;
  tecidoLargura?: number | null;
  tecidoComposicao?: string | null;
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

function measureTrackedTextWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  letterSpacingPx: number
): number {
  const chars = Array.from(text);
  if (chars.length === 0) return 0;

  return chars.reduce((total, char, index) => {
    const charWidth = ctx.measureText(char).width;
    if (index === chars.length - 1) return total + charWidth;
    return total + charWidth + letterSpacingPx;
  }, 0);
}

function drawTrackedCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  baselineY: number,
  letterSpacingPx: number
) {
  const chars = Array.from(text);
  if (chars.length === 0) return;

  const textWidth = measureTrackedTextWidth(ctx, text, letterSpacingPx);
  let currentX = centerX - textWidth / 2;

  chars.forEach((char, index) => {
    ctx.fillText(char, currentX, baselineY);
    const charWidth = ctx.measureText(char).width;
    currentX += charWidth;
    if (index < chars.length - 1) currentX += letterSpacingPx;
  });
}

function getAlphabeticBaselineForCenter(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerY: number
): number {
  const metrics = ctx.measureText(text);
  const ascent = metrics.actualBoundingBoxAscent || 0;
  const descent = metrics.actualBoundingBoxDescent || 0;
  return centerY + (ascent - descent) / 2;
}

function fitCenterLabelFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number
): { fontSize: number; letterSpacingPx: number } {
  const defaultSize = Math.max(56, Math.round(width * 0.10));
  const minSize = Math.max(34, Math.round(width * 0.06));
  const maxTextWidth = width * 0.84; // respiracao lateral de ~8% por lado

  let fontSize = defaultSize;
  while (fontSize > minSize) {
    const letterSpacingPx = fontSize * -0.03;
    ctx.font = getInterCanvasFont(fontSize, 900);
    const textWidth = measureTrackedTextWidth(ctx, text, letterSpacingPx);
    if (textWidth <= maxTextWidth) {
      return { fontSize, letterSpacingPx };
    }
    fontSize -= 2;
  }

  return { fontSize: minSize, letterSpacingPx: minSize * -0.03 };
}

async function drawCenterLabel(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  tecidoNome: string
): Promise<void> {
  const text = tecidoNome.trim().toUpperCase();
  await ensureInterCanvasFontLoaded(Math.max(56, Math.round(width * 0.10)), 900);
  const { fontSize, letterSpacingPx } = fitCenterLabelFontSize(ctx, text, width);
  ctx.font = getInterCanvasFont(fontSize, 900);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const centerX = width / 2;
  const centerY = height / 2;

  const verticalPadding = Math.round(fontSize * 0.45);
  const labelHeight = fontSize + verticalPadding * 2;
  const labelY = centerY - labelHeight / 2;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
  ctx.fillRect(0, labelY, width, labelHeight);

  ctx.fillStyle = '#2B2B2B';
  const baselineY = getAlphabeticBaselineForCenter(ctx, text, centerY);
  drawTrackedCenteredText(ctx, text, centerX, baselineY, letterSpacingPx);
}

type PremiumInfo = {
  tecidoNome: string;
  tecidoLargura?: number | null;
  tecidoComposicao?: string | null;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatLarguraInfo(largura?: number | null): string {
  if (typeof largura !== 'number' || Number.isNaN(largura) || largura <= 0) {
    return '-';
  }
  return `${largura.toFixed(2).replace('.', ',')}m`;
}

function formatComposicaoInfo(composicao?: string | null): string {
  if (!composicao || !composicao.trim()) return '-';
  return composicao
    .replace(/\s+-\s+/g, '\n')
    .trim();
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
  letterSpacingPx = 0
): number {
  const normalized = text.trim();
  if (!normalized) return y;

  const paragraphs = normalized.split(/\r?\n/);
  const lines: string[] = [];

  paragraphs.forEach((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return;

    let currentLine = words[0];

    for (let index = 1; index < words.length; index += 1) {
      const word = words[index];
      const candidate = `${currentLine} ${word}`;
      const candidateWidth = measureTrackedTextWidth(ctx, candidate, letterSpacingPx);
      if (candidateWidth <= maxWidth) {
        currentLine = candidate;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }

    lines.push(currentLine);
  });

  if (lines.length === 0) return y;

  const fitEllipsis = (line: string): string => {
    const suffix = '...';
    let base = line.trimEnd();
    while (base.length > 0 && measureTrackedTextWidth(ctx, `${base}${suffix}`, letterSpacingPx) > maxWidth) {
      base = base.slice(0, -1).trimEnd();
    }
    return `${base}${suffix}`;
  };

  const drawTrackedText = (value: string, drawX: number, drawY: number) => {
    if (letterSpacingPx === 0) {
      ctx.fillText(value, drawX, drawY);
      return;
    }

    let currentX = drawX;
    const chars = Array.from(value);
    chars.forEach((char, index) => {
      ctx.fillText(char, currentX, drawY);
      currentX += ctx.measureText(char).width;
      if (index < chars.length - 1) currentX += letterSpacingPx;
    });
  };

  const visibleLines = lines.slice(0, maxLines);
  visibleLines.forEach((line, lineIndex) => {
    const isLastVisible = lineIndex === maxLines - 1 && lines.length > maxLines;
    const value = isLastVisible ? fitEllipsis(line) : line;
    drawTrackedText(value, x, y + lineHeight * lineIndex);
  });

  return y + lineHeight * visibleLines.length;
}

type PremiumLayoutMode = 'split' | 'stack';

type PremiumLayout = {
  fabricRect: Rect;
  infoRect: Rect;
  modelRect: Rect;
  modelLeftX: number;
  titleSize: number;
  valueSize: number;
  colorNameSize: number;
  logoHeight: number;
  panelPaddingX: number;
  panelPaddingY: number;
  blockGap: number;
  panelMode: PremiumLayoutMode;
};

const PREMIUM_INFO_TEXT_COLOR = '#282828';
const PREMIUM_INFO_PANEL_BG = '#FFFFFF';

function scaleToCanvas(value: number, canvasSize: number, baseSize: number): number {
  return Math.round((value * canvasSize) / baseSize);
}

function getPremiumLayout(width: number, height: number): PremiumLayout {
  const ratio = width / height;

  if (ratio >= 0.95) {
    const scale = width / 1200;
    const fabricWidth = scaleToCanvas(800, width, 1200);
    const infoHeight = scaleToCanvas(600, height, 1200);

    return {
      fabricRect: { x: 0, y: 0, width: fabricWidth, height },
      infoRect: { x: fabricWidth, y: 0, width: width - fabricWidth, height: infoHeight },
      modelRect: { x: fabricWidth, y: infoHeight, width: width - fabricWidth, height: height - infoHeight },
      modelLeftX: fabricWidth,
      titleSize: Math.max(14, Math.round(24 * scale)),
      valueSize: Math.max(22, Math.round(40 * scale)),
      colorNameSize: Math.max(24, Math.round(40 * scale)),
      logoHeight: Math.max(40, Math.round(200 * scale)),
      panelPaddingX: Math.max(16, Math.round(48 * scale)),
      panelPaddingY: Math.max(16, Math.round(44 * scale)),
      blockGap: Math.max(12, Math.round(28 * scale)),
      panelMode: 'stack',
    };
  }

  const scale = width / 1200;
  const fabricHeight = scaleToCanvas(1200, height, 1600);
  const infoWidth = scaleToCanvas(700, width, 1200);
  const modelY = scaleToCanvas(625, height, 1600);

  return {
    fabricRect: { x: 0, y: 0, width, height: fabricHeight },
    infoRect: { x: 0, y: fabricHeight, width: infoWidth, height: height - fabricHeight },
    modelRect: { x: infoWidth, y: modelY, width: width - infoWidth, height: height - modelY },
    modelLeftX: infoWidth,
    titleSize: Math.max(14, Math.round(24 * scale)),
    valueSize: Math.max(22, Math.round(40 * scale)),
    colorNameSize: Math.max(24, Math.round(40 * scale)),
    logoHeight: Math.max(40, Math.round(200 * scale)),
    panelPaddingX: Math.max(16, Math.round(48 * scale)),
    panelPaddingY: Math.max(16, Math.round(44 * scale)),
    blockGap: Math.max(12, Math.round(28 * scale)),
    panelMode: 'split',
  };
}

function fitPremiumColorNameFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  targetSize: number
): number {
  const minSize = Math.max(16, Math.round(targetSize * 0.65));
  let fontSize = targetSize;

  while (fontSize > minSize) {
    ctx.font = getInterCanvasFont(fontSize, 700);
    if (ctx.measureText(text).width <= maxWidth) return fontSize;
    fontSize -= 1;
  }

  return minSize;
}

function drawPremiumInfoBlock(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  titleSize: number,
  valueSize: number,
  valueLineHeight: number,
  valueMaxLines: number,
  blockGap: number,
  valueLetterSpacingPx: number
): number {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = PREMIUM_INFO_TEXT_COLOR;
  ctx.font = getInterCanvasFont(titleSize, 400);
  ctx.fillText(label.toUpperCase(), x, y);

  const valueY = y + Math.round(titleSize * 1.25);
  ctx.fillStyle = PREMIUM_INFO_TEXT_COLOR;
  ctx.font = getInterCanvasFont(valueSize, 700);
  const blockBottom = drawWrappedText(
    ctx,
    value.trim() || '-',
    x,
    valueY,
    maxWidth,
    valueLineHeight,
    valueMaxLines,
    valueLetterSpacingPx
  );

  return blockBottom + blockGap;
}

async function drawPremiumInfoPanel(
  ctx: CanvasRenderingContext2D,
  layout: PremiumLayout,
  info: PremiumInfo
): Promise<void> {
  const { infoRect } = layout;
  ctx.fillStyle = PREMIUM_INFO_PANEL_BG;
  ctx.fillRect(infoRect.x, infoRect.y, infoRect.width, infoRect.height);

  await ensureInterCanvasFontLoaded(layout.titleSize, 400);
  await ensureInterCanvasFontLoaded(layout.valueSize, 700);

  const contentX = infoRect.x + layout.panelPaddingX;
  const contentY = infoRect.y + layout.panelPaddingY;
  const contentWidth = Math.max(1, infoRect.width - layout.panelPaddingX * 2);
  const valueLineHeight = Math.round(layout.valueSize * 1.08);
  const valueLetterSpacingPx = layout.valueSize * -0.03;

  if (layout.panelMode === 'split') {
    const columnGap = Math.max(12, Math.round(contentWidth * 0.07));
    const leftColumnWidth = Math.round((contentWidth - columnGap) * 0.42);
    const rightColumnWidth = contentWidth - columnGap - leftColumnWidth;

    let leftY = contentY;
    leftY = drawPremiumInfoBlock(
      ctx,
      'TECIDO:',
      info.tecidoNome,
      contentX,
      leftY,
      leftColumnWidth,
      layout.titleSize,
      layout.valueSize,
      valueLineHeight,
      2,
      layout.blockGap,
      valueLetterSpacingPx
    );

    drawPremiumInfoBlock(
      ctx,
      'LARGURA:',
      formatLarguraInfo(info.tecidoLargura),
      contentX,
      leftY,
      leftColumnWidth,
      layout.titleSize,
      layout.valueSize,
      valueLineHeight,
      1,
      0,
      valueLetterSpacingPx
    );

    const rightX = contentX + leftColumnWidth + columnGap;
    drawPremiumInfoBlock(
      ctx,
      'COMPOSI\u00C7\u00C3O:',
      formatComposicaoInfo(info.tecidoComposicao),
      rightX,
      contentY,
      rightColumnWidth,
      layout.titleSize,
      layout.valueSize,
      valueLineHeight,
      3,
      0,
      valueLetterSpacingPx
    );

    return;
  }

  let stackY = contentY;
  stackY = drawPremiumInfoBlock(
    ctx,
    'TECIDO:',
    info.tecidoNome,
    contentX,
    stackY,
    contentWidth,
    layout.titleSize,
    layout.valueSize,
    valueLineHeight,
    2,
    layout.blockGap,
    valueLetterSpacingPx
  );

  stackY = drawPremiumInfoBlock(
    ctx,
    'LARGURA:',
    formatLarguraInfo(info.tecidoLargura),
    contentX,
    stackY,
    contentWidth,
    layout.titleSize,
    layout.valueSize,
    valueLineHeight,
    1,
    layout.blockGap,
    valueLetterSpacingPx
  );

  drawPremiumInfoBlock(
    ctx,
    'COMPOSI\u00C7\u00C3O:',
    formatComposicaoInfo(info.tecidoComposicao),
    contentX,
    stackY,
    contentWidth,
    layout.titleSize,
    layout.valueSize,
    valueLineHeight,
    3,
    0,
    valueLetterSpacingPx
  );
}

async function drawPremiumFabricBranding(
  ctx: CanvasRenderingContext2D,
  fabricRect: Rect,
  logo: HTMLImageElement,
  modelLeftX: number,
  layout: PremiumLayout,
  colorName?: string | null
): Promise<void> {
  const logoHeight = layout.logoHeight;
  const logoWidth = Math.round(logoHeight * (logo.naturalWidth / logo.naturalHeight));
  const logoX = fabricRect.x + Math.round((fabricRect.width - logoWidth) / 2);
  const logoY = fabricRect.y + Math.round(fabricRect.height * 0.11);

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
  ctx.shadowBlur = Math.round(logoHeight * 0.09);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = Math.round(logoHeight * 0.028);
  ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
  ctx.restore();

  const text = (colorName || '').normalize('NFC').trim();
  if (!text) return;

  const rightBound = clamp(modelLeftX, fabricRect.x, fabricRect.x + fabricRect.width);
  const horizontalPadding = Math.round(fabricRect.width * 0.06);
  const leftLimit = fabricRect.x + horizontalPadding;
  const rightLimit = Math.max(leftLimit + 40, rightBound - horizontalPadding);
  const maxTextWidth = rightLimit - leftLimit;
  const targetCenterX = fabricRect.x + (rightBound - fabricRect.x) / 2;

  const fontSize = fitPremiumColorNameFontSize(ctx, text, maxTextWidth, layout.colorNameSize);
  await ensureInterCanvasFontLoaded(fontSize, 700);
  ctx.font = getInterCanvasFont(fontSize, 700);
  const letterSpacingPx = fontSize * -0.03;

  const measuredTextWidth = measureTrackedTextWidth(ctx, text, letterSpacingPx);
  const centerX = clamp(
    targetCenterX,
    leftLimit + measuredTextWidth / 2,
    rightLimit - measuredTextWidth / 2
  );
  const textY = fabricRect.y + fabricRect.height - Math.round(fabricRect.height * 0.16);

  ctx.save();
  // Important: when drawing char-by-char with tracking, use left alignment.
  // Center alignment here shifts each glyph independently and can visually
  // displace narrow letters (e.g. "l").
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.32)';
  ctx.shadowBlur = Math.round(fontSize * 0.42);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = Math.max(1, Math.round(fontSize * 0.13));

  const chars = Array.from(text);
  let drawX = centerX - measuredTextWidth / 2;
  chars.forEach((char, index) => {
    ctx.fillText(char, drawX, textY);
    drawX += ctx.measureText(char).width;
    if (index < chars.length - 1) drawX += letterSpacingPx;
  });
  ctx.restore();
}

async function drawPremiumInfoTemplate(
  ctx: CanvasRenderingContext2D,
  images: HTMLImageElement[],
  width: number,
  height: number,
  info: PremiumInfo,
  modelImage: HTMLImageElement | null,
  logoImage: HTMLImageElement,
  colorName?: string | null
): Promise<void> {
  const fabricImage = images[0];
  const fallbackModelImage = images[1 % images.length];
  const finalModelImage = modelImage || fallbackModelImage;
  const layout = getPremiumLayout(width, height);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  drawImageCover(
    ctx,
    fabricImage,
    layout.fabricRect.x,
    layout.fabricRect.y,
    layout.fabricRect.width,
    layout.fabricRect.height
  );

  await drawPremiumFabricBranding(ctx, layout.fabricRect, logoImage, layout.modelLeftX, layout, colorName);
  await drawPremiumInfoPanel(ctx, layout, info);

  drawImageCover(
    ctx,
    finalModelImage,
    layout.modelRect.x,
    layout.modelRect.y,
    layout.modelRect.width,
    layout.modelRect.height
  );
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
  height: number,
  info: PremiumInfo,
  modelImage: HTMLImageElement | null,
  logoImage: HTMLImageElement | null,
  colorName?: string | null
): Promise<void> | void {
  if (templateId === 'premium-info') {
    if (!logoImage) {
      throw new Error('Logo da marca nao disponivel para o template premium');
    }
    return drawPremiumInfoTemplate(ctx, images, width, height, info, modelImage, logoImage, colorName);
  }

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
  input: MosaicBuildInput,
  modelImage: HTMLImageElement | null,
  logoImage: HTMLImageElement | null,
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

  await renderTemplate(
    ctx,
    images,
    input.templateId,
    width,
    height,
    {
      tecidoNome: input.tecidoNome,
      tecidoLargura: input.tecidoLargura,
      tecidoComposicao: input.tecidoComposicao,
    },
    modelImage,
    logoImage,
    input.premiumColorName
  );
  if (input.templateId !== 'premium-info') {
    await drawCenterLabel(ctx, width, height, input.tecidoNome);
  }
  return canvasToBlob(canvas);
}

export async function buildMosaicOutputs(input: MosaicBuildInput): Promise<MosaicOutputs> {
  if (input.images.length === 0) {
    throw new Error('Selecione pelo menos uma imagem para gerar o mosaico');
  }

  const loadedImages = await Promise.all(input.images.map((url) => loadImage(url)));
  const modelImage = input.modelImageUrl ? await loadImage(input.modelImageUrl).catch(() => null) : null;
  const logoImage = input.templateId === 'premium-info'
    ? await loadImage(razaiLogo).catch(() => null)
    : null;

  const squareBlob = await renderMosaicBlob(
    loadedImages,
    input,
    modelImage,
    logoImage,
    1024,
    1024
  );

  const portraitBlob = await renderMosaicBlob(
    loadedImages,
    input,
    modelImage,
    logoImage,
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

export async function buildPremiumVinculoOutputs(
  input: PremiumVinculoBuildInput
): Promise<MosaicOutputs> {
  return buildMosaicOutputs({
    images: [input.fabricImageUrl],
    tecidoNome: input.tecidoNome,
    templateId: 'premium-info',
    tecidoLargura: input.tecidoLargura,
    tecidoComposicao: input.tecidoComposicao,
    modelImageUrl: input.modelImageUrl,
    premiumColorName: input.corNome,
  });
}
