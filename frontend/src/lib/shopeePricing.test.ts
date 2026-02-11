import {
  calculateLengthPrices,
  calculateNetProfitReais,
  roundUpToPreferredCents,
  calculateSuggestedPrice,
  DEFAULT_CNPJ_PRICING_PARAMS,
  ShopeeMarginOverridesByLength,
  validatePricingParams,
} from './shopeePricing';

describe('shopeePricing', () => {
  it('calcula preco sem teto', () => {
    const params = {
      ...DEFAULT_CNPJ_PRICING_PARAMS,
      aplicar_teto: false,
      aplicar_baixo_valor: false,
      custo_metro: 10,
      margem_liquida_percentual: 20,
      comissao_percentual: 20,
      taxa_fixa_item: 4,
    };

    const price = calculateSuggestedPrice(params, 2);
    expect(price).toBe(40);
  });

  it('calcula preco com teto', () => {
    const params = {
      ...DEFAULT_CNPJ_PRICING_PARAMS,
      aplicar_teto: true,
      aplicar_baixo_valor: false,
      custo_metro: 10,
      margem_liquida_percentual: 20,
      taxa_fixa_item: 4,
      teto_comissao: 5,
    };

    const price = calculateSuggestedPrice(params, 2);
    expect(price).toBe(36.25);
  });

  it('nao infla preco quando teto e alto e comissao percentual fica abaixo dele', () => {
    const params = {
      ...DEFAULT_CNPJ_PRICING_PARAMS,
      aplicar_teto: true,
      aplicar_baixo_valor: false,
      custo_metro: 10,
      margem_liquida_percentual: 20,
      comissao_percentual: 20,
      taxa_fixa_item: 4,
      teto_comissao: 100,
    };

    const price = calculateSuggestedPrice(params, 1);
    expect(price).toBe(23.33);
  });

  it('calcula preco com margem fixa em reais', () => {
    const params = {
      ...DEFAULT_CNPJ_PRICING_PARAMS,
      modo_margem_lucro: 'valor_fixo' as const,
      margem_lucro_fixa: 15,
      aplicar_teto: false,
      aplicar_baixo_valor: false,
      custo_metro: 10,
      comissao_percentual: 20,
      taxa_fixa_item: 4,
    };

    const price = calculateSuggestedPrice(params, 2);
    expect(price).toBe(48.75);
  });

  it('recalcula com adicional de baixo valor quando preco inicial fica abaixo do minimo', () => {
    const params = {
      ...DEFAULT_CNPJ_PRICING_PARAMS,
      aplicar_teto: false,
      aplicar_baixo_valor: true,
      custo_metro: 1,
      margem_liquida_percentual: 10,
      comissao_percentual: 20,
      taxa_fixa_item: 0,
      valor_minimo_baixo_valor: 8,
      adicional_baixo_valor: 1,
    };

    const price = calculateSuggestedPrice(params, 1);
    expect(price).toBe(2.86);
  });

  it('falha com denominador invalido', () => {
    const params = {
      ...DEFAULT_CNPJ_PRICING_PARAMS,
      aplicar_teto: false,
      margem_liquida_percentual: 40,
      comissao_percentual: 60,
    };

    expect(() => calculateSuggestedPrice(params, 1)).toThrow('denominador <= 0');
  });

  it('arredonda para 2 casas e calcula lote por comprimentos', () => {
    const params = {
      ...DEFAULT_CNPJ_PRICING_PARAMS,
      aplicar_teto: false,
      aplicar_baixo_valor: false,
      custo_metro: 3.333,
      margem_liquida_percentual: 11,
      comissao_percentual: 12,
      taxa_fixa_item: 0.99,
    };

    const prices = calculateLengthPrices(params, [
      { id: '1', metros: 1 },
      { id: '3', metros: 3 },
    ]);

    expect(prices['1']).toBe(5.61);
    expect(prices['3']).toBe(14.27);
  });

  it('permite margem por tamanho com override de modo e valor', () => {
    const params = {
      ...DEFAULT_CNPJ_PRICING_PARAMS,
      modo_margem_lucro: 'percentual' as const,
      margem_liquida_percentual: 20,
      aplicar_teto: false,
      aplicar_baixo_valor: false,
      custo_metro: 10,
      comissao_percentual: 20,
      taxa_fixa_item: 4,
    };

    const marginOverrides: ShopeeMarginOverridesByLength = {
      '1': { modo: 'percentual', valor: 10 },
      '2': { modo: 'valor_fixo', valor: 8 },
    };

    const prices = calculateLengthPrices(params, [
      { id: '1', metros: 1 },
      { id: '2', metros: 2 },
    ], marginOverrides);

    expect(prices['1']).toBe(20);
    expect(prices['2']).toBe(40);
  });

  it('valida limites e campos invalidos', () => {
    const errors = validatePricingParams({
      ...DEFAULT_CNPJ_PRICING_PARAMS,
      custo_metro: -1,
      margem_liquida_percentual: 100,
      modo_margem_lucro: 'valor_fixo',
      margem_lucro_fixa: -1,
      comissao_percentual: -5,
      taxa_fixa_item: -1,
      valor_minimo_baixo_valor: -1,
      adicional_baixo_valor: -1,
      teto_comissao: 0,
      aplicar_teto: true,
    });

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join(' ')).toContain('Custo por metro');
    expect(errors.join(' ')).toContain('Margem liquida');
  });

  it('calcula lucro liquido em reais sem teto acionado', () => {
    const params = {
      ...DEFAULT_CNPJ_PRICING_PARAMS,
      aplicar_teto: true,
      aplicar_baixo_valor: false,
      custo_metro: 10,
      comissao_percentual: 20,
      taxa_fixa_item: 4,
      teto_comissao: 100,
    };

    const netProfit = calculateNetProfitReais(params, 1, 23.33);
    expect(netProfit).toBe(4.66);
  });

  it('calcula lucro liquido em reais com teto de comissao acionado', () => {
    const params = {
      ...DEFAULT_CNPJ_PRICING_PARAMS,
      aplicar_teto: true,
      aplicar_baixo_valor: false,
      custo_metro: 10,
      comissao_percentual: 20,
      taxa_fixa_item: 4,
      teto_comissao: 3,
    };

    const netProfit = calculateNetProfitReais(params, 2, 40);
    expect(netProfit).toBe(13);
  });

  it('calcula lucro liquido em reais com adicional de baixo valor', () => {
    const params = {
      ...DEFAULT_CNPJ_PRICING_PARAMS,
      aplicar_teto: false,
      aplicar_baixo_valor: true,
      custo_metro: 1,
      comissao_percentual: 20,
      taxa_fixa_item: 0,
      valor_minimo_baixo_valor: 8,
      adicional_baixo_valor: 1,
    };

    const netProfit = calculateNetProfitReais(params, 1, 7);
    expect(netProfit).toBe(3.6);
  });

  it('arredonda para cima preferindo centavos ,50 ou ,90', () => {
    expect(roundUpToPreferredCents(23.33)).toBe(23.5);
    expect(roundUpToPreferredCents(23.51)).toBe(23.9);
    expect(roundUpToPreferredCents(23.91)).toBe(24.5);
    expect(roundUpToPreferredCents(23.9)).toBe(23.9);
  });
});
