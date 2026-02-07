import sharp from 'sharp';
import axios from 'axios';

// Target: 1.99MB (limite Shopee é 2MB)
const TARGET_SIZE = 1.99 * 1024 * 1024; // bytes

/**
 * Comprime uma imagem para atingir o target de 1.99MB
 * Mantém o formato original (PNG permanece PNG, JPEG permanece JPEG)
 * Preserva qualidade máxima, só comprime se necessário
 */
export async function compressImageToTarget(
  buffer: Buffer, 
  mimeType: string
): Promise<{ buffer: Buffer; wasCompressed: boolean; originalSize: number; finalSize: number }> {
  const originalSize = buffer.length;
  
  // Se já está abaixo do target, retorna sem alteração
  if (buffer.length <= TARGET_SIZE) {
    return {
      buffer,
      wasCompressed: false,
      originalSize,
      finalSize: buffer.length,
    };
  }

  const isPng = mimeType === 'image/png' || mimeType.includes('png');
  const isWebp = mimeType === 'image/webp' || mimeType.includes('webp');
  let result = buffer;
  
  // Etapa 1: Compressão sem perda de qualidade (apenas otimização)
  if (isPng) {
    result = await sharp(buffer)
      .png({ compressionLevel: 9, palette: false })
      .toBuffer();
  } else if (isWebp) {
    result = await sharp(buffer)
      .webp({ quality: 100, lossless: true })
      .toBuffer();
  } else {
    // JPEG ou outros formatos
    result = await sharp(buffer)
      .jpeg({ quality: 100, mozjpeg: true })
      .toBuffer();
  }
  
  if (result.length <= TARGET_SIZE) {
    return {
      buffer: result,
      wasCompressed: true,
      originalSize,
      finalSize: result.length,
    };
  }

  // Etapa 2: Redução gradual de qualidade (apenas para JPEG/WebP)
  // PNG não perde qualidade com compressão, então pula para redimensionamento
  if (!isPng) {
    for (let quality = 95; quality >= 70; quality -= 5) {
      if (isWebp) {
        result = await sharp(buffer)
          .webp({ quality, lossless: false })
          .toBuffer();
      } else {
        result = await sharp(buffer)
          .jpeg({ quality, mozjpeg: true })
          .toBuffer();
      }
      
      if (result.length <= TARGET_SIZE) {
        return {
          buffer: result,
          wasCompressed: true,
          originalSize,
          finalSize: result.length,
        };
      }
    }
  }

  // Etapa 3: Redimensionamento progressivo (último recurso)
  const metadata = await sharp(buffer).metadata();
  let scale = 0.95; // Começa reduzindo 5%
  
  while (result.length > TARGET_SIZE && scale > 0.5) {
    const newWidth = Math.round((metadata.width || 1000) * scale);
    const newHeight = Math.round((metadata.height || 1000) * scale);
    
    if (isPng) {
      result = await sharp(buffer)
        .resize(newWidth, newHeight, { fit: 'inside' })
        .png({ compressionLevel: 9 })
        .toBuffer();
    } else if (isWebp) {
      result = await sharp(buffer)
        .resize(newWidth, newHeight, { fit: 'inside' })
        .webp({ quality: 85 })
        .toBuffer();
    } else {
      result = await sharp(buffer)
        .resize(newWidth, newHeight, { fit: 'inside' })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
    }
    
    scale -= 0.05; // Reduz mais 5% se ainda não atingiu target
  }

  return {
    buffer: result,
    wasCompressed: true,
    originalSize,
    finalSize: result.length,
  };
}

/**
 * Baixa uma imagem de uma URL e comprime se necessário
 */
export async function downloadAndCompressImage(
  imageUrl: string
): Promise<{ buffer: Buffer; mimeType: string; wasCompressed: boolean; originalSize: number; finalSize: number }> {
  // Baixa a imagem
  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 30000,
  });
  
  const buffer = Buffer.from(response.data);
  const mimeType = response.headers['content-type'] || 'image/jpeg';
  
  // Comprime se necessário
  const result = await compressImageToTarget(buffer, mimeType);
  
  return {
    ...result,
    mimeType,
  };
}

