export type GramaturaUnidade = 'g_m2' | 'g_m_linear';

export interface TecidoMetricasInput {
  larguraMetros?: number;
  rendimentoPorKg?: number;
  gramaturaValor?: number;
  gramaturaUnidade?: GramaturaUnidade;
}

export interface TecidoMetricasCalculadas {
  rendimentoPorKg?: number;
  gramaturaGm2?: number;
  gramaturaGmLinear?: number;
  source: 'rendimento' | 'gramatura_m2' | 'gramatura_linear' | 'none';
}

const GRAMAS_POR_KG = 1000;

function isPositive(value?: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundNearestTen(value: number): number {
  return Math.round(value / 10) * 10;
}

export function calculateTecidoMetricas(input: TecidoMetricasInput): TecidoMetricasCalculadas {
  const largura = input.larguraMetros;
  const rendimento = input.rendimentoPorKg;
  const gramaturaValor = input.gramaturaValor;
  const gramaturaUnidade = input.gramaturaUnidade;

  if (isPositive(rendimento)) {
    const gramaturaLinear = GRAMAS_POR_KG / rendimento;
    const gramaturaM2 = isPositive(largura) ? gramaturaLinear / largura : undefined;

    return {
      rendimentoPorKg: round2(rendimento),
      gramaturaGm2: isPositive(gramaturaM2) ? roundNearestTen(gramaturaM2) : undefined,
      gramaturaGmLinear: roundNearestTen(gramaturaLinear),
      source: 'rendimento',
    };
  }

  if (isPositive(gramaturaValor)) {
    if (gramaturaUnidade === 'g_m_linear') {
      const gramaturaLinear = gramaturaValor;
      const rendimentoCalculado = GRAMAS_POR_KG / gramaturaLinear;
      const gramaturaM2 = isPositive(largura) ? gramaturaLinear / largura : undefined;

      return {
        rendimentoPorKg: round2(rendimentoCalculado),
        gramaturaGm2: isPositive(gramaturaM2) ? roundNearestTen(gramaturaM2) : undefined,
        gramaturaGmLinear: roundNearestTen(gramaturaLinear),
        source: 'gramatura_linear',
      };
    }

    if (gramaturaUnidade === 'g_m2' && isPositive(largura)) {
      const gramaturaM2 = gramaturaValor;
      const gramaturaLinear = gramaturaM2 * largura;
      const rendimentoCalculado = GRAMAS_POR_KG / gramaturaLinear;

      return {
        rendimentoPorKg: round2(rendimentoCalculado),
        gramaturaGm2: roundNearestTen(gramaturaM2),
        gramaturaGmLinear: roundNearestTen(gramaturaLinear),
        source: 'gramatura_m2',
      };
    }
  }

  return {
    source: 'none',
  };
}
