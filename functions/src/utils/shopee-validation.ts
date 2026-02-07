/**
 * Utilitários de validação para API Shopee
 * Baseado nos limites da API v2
 */

// Limites de caracteres e valores
export const SHOPEE_LIMITS = {
  // Nome e descrição
  ITEM_NAME_MIN: 20,
  ITEM_NAME_MAX: 120,
  DESCRIPTION_MIN: 100,
  DESCRIPTION_MAX: 3000,
  
  // SKU
  SKU_MAX: 100,
  MODEL_SKU_MAX: 50,
  
  // Imagens
  IMAGES_MIN: 1,
  IMAGES_MAX: 9,
  VARIATION_IMAGES_MAX: 9,
  IMAGE_MIN_WIDTH: 500,
  IMAGE_MIN_HEIGHT: 500,
  IMAGE_RECOMMENDED_WIDTH: 1024,
  IMAGE_RECOMMENDED_HEIGHT: 1024,
  IMAGE_MAX_SIZE_BYTES: 2 * 1024 * 1024, // 2MB
  IMAGE_ASPECT_RATIO: 1, // 1:1 (quadrado)
  IMAGE_ASPECT_RATIO_TOLERANCE: 0.05, // 5% de tolerância
  
  // Variações
  TIER_VARIATIONS_MAX: 2,
  OPTIONS_PER_TIER_MAX: 50,
  MODELS_MAX: 50,
  OPTION_NAME_MAX: 20,
  
  // Preço e estoque
  PRICE_MIN: 0.01,
  PRICE_MAX: 999999999,
  STOCK_MIN: 0,
  STOCK_MAX: 999999,
  
  // Peso e dimensões
  WEIGHT_MIN_KG: 0.001,
  WEIGHT_MAX_KG: 300,
  DIMENSION_MIN_CM: 0.1,
  DIMENSION_MAX_CM: 300,
  
  // Vídeo
  VIDEO_MAX_SIZE_BYTES: 30 * 1024 * 1024, // 30MB
  VIDEO_MIN_DURATION_SEC: 10,
  VIDEO_MAX_DURATION_SEC: 60,
  VIDEO_MAX_RESOLUTION: 1280,
  
  // Atacado (Wholesale)
  WHOLESALE_MIN_TIERS: 1,
  WHOLESALE_MAX_TIERS: 5,
  WHOLESALE_MIN_QUANTITY: 2,
  
  // Pre-order
  PREORDER_MIN_DAYS: 7,
  PREORDER_MAX_DAYS: 30,
  NORMAL_MIN_DAYS: 1,
  NORMAL_MAX_DAYS: 3,
};

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Valida nome do produto
 */
