import interLatin400 from '@fontsource/inter/files/inter-latin-400-normal.woff2';
import interLatin700 from '@fontsource/inter/files/inter-latin-700-normal.woff2';
import interLatin900 from '@fontsource/inter/files/inter-latin-900-normal.woff2';
import interLatinExt400 from '@fontsource/inter/files/inter-latin-ext-400-normal.woff2';
import interLatinExt700 from '@fontsource/inter/files/inter-latin-ext-700-normal.woff2';
import interLatinExt900 from '@fontsource/inter/files/inter-latin-ext-900-normal.woff2';

type InterWeight = 400 | 700 | 900;

const INTER_CANVAS_FAMILY = 'Inter Canvas';

const FONT_SOURCES_BY_WEIGHT: Record<InterWeight, string[]> = {
  400: [interLatin400, interLatinExt400],
  700: [interLatin700, interLatinExt700],
  900: [interLatin900, interLatinExt900],
};

let interCanvasLoadInFlight: Promise<void> | null = null;

function getFontFaceSet(): FontFaceSet | null {
  if (typeof document === 'undefined' || !('fonts' in document) || typeof FontFace === 'undefined') {
    return null;
  }
  return document.fonts;
}

function isInterCanvasWeightReady(fontFaceSet: FontFaceSet, weight: InterWeight): boolean {
  if (typeof fontFaceSet.check !== 'function') return false;
  return fontFaceSet.check(`${weight} 16px "${INTER_CANVAS_FAMILY}"`);
}

async function loadInterCanvasFamily(): Promise<void> {
  const fontFaceSet = getFontFaceSet();
  if (!fontFaceSet) return;

  const allReady = isInterCanvasWeightReady(fontFaceSet, 400)
    && isInterCanvasWeightReady(fontFaceSet, 700)
    && isInterCanvasWeightReady(fontFaceSet, 900);

  if (allReady) return;

  if (!interCanvasLoadInFlight) {
    interCanvasLoadInFlight = (async () => {
      const faces: FontFace[] = [];
      const weights: InterWeight[] = [400, 700, 900];

      for (const weight of weights) {
        const sources = FONT_SOURCES_BY_WEIGHT[weight];
        for (const source of sources) {
          const face = new FontFace(INTER_CANVAS_FAMILY, `url(${source}) format("woff2")`, {
            weight: String(weight),
            style: 'normal',
            display: 'swap',
          });
          await face.load();
          faces.push(face);
        }
      }

      faces.forEach((face) => fontFaceSet.add(face));
    })().finally(() => {
      interCanvasLoadInFlight = null;
    });
  }

  await interCanvasLoadInFlight;
}

export async function ensureInterCanvasFontLoaded(
  fontSize: number,
  fontWeight: InterWeight = 700
): Promise<void> {
  const fontFaceSet = getFontFaceSet();
  if (!fontFaceSet) return;

  await loadInterCanvasFamily();
  const normalizedSize = Math.max(1, Math.round(fontSize));
  const descriptor = `${fontWeight} ${normalizedSize}px "${INTER_CANVAS_FAMILY}"`;

  if (typeof fontFaceSet.load === 'function') {
    await fontFaceSet.load(descriptor, 'ABCDEFGHIJKLMnopqrstuvwxyz0123456789');
  }

  if (typeof fontFaceSet.check === 'function' && !fontFaceSet.check(descriptor)) {
    throw new Error('Failed to load Inter Canvas font for image generation');
  }
}

export function getInterCanvasFont(fontSize: number, fontWeight: InterWeight = 700): string {
  const normalizedSize = Math.max(1, Math.round(fontSize));
  return `${fontWeight} ${normalizedSize}px "${INTER_CANVAS_FAMILY}", "Inter", sans-serif`;
}
