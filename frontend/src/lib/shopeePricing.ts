export type ShopeeMarginMode = 'percentual' | 'valor_fixo';

export interface ShopeeMarginConfig {
  modo: ShopeeMarginMode;
  valor: number;
}

export type ShopeeMarginOverridesByLength = Record<string, ShopeeMarginConfig>;

export interface ShopeePricingParams {
  custo_metro: number;
  margem_liquida_percentual: number;
  modo_margem_lucro: ShopeeMarginMode;
  margem_lucro_fixa: number;
  comissao_percentual: number;
  taxa_fixa_item: number;
  valor_minimo_baixo_valor: number;
  adicional_baixo_valor: number;
  teto_comissao: number;
  aplicar_teto: boolean;
  aplicar_baixo_valor: boolean;
}

export interface ShopeePricingLength {
  id: string;
  metros: number;
}

function calculateCommissionForPrice(
  params: ShopeePricingParams,
  sellingPrice: number
): number {
  const percentualCommission = sellingPrice * (params.comissao_percentual / 100);
  if (!params.aplicar_teto) {
    return percentualCommission;
  }
  return Math.min(percentualCommission, params.teto_comissao);
}

function calculateLowValueExtraForPrice(
  params: ShopeePricingParams,
  sellingPrice: number
): number {
  if (!params.aplicar_baixo_valor) {
    return 0;
  }
  return sellingPrice < params.valor_minimo_baixo_valor
    ? params.adicional_baixo_valor
    : 0;
}

export const DEFAULT_CNPJ_PRICING_PARAMS: ShopeePricingParams = {
  custo_metro: 0,
  margem_liquida_percentual: 20,
  modo_margem_lucro: 'percentual',
  margem_lucro_fixa: 0,
  comissao_percentual: 20,
  taxa_fixa_item: 4,
  valor_minimo_baixo_valor: 8,
  adicional_baixo_valor: 1,
  teto_comissao: 100,
  aplicar_teto: true,
  aplicar_baixo_valor: true,
};

function roundToCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function roundUpToPreferredCents(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  const integerPart = Math.floor(value);
  const cents = value - integerPart;
  const epsilon = 1e-9;

  const candidate50 = cents <= 0.5 + epsilon
    ? integerPart + 0.5
    : integerPart + 1.5;

  const candidate90 = cents <= 0.9 + epsilon
    ? integerPart + 0.9
    : integerPart + 1.9;

  const rounded = (candidate50 - value) <= (candidate90 - value)
    ? candidate50
    : candidate90;

  return roundToCents(rounded);
}

export function validatePricingParams(params: ShopeePricingParams): string[] {
  const errors: string[] = [];

  if (params.custo_metro < 0) {
    errors.push('Custo por metro deve ser maior ou igual a zero.');
  }

  if (params.modo_margem_lucro === 'percentual') {
    if (params.margem_liquida_percentual < 0 || params.margem_liquida_percentual >= 100) {
      errors.push('Margem liquida percentual deve estar entre 0 e 99.99%.');
    }
  } else if (params.modo_margem_lucro === 'valor_fixo') {
    if (params.margem_lucro_fixa < 0) {
      errors.push('Margem liquida fixa deve ser maior ou igual a zero.');
    }
  } else {
    errors.push('Modo de margem invalido.');
  }

  if (params.comissao_percentual < 0 || params.comissao_percentual >= 100) {
    errors.push('Comissao deve estar entre 0 e 99.99%.');
  }

  if (params.taxa_fixa_item < 0) {
    errors.push('Taxa fixa por item deve ser maior ou igual a zero.');
  }

  if (params.valor_minimo_baixo_valor < 0) {
    errors.push('Valor minimo de baixo valor deve ser maior ou igual a zero.');
  }

  if (params.adicional_baixo_valor < 0) {
    errors.push('Adicional de baixo valor deve ser maior ou igual a zero.');
  }

  if (params.aplicar_teto && params.teto_comissao <= 0) {
    errors.push('Teto de comissao deve ser maior que zero quando ativo.');
  }

  const commission = params.comissao_percentual / 100;

  if (params.modo_margem_lucro === 'percentual') {
    const margin = params.margem_liquida_percentual / 100;
    if (params.aplicar_teto) {
      if (1 - margin <= 0) {
        errors.push('Parametros invalidos: margem deixa denominador <= 0 com teto ativo.');
      }
    } else if (1 - margin - commission <= 0) {
      errors.push('Parametros invalidos: margem + comissao deixam denominador <= 0.');
    }
  } else if (!params.aplicar_teto && 1 - commission <= 0) {
    errors.push('Parametros invalidos: comissao deixa denominador <= 0.');
  }

  return errors;
}