/**
 * Verifica se uma imagem precisa de compressão
 */
export async function needsCompression(buffer: Buffer): Promise<boolean> {
  return buffer.length > TARGET_SIZE;
}

/**
 * Retorna informações sobre uma imagem
 */
export async function getImageInfo(buffer: Buffer): Promise<{
  width: number;
  height: number;
  format: string;
  size: number;
  needsCompression: boolean;
  aspectRatio: number;
  isSquare: boolean;
  meetsMinResolution: boolean;
}> {
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  const aspectRatio = height > 0 ? width / height : 0;
  
  return {
    width,
    height,
    format: metadata.format || 'unknown',
    size: buffer.length,
    needsCompression: buffer.length > TARGET_SIZE,
    aspectRatio,
    isSquare: Math.abs(aspectRatio - 1) < 0.05, // Tolerância de 5%
    meetsMinResolution: width >= 500 && height >= 500,
  };
}

/**
 * Requisitos de imagem da Shopee
 */
export const SHOPEE_IMAGE_REQUIREMENTS = {
  MIN_WIDTH: 500,
  MIN_HEIGHT: 500,
  RECOMMENDED_WIDTH: 1024,
  RECOMMENDED_HEIGHT: 1024,
  MAX_SIZE_BYTES: 2 * 1024 * 1024, // 2MB
  TARGET_SIZE_BYTES: TARGET_SIZE,
  ASPECT_RATIO: 1, // 1:1 (quadrado)
  ASPECT_RATIO_TOLERANCE: 0.05, // 5% de tolerância
  ALLOWED_FORMATS: ['jpeg', 'jpg', 'png'],
};

/**
 * Valida se uma imagem atende aos requisitos da Shopee
 */
export interface ImageValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  info: {
    width: number;
    height: number;
    format: string;
    size: number;
    aspectRatio: number;
  };
}

export async function validateImageForShopee(buffer: Buffer): Promise<ImageValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  const format = metadata.format || 'unknown';
  const size = buffer.length;
  const aspectRatio = height > 0 ? width / height : 0;
  
  // Validação de formato
  if (!SHOPEE_IMAGE_REQUIREMENTS.ALLOWED_FORMATS.includes(format.toLowerCase())) {
    errors.push(`Formato "${format}" não suportado. Use JPG ou PNG.`);
  }
  
  // Validação de resolução mínima
  if (width < SHOPEE_IMAGE_REQUIREMENTS.MIN_WIDTH) {
    errors.push(`Largura mínima é ${SHOPEE_IMAGE_REQUIREMENTS.MIN_WIDTH}px (atual: ${width}px)`);
  }
  if (height < SHOPEE_IMAGE_REQUIREMENTS.MIN_HEIGHT) {
    errors.push(`Altura mínima é ${SHOPEE_IMAGE_REQUIREMENTS.MIN_HEIGHT}px (atual: ${height}px)`);
  }
  
  // Validação de proporção (1:1)
  const ratioDiff = Math.abs(aspectRatio - SHOPEE_IMAGE_REQUIREMENTS.ASPECT_RATIO);
  if (ratioDiff > SHOPEE_IMAGE_REQUIREMENTS.ASPECT_RATIO_TOLERANCE) {
    warnings.push(`Proporção recomendada é 1:1 (quadrado). Atual: ${aspectRatio.toFixed(2)}:1`);
  }
  
  // Validação de tamanho
  if (size > SHOPEE_IMAGE_REQUIREMENTS.MAX_SIZE_BYTES) {
    warnings.push(`Imagem maior que 2MB será comprimida automaticamente`);
  }
  
  // Recomendações
  if (width < SHOPEE_IMAGE_REQUIREMENTS.RECOMMENDED_WIDTH || height < SHOPEE_IMAGE_REQUIREMENTS.RECOMMENDED_HEIGHT) {
    warnings.push(`Resolução recomendada é ${SHOPEE_IMAGE_REQUIREMENTS.RECOMMENDED_WIDTH}x${SHOPEE_IMAGE_REQUIREMENTS.RECOMMENDED_HEIGHT}px`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    info: {
      width,
      height,
      format,
      size,
      aspectRatio,
    },
  };
}

