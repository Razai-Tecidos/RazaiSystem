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
    expect(price).toBe(41.46);
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
    expect(price).toBe(37.31);
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
    expect(price).toBe(24.1);
  });

  it('calcula preco com margem fixa em reais por metro', () => {
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
    expect(price).toBe(69.43);
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
    expect(price).toBe(2.91);
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

    expect(prices['1']).toBe(5.77);
    expect(prices['3']).toBe(14.74);
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

    expect(prices['1']).toBe(20.53);
    expect(prices['2']).toBe(51.39);
  });

  it('atinge lucro liquido total esperado quando margem fixa e por metro', () => {
    const params = {
      ...DEFAULT_CNPJ_PRICING_PARAMS,
      modo_margem_lucro: 'valor_fixo' as const,
      aplicar_teto: false,
      aplicar_baixo_valor: false,
      custo_metro: 10,
      comissao_percentual: 20,
      taxa_fixa_item: 4,
    };

    const margins = [
      { metros: 1, margemPorMetro: 5, lucroEsperadoTotal: 5 },
      { metros: 2, margemPorMetro: 4, lucroEsperadoTotal: 8 },
      { metros: 3, margemPorMetro: 3, lucroEsperadoTotal: 9 },
    ];

    margins.forEach(({ metros, margemPorMetro, lucroEsperadoTotal }) => {
      const price = calculateSuggestedPrice({
        ...params,
        margem_lucro_fixa: margemPorMetro,
      }, metros);

      const netProfit = calculateNetProfitReais(params, metros, price);
      expect(netProfit).toBeCloseTo(lucroEsperadoTotal, 2);
    });
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
    expect(netProfit).toBe(4.22);
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
    expect(netProfit).toBe(12.01);
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
    expect(netProfit).toBe(3.46);
  });

  it('arredonda para cima preferindo centavos ,50 ou ,90', () => {
    expect(roundUpToPreferredCents(23.33)).toBe(23.5);
    expect(roundUpToPreferredCents(23.51)).toBe(23.9);
    expect(roundUpToPreferredCents(23.91)).toBe(24.5);
    expect(roundUpToPreferredCents(23.9)).toBe(23.9);
  });
});