function solvePrice(
  params: ShopeePricingParams,
  materialCost: number,
  lowValueExtra: number,
  marginConfig: ShopeeMarginConfig
): number {
  const commission = params.comissao_percentual / 100;
  const fixed = params.taxa_fixa_item;
  const isPercent = marginConfig.modo === 'percentual';
  const margin = isPercent ? marginConfig.valor / 100 : 0;
  const marginFixed = isPercent ? 0 : marginConfig.valor;
  const baseCost = materialCost + fixed + lowValueExtra;

  const solveWithoutCeiling = (): number => {
    const denominator = isPercent ? 1 - commission - margin : 1 - commission;
    if (denominator <= 0) {
      throw new Error('Denominador invalido para calculo sem teto.');
    }
    return (baseCost + marginFixed) / denominator;
  };

  if (!params.aplicar_teto) {
    return solveWithoutCeiling();
  }

  const uncappedPrice = solveWithoutCeiling();
  if (uncappedPrice * commission <= params.teto_comissao) {
    return uncappedPrice;
  }

  if (isPercent) {
    const denominator = 1 - margin;
    if (denominator <= 0) {
      throw new Error('Denominador invalido para calculo com teto.');
    }
    return (baseCost + params.teto_comissao) / denominator;
  }

  return baseCost + marginFixed + params.teto_comissao;
}

function resolveMarginConfig(
  params: ShopeePricingParams,
  marginOverride?: ShopeeMarginConfig
): ShopeeMarginConfig {
  if (marginOverride) {
    return marginOverride;
  }

  if (params.modo_margem_lucro === 'valor_fixo') {
    return {
      modo: 'valor_fixo',
      valor: params.margem_lucro_fixa,
    };
  }

  return {
    modo: 'percentual',
    valor: params.margem_liquida_percentual,
  };
}

function validateMarginConfig(marginConfig: ShopeeMarginConfig): string | null {
  if (marginConfig.modo === 'percentual') {
    if (marginConfig.valor < 0 || marginConfig.valor >= 100) {
      return 'Margem liquida percentual deve estar entre 0 e 99.99%.';
    }
    return null;
  }

  if (marginConfig.modo === 'valor_fixo') {
    if (marginConfig.valor < 0) {
      return 'Margem liquida fixa deve ser maior ou igual a zero.';
    }
    return null;
  }

  return 'Modo de margem invalido.';
}

export function calculateSuggestedPrice(
  params: ShopeePricingParams,
  comprimentoMetros: number,
  marginOverride?: ShopeeMarginConfig
): number {
  const validationErrors = validatePricingParams(params);
  if (validationErrors.length > 0) {
    throw new Error(validationErrors[0]);
  }

  const marginConfig = resolveMarginConfig(params, marginOverride);
  const marginValidationError = validateMarginConfig(marginConfig);
  if (marginValidationError) {
    throw new Error(marginValidationError);
  }

  const materialCost = params.custo_metro * comprimentoMetros;
  let result = solvePrice(params, materialCost, 0, marginConfig);

  if (params.aplicar_baixo_valor && result < params.valor_minimo_baixo_valor) {
    result = solvePrice(params, materialCost, params.adicional_baixo_valor, marginConfig);
  }

  return roundToCents(result);
}

export function calculateLengthPrices(
  params: ShopeePricingParams,
  comprimentos: readonly ShopeePricingLength[],
  marginOverridesByLength: ShopeeMarginOverridesByLength = {}
): Record<string, number> {
  return comprimentos.reduce<Record<string, number>>((acc, comprimento) => {
    acc[comprimento.id] = calculateSuggestedPrice(
      params,
      comprimento.metros,
      marginOverridesByLength[comprimento.id]
    );
    return acc;
  }, {});
}

export function calculateNetProfitReais(
  params: ShopeePricingParams,
  comprimentoMetros: number,
  sellingPrice: number
): number {
  const validationErrors = validatePricingParams(params);
  if (validationErrors.length > 0) {
    throw new Error(validationErrors[0]);
  }

  if (sellingPrice < 0) {
    throw new Error('Preco de venda deve ser maior ou igual a zero.');
  }

  const materialCost = params.custo_metro * comprimentoMetros;
  const commission = calculateCommissionForPrice(params, sellingPrice);
  const lowValueExtra = calculateLowValueExtraForPrice(params, sellingPrice);
  const netProfit = sellingPrice - commission - params.taxa_fixa_item - lowValueExtra - materialCost;

  return roundToCents(netProfit);
}