/**
 * Valida uma imagem a partir de URL
 */
export async function validateImageUrlForShopee(imageUrl: string): Promise<ImageValidationResult> {
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    
    const buffer = Buffer.from(response.data);
    return validateImageForShopee(buffer);
  } catch (error: any) {
    return {
      valid: false,
      errors: [`Não foi possível baixar a imagem: ${error.message}`],
      warnings: [],
      info: {
        width: 0,
        height: 0,
        format: 'unknown',
        size: 0,
        aspectRatio: 0,
      },
    };
  }
}

/**
 * Redimensiona imagem para proporção 1:1 (quadrado)
 * Adiciona padding branco se necessário
 */
export async function makeImageSquare(buffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  
  // Se já é quadrado, retorna sem alteração
  if (Math.abs(width - height) < 10) {
    return buffer;
  }
  
  const maxDimension = Math.max(width, height);
  const isPng = metadata.format === 'png';
  
  // Cria imagem quadrada com fundo branco
  const result = await sharp(buffer)
    .resize(maxDimension, maxDimension, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .toFormat(isPng ? 'png' : 'jpeg')
    .toBuffer();
  
  return result;
}

/**
 * Processa imagem para atender todos os requisitos da Shopee
 * - Valida formato
 * - Ajusta proporção para 1:1 se necessário
 * - Comprime se > 2MB
 * - Garante resolução mínima
 */
export async function processImageForShopee(
  buffer: Buffer,
  options: {
    forceSquare?: boolean;
    targetResolution?: number;
  } = {}
): Promise<{
  buffer: Buffer;
  wasProcessed: boolean;
  validation: ImageValidationResult;
}> {
  const { forceSquare = false, targetResolution = 1024 } = options;
  
  let processedBuffer = buffer;
  let wasProcessed = false;
  
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  const isPng = metadata.format === 'png';
  
  // Se resolução é muito baixa, não há como melhorar
  if (width < 500 || height < 500) {
    const validation = await validateImageForShopee(buffer);
    return { buffer, wasProcessed: false, validation };
  }
  
  // Ajusta para quadrado se solicitado
  if (forceSquare && Math.abs(width - height) > 10) {
    processedBuffer = await makeImageSquare(processedBuffer);
    wasProcessed = true;
  }
  
  // Redimensiona para resolução alvo se muito grande
  const currentMetadata = await sharp(processedBuffer).metadata();
  const currentWidth = currentMetadata.width || 0;
  const currentHeight = currentMetadata.height || 0;
  
  if (currentWidth > targetResolution * 1.5 || currentHeight > targetResolution * 1.5) {
    processedBuffer = await sharp(processedBuffer)
      .resize(targetResolution, targetResolution, { fit: 'inside' })
      .toFormat(isPng ? 'png' : 'jpeg')
      .toBuffer();
    wasProcessed = true;
  }
  
  // Comprime se necessário
  if (processedBuffer.length > TARGET_SIZE) {
    const mimeType = isPng ? 'image/png' : 'image/jpeg';
    const compressed = await compressImageToTarget(processedBuffer, mimeType);
    processedBuffer = compressed.buffer;
    wasProcessed = wasProcessed || compressed.wasCompressed;
  }
  
  const validation = await validateImageForShopee(processedBuffer);
  
  return {
    buffer: processedBuffer,
    wasProcessed,
    validation,
  };
}

/**
 * Converte base64 para buffer e comprime
 */
export async function compressBase64Image(
  base64: string,
  mimeType: string
): Promise<{ base64: string; wasCompressed: boolean; originalSize: number; finalSize: number }> {
  // Remove prefixo data:image/xxx;base64, se presente
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  
  const result = await compressImageToTarget(buffer, mimeType);
  
  return {
    base64: result.buffer.toString('base64'),
    wasCompressed: result.wasCompressed,
    originalSize: result.originalSize,
    finalSize: result.finalSize,
  };
}
