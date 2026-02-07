/**
 * Utilitário para validação de imagens
 * A compressão real é feita no backend com sharp
 */

// Limite da Shopee: 2MB, target: 1.99MB
const MAX_SIZE = 1.99 * 1024 * 1024; // 1.99MB em bytes
const SHOPEE_LIMIT = 2 * 1024 * 1024; // 2MB em bytes

export interface ImageValidationResult {
  isValid: boolean;
  needsCompression: boolean;
  size: number;
  sizeFormatted: string;
  warning?: string;
  error?: string;
}

/**
 * Valida uma imagem por URL
 */
export async function validateImageUrl(url: string): Promise<ImageValidationResult> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    const contentLength = response.headers.get('content-length');
    
    if (!contentLength) {
      // Não conseguiu obter tamanho, assume que está ok
      return {
        isValid: true,
        needsCompression: false,
        size: 0,
        sizeFormatted: 'Desconhecido',
        warning: 'Não foi possível verificar o tamanho da imagem',
      };
    }
    
    const size = parseInt(contentLength, 10);
    return validateSize(size);
  } catch (error) {
    return {
      isValid: false,
      needsCompression: false,
      size: 0,
      sizeFormatted: 'Erro',
      error: 'Não foi possível acessar a imagem',
    };
  }
}

/**
 * Valida uma imagem por File
 */
export function validateImageFile(file: File): ImageValidationResult {
  return validateSize(file.size);
}

/**
 * Valida uma imagem por Buffer/Blob
 */
export function validateImageBlob(blob: Blob): ImageValidationResult {
  return validateSize(blob.size);
}

/**
 * Valida o tamanho da imagem
 */
function validateSize(size: number): ImageValidationResult {
  const sizeFormatted = formatSize(size);
  
  if (size > SHOPEE_LIMIT) {
    return {
      isValid: false,
      needsCompression: true,
      size,
      sizeFormatted,
      warning: `Imagem muito grande (${sizeFormatted}). Será comprimida automaticamente.`,
    };
  }
  
  if (size > MAX_SIZE) {
    return {
      isValid: true,
      needsCompression: true,
      size,
      sizeFormatted,
      warning: `Imagem próxima do limite (${sizeFormatted}). Pode ser comprimida.`,
    };
  }
  
  return {
    isValid: true,
    needsCompression: false,
    size,
    sizeFormatted,
  };
}

/**
 * Formata tamanho em bytes para string legível
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Verifica se o tipo MIME é suportado
 */
export function isValidImageType(mimeType: string): boolean {
  const validTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
  ];
  return validTypes.includes(mimeType.toLowerCase());
}

/**
 * Obtém extensão do arquivo pelo tipo MIME
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return extensions[mimeType.toLowerCase()] || 'jpg';
}

/**
 * Valida dimensões da imagem
 */
export async function validateImageDimensions(
  file: File,
  minWidth = 100,
  minHeight = 100,
  maxWidth = 4096,
  maxHeight = 4096
): Promise<{ isValid: boolean; width: number; height: number; error?: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      if (img.width < minWidth || img.height < minHeight) {
        resolve({
          isValid: false,
          width: img.width,
          height: img.height,
          error: `Imagem muito pequena. Mínimo: ${minWidth}x${minHeight}px`,
        });
        return;
      }
      
      if (img.width > maxWidth || img.height > maxHeight) {
        resolve({
          isValid: false,
          width: img.width,
          height: img.height,
          error: `Imagem muito grande. Máximo: ${maxWidth}x${maxHeight}px`,
        });
        return;
      }
      
      resolve({
        isValid: true,
        width: img.width,
        height: img.height,
      });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({
        isValid: false,
        width: 0,
        height: 0,
        error: 'Não foi possível carregar a imagem',
      });
    };
    
    img.src = url;
  });
}

/**
 * Valida múltiplas imagens
 */
export async function validateMultipleImages(
  urls: string[]
): Promise<Map<string, ImageValidationResult>> {
  const results = new Map<string, ImageValidationResult>();
  
  await Promise.all(
    urls.map(async (url) => {
      const result = await validateImageUrl(url);
      results.set(url, result);
    })
  );
  
  return results;
}

/**
 * Resumo de validação de múltiplas imagens
 */
export function getValidationSummary(
  results: Map<string, ImageValidationResult>
): {
  total: number;
  valid: number;
  needsCompression: number;
  invalid: number;
  warnings: string[];
  errors: string[];
} {
  let valid = 0;
  let needsCompression = 0;
  let invalid = 0;
  const warnings: string[] = [];
  const errors: string[] = [];
  
  results.forEach((result, url) => {
    if (result.isValid) {
      valid++;
      if (result.needsCompression) {
        needsCompression++;
      }
    } else {
      invalid++;
    }
    
    if (result.warning) {
      warnings.push(`${url}: ${result.warning}`);
    }
    if (result.error) {
      errors.push(`${url}: ${result.error}`);
    }
  });
  
  return {
    total: results.size,
    valid,
    needsCompression,
    invalid,
    warnings,
    errors,
  };
}