export function validateItemName(name: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!name || name.trim().length === 0) {
    errors.push('Nome do produto é obrigatório');
  } else {
    const trimmedName = name.trim();
    
    if (trimmedName.length < SHOPEE_LIMITS.ITEM_NAME_MIN) {
      errors.push(`Nome deve ter pelo menos ${SHOPEE_LIMITS.ITEM_NAME_MIN} caracteres (atual: ${trimmedName.length})`);
    }
    
    if (trimmedName.length > SHOPEE_LIMITS.ITEM_NAME_MAX) {
      errors.push(`Nome deve ter no máximo ${SHOPEE_LIMITS.ITEM_NAME_MAX} caracteres (atual: ${trimmedName.length})`);
    }
    
    // Verifica caracteres especiais proibidos
    const forbiddenChars = /[<>]/;
    if (forbiddenChars.test(trimmedName)) {
      errors.push('Nome não pode conter os caracteres < ou >');
    }
    
    // Aviso sobre caracteres que podem causar problemas
    if (/[^\w\s\-.,()áéíóúàèìòùâêîôûãõçÁÉÍÓÚÀÈÌÒÙÂÊÎÔÛÃÕÇ]/i.test(trimmedName)) {
      warnings.push('Nome contém caracteres especiais que podem não ser exibidos corretamente');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Valida descrição do produto
 */
export function validateDescription(description: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!description || description.trim().length === 0) {
    errors.push('Descrição do produto é obrigatória');
  } else {
    const trimmedDesc = description.trim();
    
    if (trimmedDesc.length < SHOPEE_LIMITS.DESCRIPTION_MIN) {
      errors.push(`Descrição deve ter pelo menos ${SHOPEE_LIMITS.DESCRIPTION_MIN} caracteres (atual: ${trimmedDesc.length})`);
    }
    
    if (trimmedDesc.length > SHOPEE_LIMITS.DESCRIPTION_MAX) {
      errors.push(`Descrição deve ter no máximo ${SHOPEE_LIMITS.DESCRIPTION_MAX} caracteres (atual: ${trimmedDesc.length})`);
    }
    
    // Verifica HTML
    if (/<[^>]+>/.test(trimmedDesc)) {
      warnings.push('Descrição contém tags HTML que podem ser removidas pela Shopee');
    }
    
    // Verifica links
    if (/https?:\/\//.test(trimmedDesc)) {
      warnings.push('Links na descrição podem ser removidos pela Shopee');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Valida preço
 */
export function validatePrice(price: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (typeof price !== 'number' || isNaN(price)) {
    errors.push('Preço inválido');
  } else {
    if (price < SHOPEE_LIMITS.PRICE_MIN) {
      errors.push(`Preço mínimo é R$ ${SHOPEE_LIMITS.PRICE_MIN}`);
    }
    
    if (price > SHOPEE_LIMITS.PRICE_MAX) {
      errors.push(`Preço máximo é R$ ${SHOPEE_LIMITS.PRICE_MAX.toLocaleString()}`);
    }
    
    // Aviso sobre preços muito baixos
    if (price < 1) {
      warnings.push('Preço muito baixo pode afetar a visibilidade do produto');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Valida estoque
 */
export function validateStock(stock: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (typeof stock !== 'number' || isNaN(stock)) {
    errors.push('Estoque inválido');
  } else {
    if (stock < SHOPEE_LIMITS.STOCK_MIN) {
      errors.push(`Estoque mínimo é ${SHOPEE_LIMITS.STOCK_MIN}`);
    }
    
    if (stock > SHOPEE_LIMITS.STOCK_MAX) {
      errors.push(`Estoque máximo é ${SHOPEE_LIMITS.STOCK_MAX.toLocaleString()}`);
    }
    
    if (!Number.isInteger(stock)) {
      errors.push('Estoque deve ser um número inteiro');
    }
    
    // Aviso sobre estoque baixo
    if (stock > 0 && stock < 5) {
      warnings.push('Estoque baixo pode afetar a visibilidade do produto');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Valida peso
 */
export function validateWeight(weightKg: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (typeof weightKg !== 'number' || isNaN(weightKg)) {
    errors.push('Peso inválido');
  } else {
    if (weightKg < SHOPEE_LIMITS.WEIGHT_MIN_KG) {
      errors.push(`Peso mínimo é ${SHOPEE_LIMITS.WEIGHT_MIN_KG} kg`);
    }
    
    if (weightKg > SHOPEE_LIMITS.WEIGHT_MAX_KG) {
      errors.push(`Peso máximo é ${SHOPEE_LIMITS.WEIGHT_MAX_KG} kg`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Valida dimensões
 */
export function validateDimensions(dimensoes: { comprimento: number; largura: number; altura: number }): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const { comprimento, largura, altura } = dimensoes;
  
  const validateDimension = (value: number, name: string) => {
    if (typeof value !== 'number' || isNaN(value)) {
      errors.push(`${name} inválido`);
    } else {
      if (value < SHOPEE_LIMITS.DIMENSION_MIN_CM) {
        errors.push(`${name} mínimo é ${SHOPEE_LIMITS.DIMENSION_MIN_CM} cm`);
      }
      if (value > SHOPEE_LIMITS.DIMENSION_MAX_CM) {
        errors.push(`${name} máximo é ${SHOPEE_LIMITS.DIMENSION_MAX_CM} cm`);
      }
    }
  };
  
  validateDimension(comprimento, 'Comprimento');
  validateDimension(largura, 'Largura');
  validateDimension(altura, 'Altura');
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Valida imagens
 */
export function validateImages(imageUrls: string[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!imageUrls || !Array.isArray(imageUrls)) {
    errors.push('Lista de imagens inválida');
  } else {
    if (imageUrls.length < SHOPEE_LIMITS.IMAGES_MIN) {
      errors.push(`Pelo menos ${SHOPEE_LIMITS.IMAGES_MIN} imagem é obrigatória`);
    }
    
    if (imageUrls.length > SHOPEE_LIMITS.IMAGES_MAX) {
      errors.push(`Máximo de ${SHOPEE_LIMITS.IMAGES_MAX} imagens permitidas`);
    }
    
    // Verifica URLs válidas
    imageUrls.forEach((url, index) => {
      if (!url || typeof url !== 'string') {
        errors.push(`Imagem ${index + 1}: URL inválida`);
      } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
        errors.push(`Imagem ${index + 1}: URL deve começar com http:// ou https://`);
      }
    });
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Valida variações
 */
export function validateTierVariations(
  tierVariations: Array<{ tier_name: string; options: Array<{ option_name: string }> }>
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!tierVariations || !Array.isArray(tierVariations)) {
    errors.push('Variações inválidas');
    return { valid: false, errors, warnings };
  }
  
  if (tierVariations.length > SHOPEE_LIMITS.TIER_VARIATIONS_MAX) {
    errors.push(`Máximo de ${SHOPEE_LIMITS.TIER_VARIATIONS_MAX} níveis de variação permitidos`);
  }
  
  tierVariations.forEach((tier, tierIndex) => {
    if (!tier.tier_name || tier.tier_name.trim().length === 0) {
      errors.push(`Variação ${tierIndex + 1}: Nome é obrigatório`);
    }
    
    if (!tier.options || tier.options.length === 0) {
      errors.push(`Variação ${tierIndex + 1}: Pelo menos uma opção é obrigatória`);
    } else if (tier.options.length > SHOPEE_LIMITS.OPTIONS_PER_TIER_MAX) {
      errors.push(`Variação ${tierIndex + 1}: Máximo de ${SHOPEE_LIMITS.OPTIONS_PER_TIER_MAX} opções permitidas`);
    }
    
    // Verifica opções duplicadas
    const optionNames = tier.options.map(o => o.option_name?.toLowerCase().trim());
    const duplicates = optionNames.filter((name, index) => optionNames.indexOf(name) !== index);
    if (duplicates.length > 0) {
      errors.push(`Variação ${tierIndex + 1}: Opções duplicadas encontradas`);
    }
  });
  
  // Calcula total de modelos
  if (tierVariations.length > 0) {
    const totalModels = tierVariations.reduce((acc, tier) => acc * tier.options.length, 1);
    if (totalModels > SHOPEE_LIMITS.MODELS_MAX) {
      errors.push(`Combinação de variações excede o limite de ${SHOPEE_LIMITS.MODELS_MAX} modelos (atual: ${totalModels})`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Valida SKU
 */
export function validateSku(sku: string, isModelSku = false): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const maxLength = isModelSku ? SHOPEE_LIMITS.MODEL_SKU_MAX : SHOPEE_LIMITS.SKU_MAX;
  
  if (sku && sku.length > maxLength) {
    errors.push(`SKU deve ter no máximo ${maxLength} caracteres (atual: ${sku.length})`);
  }
  
  // Verifica caracteres especiais
  if (sku && /[^a-zA-Z0-9\-_]/.test(sku)) {
    warnings.push('SKU contém caracteres especiais que podem causar problemas');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validação completa do produto antes de publicar
 */
export function validateProductForPublish(product: {
  item_name: string;
  description: string;
  price: number;
  stock: number;
  weight: number;
  dimensions: { comprimento: number; largura: number; altura: number };
  images: string[];
  tier_variations?: Array<{ tier_name: string; options: Array<{ option_name: string }> }>;
  item_sku?: string;
  category_id?: number;
}): ValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];
  
  // Valida nome
  const nameResult = validateItemName(product.item_name);
  allErrors.push(...nameResult.errors);
  allWarnings.push(...nameResult.warnings);
  
  // Valida descrição
  const descResult = validateDescription(product.description);
  allErrors.push(...descResult.errors);
  allWarnings.push(...descResult.warnings);
  
  // Valida preço
  const priceResult = validatePrice(product.price);
  allErrors.push(...priceResult.errors);
  allWarnings.push(...priceResult.warnings);
  
  // Valida estoque
  const stockResult = validateStock(product.stock);
  allErrors.push(...stockResult.errors);
  allWarnings.push(...stockResult.warnings);
  
  // Valida peso
  const weightResult = validateWeight(product.weight);
  allErrors.push(...weightResult.errors);
  allWarnings.push(...weightResult.warnings);
  
  // Valida dimensões
  const dimResult = validateDimensions(product.dimensions);
  allErrors.push(...dimResult.errors);
  allWarnings.push(...dimResult.warnings);
  
  // Valida imagens
  const imgResult = validateImages(product.images);
  allErrors.push(...imgResult.errors);
  allWarnings.push(...imgResult.warnings);
  
  // Valida variações (se houver)
  if (product.tier_variations && product.tier_variations.length > 0) {
    const tierResult = validateTierVariations(product.tier_variations);
    allErrors.push(...tierResult.errors);
    allWarnings.push(...tierResult.warnings);
  }
  
  // Valida SKU (se houver)
  if (product.item_sku) {
    const skuResult = validateSku(product.item_sku);
    allErrors.push(...skuResult.errors);
    allWarnings.push(...skuResult.warnings);
  }
  
  // Valida categoria
  if (!product.category_id) {
    allErrors.push('Categoria é obrigatória');
  }
  
  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}

/**
 * Formata nome do produto para atender requisitos mínimos
 */
export function formatItemName(baseName: string, tecidoNome?: string, composicao?: string): string {
  let name = baseName.trim();
  
  // Se o nome é muito curto, adiciona informações
  if (name.length < SHOPEE_LIMITS.ITEM_NAME_MIN) {
    if (tecidoNome && !name.toLowerCase().includes(tecidoNome.toLowerCase())) {
      name = `${tecidoNome} - ${name}`;
    }
    
    if (name.length < SHOPEE_LIMITS.ITEM_NAME_MIN && composicao) {
      name = `${name} ${composicao}`;
    }
    
    // Adiciona texto genérico se ainda for curto
    if (name.length < SHOPEE_LIMITS.ITEM_NAME_MIN) {
      name = `${name} - Tecido de Alta Qualidade`;
    }
  }
  
  // Trunca se muito longo
  if (name.length > SHOPEE_LIMITS.ITEM_NAME_MAX) {
    name = name.substring(0, SHOPEE_LIMITS.ITEM_NAME_MAX - 3) + '...';
  }
  
  return name;
}

/**
 * Formata descrição para atender requisitos mínimos
 */
export function formatDescription(
  baseDescription: string,
  tecidoNome?: string,
  composicao?: string,
  largura?: number
): string {
  let description = baseDescription.trim();
  
  // Se a descrição é muito curta, adiciona informações
  if (description.length < SHOPEE_LIMITS.DESCRIPTION_MIN) {
    const additionalInfo: string[] = [];
    
    if (tecidoNome) {
      additionalInfo.push(`Tecido: ${tecidoNome}`);
    }
    
    if (composicao) {
      additionalInfo.push(`Composição: ${composicao}`);
    }
    
    if (largura) {
      additionalInfo.push(`Largura: ${largura}m`);
    }
    
    // Adiciona texto padrão
    additionalInfo.push('');
    additionalInfo.push('Características:');
    additionalInfo.push('- Tecido de alta qualidade');
    additionalInfo.push('- Ideal para diversos projetos');
    additionalInfo.push('- Cores vibrantes e duradouras');
    additionalInfo.push('');
    additionalInfo.push('Instruções de lavagem:');
    additionalInfo.push('- Lavar à máquina com água fria');
    additionalInfo.push('- Não usar alvejante');
    additionalInfo.push('- Secar à sombra');
    
    description = description + '\n\n' + additionalInfo.join('\n');
  }
  
  // Trunca se muito longo
  if (description.length > SHOPEE_LIMITS.DESCRIPTION_MAX) {
    description = description.substring(0, SHOPEE_LIMITS.DESCRIPTION_MAX - 3) + '...';
  }
  
  return description;
}

/**
 * Valida configuração de atacado (wholesale)
 */
export function validateWholesale(
  wholesale: Array<{ min_count: number; max_count: number; unit_price: number }>
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!wholesale || !Array.isArray(wholesale)) {
    return { valid: true, errors, warnings }; // Opcional, então válido se não fornecido
  }
  
  if (wholesale.length > SHOPEE_LIMITS.WHOLESALE_MAX_TIERS) {
    errors.push(`Máximo de ${SHOPEE_LIMITS.WHOLESALE_MAX_TIERS} faixas de atacado permitidas`);
  }
  
  let previousMax = 0;
  
  wholesale.forEach((tier, index) => {
    // Valida quantidade mínima
    if (tier.min_count < SHOPEE_LIMITS.WHOLESALE_MIN_QUANTITY) {
      errors.push(`Faixa ${index + 1}: Quantidade mínima deve ser pelo menos ${SHOPEE_LIMITS.WHOLESALE_MIN_QUANTITY}`);
    }
    
    // Valida que min < max
    if (tier.min_count >= tier.max_count) {
      errors.push(`Faixa ${index + 1}: Quantidade mínima deve ser menor que máxima`);
    }
    
    // Valida continuidade das faixas
    if (index > 0 && tier.min_count !== previousMax + 1) {
      warnings.push(`Faixa ${index + 1}: Há lacuna entre as faixas de quantidade`);
    }
    
    // Valida preço
    if (tier.unit_price <= 0) {
      errors.push(`Faixa ${index + 1}: Preço unitário deve ser maior que zero`);
    }
    
    previousMax = tier.max_count;
  });
  
  // Verifica se preços são decrescentes (maior quantidade = menor preço)
  for (let i = 1; i < wholesale.length; i++) {
    if (wholesale[i].unit_price >= wholesale[i - 1].unit_price) {
      warnings.push('Preços de atacado geralmente devem diminuir conforme a quantidade aumenta');
      break;
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Valida configuração de pre-order
 */
export function validatePreOrder(
  isPreOrder: boolean,
  daysToShip: number
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (isPreOrder) {
    if (daysToShip < SHOPEE_LIMITS.PREORDER_MIN_DAYS) {
      errors.push(`Pre-order: Dias para envio mínimo é ${SHOPEE_LIMITS.PREORDER_MIN_DAYS}`);
    }
    if (daysToShip > SHOPEE_LIMITS.PREORDER_MAX_DAYS) {
      errors.push(`Pre-order: Dias para envio máximo é ${SHOPEE_LIMITS.PREORDER_MAX_DAYS}`);
    }
  } else {
    if (daysToShip < SHOPEE_LIMITS.NORMAL_MIN_DAYS) {
      errors.push(`Dias para envio mínimo é ${SHOPEE_LIMITS.NORMAL_MIN_DAYS}`);
    }
    if (daysToShip > SHOPEE_LIMITS.NORMAL_MAX_DAYS) {
      errors.push(`Dias para envio máximo é ${SHOPEE_LIMITS.NORMAL_MAX_DAYS}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Valida URL de vídeo
 */
export function validateVideoUrl(videoUrl: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!videoUrl) {
    return { valid: true, errors, warnings }; // Opcional
  }
  
  // Verifica se é URL válida
  if (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
    errors.push('URL do vídeo deve começar com http:// ou https://');
  }
  
  // Verifica extensão
  const extension = videoUrl.split('.').pop()?.toLowerCase();
  if (extension && !['mp4', 'webm'].includes(extension)) {
    warnings.push('Formato de vídeo recomendado é MP4');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Valida atributos obrigatórios
 */
export function validateAttributes(
  attributes: Array<{ attribute_id: number; attribute_value_list: Array<{ value_id?: number; original_value_name?: string }> }>,
  mandatoryAttributeIds: number[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!mandatoryAttributeIds || mandatoryAttributeIds.length === 0) {
    return { valid: true, errors, warnings }; // Sem atributos obrigatórios
  }
  
  const providedAttributeIds = (attributes || []).map(a => a.attribute_id);
  
  mandatoryAttributeIds.forEach(mandatoryId => {
    if (!providedAttributeIds.includes(mandatoryId)) {
      errors.push(`Atributo obrigatório não preenchido (ID: ${mandatoryId})`);
    }
  });
  
  // Verifica se atributos fornecidos têm valores
  (attributes || []).forEach(attr => {
    if (!attr.attribute_value_list || attr.attribute_value_list.length === 0) {
      errors.push(`Atributo ${attr.attribute_id} não tem valor definido`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Valida logística
 */
export function validateLogistics(
  logisticInfo: Array<{ logistic_id: number; enabled: boolean }>
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!logisticInfo || !Array.isArray(logisticInfo)) {
    errors.push('Informações de logística são obrigatórias');
    return { valid: false, errors, warnings };
  }
  
  const enabledChannels = logisticInfo.filter(l => l.enabled);
  
  if (enabledChannels.length === 0) {
    errors.push('Pelo menos um canal de logística deve estar habilitado');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validação completa e estendida do produto
 */
export function validateProductComplete(product: {
  item_name: string;
  description: string;
  price: number;
  stock: number;
  weight: number;
  dimensions: { comprimento: number; largura: number; altura: number };
  images: string[];
  tier_variations?: Array<{ tier_name: string; options: Array<{ option_name: string }> }>;
  item_sku?: string;
  category_id?: number;
  logistic_info?: Array<{ logistic_id: number; enabled: boolean }>;
  is_pre_order?: boolean;
  days_to_ship?: number;
  video_url?: string;
  wholesale?: Array<{ min_count: number; max_count: number; unit_price: number }>;
  attributes?: Array<{ attribute_id: number; attribute_value_list: Array<{ value_id?: number }> }>;
  mandatory_attribute_ids?: number[];
}): ValidationResult {
  // Usa validação básica
  const basicResult = validateProductForPublish({
    item_name: product.item_name,
    description: product.description,
    price: product.price,
    stock: product.stock,
    weight: product.weight,
    dimensions: product.dimensions,
    images: product.images,
    tier_variations: product.tier_variations,
    item_sku: product.item_sku,
    category_id: product.category_id,
  });
  
  const allErrors = [...basicResult.errors];
  const allWarnings = [...basicResult.warnings];
  
  // Valida logística
  if (product.logistic_info) {
    const logResult = validateLogistics(product.logistic_info);
    allErrors.push(...logResult.errors);
    allWarnings.push(...logResult.warnings);
  } else {
    allErrors.push('Informações de logística são obrigatórias');
  }
  
  // Valida pre-order
  if (product.is_pre_order !== undefined) {
    const preOrderResult = validatePreOrder(
      product.is_pre_order,
      product.days_to_ship || (product.is_pre_order ? 7 : 2)
    );
    allErrors.push(...preOrderResult.errors);
    allWarnings.push(...preOrderResult.warnings);
  }
  
  // Valida vídeo
  if (product.video_url) {
    const videoResult = validateVideoUrl(product.video_url);
    allErrors.push(...videoResult.errors);
    allWarnings.push(...videoResult.warnings);
  }
  
  // Valida atacado
  if (product.wholesale) {
    const wholesaleResult = validateWholesale(product.wholesale);
    allErrors.push(...wholesaleResult.errors);
    allWarnings.push(...wholesaleResult.warnings);
  }
  
  // Valida atributos
  if (product.mandatory_attribute_ids && product.mandatory_attribute_ids.length > 0) {
    const attrResult = validateAttributes(
      product.attributes || [],
      product.mandatory_attribute_ids
    );
    allErrors.push(...attrResult.errors);
    allWarnings.push(...attrResult.warnings);
  }
  
  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}
