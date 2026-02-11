import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer';
import { TecidoComVinculos } from '@/lib/firebase/catalogos';
import { TecidoComEstampas } from '@/pages/Catalogo';
import { CorTecido } from '@/types/cor.types';
import { Estampa } from '@/types/estampa.types';
import { Tecido } from '@/types/tecido.types';
import { calculateTecidoMetricas } from '@/lib/tecidoMetrics';

// ============================================================================
// CONFIGURACOES DE LAYOUT - A4
// ============================================================================

// Margens
const MARGIN = {
  top: 40,
  bottom: 50,
  left: 40,
  right: 40,
};

// Dimensoes da pagina A4 em points
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

// Footer
const FOOTER_HEIGHT = 25;

// Grid de cores: 3 colunas x 3 linhas = 9 cores por pagina
const COLS = 3;
const ROWS = 3;
const COL_GAP = 10;
const MIN_ROW_GAP = 10;
const CORES_POR_PAGINA = COLS * ROWS;

// Grid de estampas: 3 colunas x 3 linhas = 9 estampas por pagina
const ESTAMPAS_POR_PAGINA = COLS * ROWS;

const CONTENT_WIDTH = A4_WIDTH - MARGIN.left - MARGIN.right;
const CONTENT_HEIGHT = A4_HEIGHT - MARGIN.top - MARGIN.bottom;
const HEADER_MARGIN_BOTTOM = 12;
const GRID_BOTTOM_SAFE_SPACE = 10;
const CARD_INFO_HEIGHT = 24;

// 3 colunas usando toda largura util da pagina
const CARD_SIZE = Number(
  ((CONTENT_WIDTH - COL_GAP * (COLS - 1)) / COLS).toFixed(2)
);

// Header do grupo de tecido
const TECIDO_HEADER_HEIGHT = 70;

// Preenche melhor a altura util quando houver pagina cheia (3x3)
const FULL_GRID_AVAILABLE_HEIGHT =
  CONTENT_HEIGHT -
  TECIDO_HEADER_HEIGHT -
  HEADER_MARGIN_BOTTOM -
  FOOTER_HEIGHT -
  GRID_BOTTOM_SAFE_SPACE;
const FULL_GRID_ROW_GAP = Number(
  Math.max(
    MIN_ROW_GAP,
    (FULL_GRID_AVAILABLE_HEIGHT - ROWS * (CARD_SIZE + CARD_INFO_HEIGHT)) /
      (ROWS - 1)
  ).toFixed(2)
);

// ============================================================================
// ESTILOS
// ============================================================================

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    paddingTop: MARGIN.top,
    paddingBottom: MARGIN.bottom,
    paddingLeft: MARGIN.left,
    paddingRight: MARGIN.right,
  },

  // Header do tecido (maior e com mais informações)
  tecidoHeader: {
    height: TECIDO_HEADER_HEIGHT,
    marginBottom: HEADER_MARGIN_BOTTOM,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tecidoNomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  tecidoNome: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  tecidoSku: {
    fontSize: 10,
    color: '#888888',
    marginLeft: 10,
  },
  tecidoCount: {
    fontSize: 9,
    color: '#aaaaaa',
    marginLeft: 'auto',
  },
  tecidoDetalhes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tecidoDetalheItem: {
    flexDirection: 'row',
    width: '50%',
    marginBottom: 2,
  },
  tecidoDetalheLabel: {
    fontSize: 8,
    color: '#888888',
    marginRight: 4,
  },
  tecidoDetalheValue: {
    fontSize: 8,
    color: '#555555',
  },

  // Grid de cores/estampas
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  // Card de cor
  colorCard: {
    width: CARD_SIZE,
  },
  colorImage: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    backgroundColor: '#f5f5f5',
    marginBottom: 4,
  },
  colorImageContent: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  colorSwatch: {
    width: '100%',
    height: '100%',
  },
  colorInfo: {
    paddingHorizontal: 2,
    minHeight: CARD_INFO_HEIGHT,
  },
  colorNome: {
    fontSize: 8,
    color: '#333333',
    marginBottom: 2,
  },
  colorSku: {
    fontSize: 7,
    color: '#888888',
  },

  // Card de estampa (mesmo tamanho que cor)
  estampaCard: {
    width: CARD_SIZE,
  },
  estampaImage: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    backgroundColor: '#f5f5f5',
    marginBottom: 4,
  },
  estampaImageContent: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  estampaPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e8e0f0',
  },
  estampaInfo: {
    paddingHorizontal: 2,
    minHeight: CARD_INFO_HEIGHT,
  },
  estampaNome: {
    fontSize: 8,
    color: '#333333',
    marginBottom: 2,
  },
  estampaSku: {
    fontSize: 7,
    color: '#888888',
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: MARGIN.bottom - 15,
    left: MARGIN.left,
    right: MARGIN.right,
    height: FOOTER_HEIGHT,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 6,
  },
  footerBrand: {
    fontSize: 7,
    color: '#cccccc',
    letterSpacing: 1,
  },
  footerPage: {
    fontSize: 7,
    color: '#aaaaaa',
  },

  // Capa - logo centralizado com proporção correta
  coverPage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  coverLogoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverLogo: {
    width: 320,
    height: 320,
    objectFit: 'contain',
  },

  // Separador de seção
  sectionDivider: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  sectionTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a1a',
    letterSpacing: 2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#888888',
    marginTop: 8,
  },
});

// ============================================================================
// HELPERS
// ============================================================================

function truncate(text: string, max: number): string {
  if (!text) return '';
  return text.length > max ? text.substring(0, max - 2) + '..' : text;
}

function formatLargura(largura: number): string {
  return largura.toFixed(2).replace('.', ',') + 'm';
}

function formatDecimal(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

function cardSpacingStyle(index: number, totalItems: number) {
  const totalRows = Math.ceil(totalItems / COLS);
  const currentRow = Math.floor(index / COLS);
  const isLastRow = currentRow === totalRows - 1;
  const isLastCol = index % COLS === COLS - 1;
  const rowGap = totalRows === ROWS ? FULL_GRID_ROW_GAP : MIN_ROW_GAP;

  return {
    marginRight: isLastCol ? 0 : COL_GAP,
    marginBottom: isLastRow ? 0 : rowGap,
  };
}

// ============================================================================
// ESTRUTURA DE PÁGINAS
// ============================================================================

interface PaginaCores {
  tipo: 'cores';
  tecido: Tecido;
  cores: CorTecido[];
  continuacao?: boolean;
  totalCoresDoTecido: number;
}

interface PaginaEstampas {
  tipo: 'estampas';
  tecido: Tecido;
  estampas: Estampa[];
  continuacao?: boolean;
  totalEstampasDoTecido: number;
}

/**
 * Divide os vínculos em páginas, respeitando o limite de cores por página
 */
function criarPaginasCores(tecidosComVinculos: TecidoComVinculos[]): PaginaCores[] {
  const paginas: PaginaCores[] = [];

  for (const { tecido, vinculos } of tecidosComVinculos) {
    for (let i = 0; i < vinculos.length; i += CORES_POR_PAGINA) {
      const chunk = vinculos.slice(i, i + CORES_POR_PAGINA);
      paginas.push({
        tipo: 'cores',
        tecido,
        cores: chunk,
        continuacao: i > 0,
        totalCoresDoTecido: vinculos.length,
      });
    }
  }

  return paginas;
}

/**
 * Divide as estampas em páginas
 */
function criarPaginasEstampas(tecidosComEstampas: TecidoComEstampas[]): PaginaEstampas[] {
  const paginas: PaginaEstampas[] = [];

  for (const { tecido, estampas } of tecidosComEstampas) {
    for (let i = 0; i < estampas.length; i += ESTAMPAS_POR_PAGINA) {
      const chunk = estampas.slice(i, i + ESTAMPAS_POR_PAGINA);
      paginas.push({
        tipo: 'estampas',
        tecido,
        estampas: chunk,
        continuacao: i > 0,
        totalEstampasDoTecido: estampas.length,
      });
    }
  }

  return paginas;
}

// ============================================================================
// COMPONENTES
// ============================================================================

interface CatalogoPdfDocumentProps {
  tecidosComVinculos: TecidoComVinculos[];
  tecidosComEstampas?: TecidoComEstampas[];
}

/**
 * Card individual de cor
 */
function ColorCard({
  vinculo,
  index,
  totalItems,
}: {
  vinculo: CorTecido;
  index: number;
  totalItems: number;
}) {
  const imagemCatalogo = vinculo.imagemGerada || vinculo.imagemTingida;

  return (
    <View style={[styles.colorCard, cardSpacingStyle(index, totalItems)]} wrap={false}>
      <View style={styles.colorImage}>
        {imagemCatalogo ? (
          <Image src={imagemCatalogo} style={styles.colorImageContent} />
        ) : (
          <View
            style={[
              styles.colorSwatch,
              { backgroundColor: vinculo.corHex || '#cccccc' },
            ]}
          />
        )}
      </View>

      <View style={styles.colorInfo}>
        <Text style={styles.colorNome}>{truncate(vinculo.corNome || '', 18)}</Text>
        {vinculo.sku && <Text style={styles.colorSku}>{vinculo.sku}</Text>}
      </View>
    </View>
  );
}

/**
 * Card individual de estampa
 */
function EstampaCard({
  estampa,
  index,
  totalItems,
}: {
  estampa: Estampa;
  index: number;
  totalItems: number;
}) {
  return (
    <View style={[styles.estampaCard, cardSpacingStyle(index, totalItems)]} wrap={false}>
      <View style={styles.estampaImage}>
        {estampa.imagem ? (
          <Image src={estampa.imagem} style={styles.estampaImageContent} />
        ) : (
          <View style={styles.estampaPlaceholder} />
        )}
      </View>

      <View style={styles.estampaInfo}>
        <Text style={styles.estampaNome}>{truncate(estampa.nome || '', 18)}</Text>
        {estampa.sku && <Text style={styles.estampaSku}>{estampa.sku}</Text>}
      </View>
    </View>
  );
}

/**
 * Header do grupo de tecido para cores
 */
function TecidoHeaderCores({
  tecido,
  count,
  continuacao,
}: {
  tecido: Tecido;
  count: number;
  continuacao?: boolean;
}) {
  const metricas = calculateTecidoMetricas({
    larguraMetros: tecido.largura,
    rendimentoPorKg: tecido.rendimentoPorKg,
    gramaturaValor: tecido.gramaturaValor,
    gramaturaUnidade: tecido.gramaturaUnidade,
  });

  return (
    <View style={styles.tecidoHeader}>
      <View style={styles.tecidoNomeRow}>
        <Text style={styles.tecidoNome}>
          {tecido.nome} {continuacao && '(cont.)'}
        </Text>
        <Text style={styles.tecidoSku}>{tecido.sku}</Text>
        {!continuacao && (
          <Text style={styles.tecidoCount}>
            {count} {count === 1 ? 'cor' : 'cores'}
          </Text>
        )}
      </View>

      <View style={styles.tecidoDetalhes}>
        <View style={styles.tecidoDetalheItem}>
          <Text style={styles.tecidoDetalheLabel}>Largura:</Text>
          <Text style={styles.tecidoDetalheValue}>{formatLargura(tecido.largura)}</Text>
        </View>
        {typeof metricas.rendimentoPorKg === 'number' && (
          <View style={styles.tecidoDetalheItem}>
            <Text style={styles.tecidoDetalheLabel}>Rendimento:</Text>
            <Text style={styles.tecidoDetalheValue}>{formatDecimal(metricas.rendimentoPorKg)}m/kg</Text>
          </View>
        )}
        {typeof metricas.gramaturaGm2 === 'number' && (
          <View style={styles.tecidoDetalheItem}>
            <Text style={styles.tecidoDetalheLabel}>Gramatura:</Text>
            <Text style={styles.tecidoDetalheValue}>{formatDecimal(metricas.gramaturaGm2)}g/m2</Text>
          </View>
        )}
        {typeof metricas.gramaturaGmLinear === 'number' && (
          <View style={styles.tecidoDetalheItem}>
            <Text style={styles.tecidoDetalheLabel}>Peso linear:</Text>
            <Text style={styles.tecidoDetalheValue}>{formatDecimal(metricas.gramaturaGmLinear)}g/m</Text>
          </View>
        )}
        {tecido.composicao && (
          <View style={styles.tecidoDetalheItem}>
            <Text style={styles.tecidoDetalheLabel}>Composicao:</Text>
            <Text style={styles.tecidoDetalheValue}>{truncate(tecido.composicao, 50)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
/**
 * Header do grupo de tecido para estampas
 */
function TecidoHeaderEstampas({
  tecido,
  count,
  continuacao,
}: {
  tecido: Tecido;
  count: number;
  continuacao?: boolean;
}) {
  const metricas = calculateTecidoMetricas({
    larguraMetros: tecido.largura,
    rendimentoPorKg: tecido.rendimentoPorKg,
    gramaturaValor: tecido.gramaturaValor,
    gramaturaUnidade: tecido.gramaturaUnidade,
  });

  return (
    <View style={styles.tecidoHeader}>
      <View style={styles.tecidoNomeRow}>
        <Text style={styles.tecidoNome}>
          {tecido.nome} {continuacao && '(cont.)'}
        </Text>
        <Text style={styles.tecidoSku}>{tecido.sku}</Text>
        {!continuacao && (
          <Text style={styles.tecidoCount}>
            {count} {count === 1 ? 'estampa' : 'estampas'}
          </Text>
        )}
      </View>

      <View style={styles.tecidoDetalhes}>
        <View style={styles.tecidoDetalheItem}>
          <Text style={styles.tecidoDetalheLabel}>Largura:</Text>
          <Text style={styles.tecidoDetalheValue}>{formatLargura(tecido.largura)}</Text>
        </View>
        {typeof metricas.rendimentoPorKg === 'number' && (
          <View style={styles.tecidoDetalheItem}>
            <Text style={styles.tecidoDetalheLabel}>Rendimento:</Text>
            <Text style={styles.tecidoDetalheValue}>{formatDecimal(metricas.rendimentoPorKg)}m/kg</Text>
          </View>
        )}
        {typeof metricas.gramaturaGm2 === 'number' && (
          <View style={styles.tecidoDetalheItem}>
            <Text style={styles.tecidoDetalheLabel}>Gramatura:</Text>
            <Text style={styles.tecidoDetalheValue}>{formatDecimal(metricas.gramaturaGm2)}g/m2</Text>
          </View>
        )}
        {typeof metricas.gramaturaGmLinear === 'number' && (
          <View style={styles.tecidoDetalheItem}>
            <Text style={styles.tecidoDetalheLabel}>Peso linear:</Text>
            <Text style={styles.tecidoDetalheValue}>{formatDecimal(metricas.gramaturaGmLinear)}g/m</Text>
          </View>
        )}
        {tecido.composicao && (
          <View style={styles.tecidoDetalheItem}>
            <Text style={styles.tecidoDetalheLabel}>Composicao:</Text>
            <Text style={styles.tecidoDetalheValue}>{truncate(tecido.composicao, 50)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
/**
 * Footer das páginas
 */
function PageFooter() {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerBrand}>RAZAI</Text>
      <Text
        style={styles.footerPage}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

/**
 * Página de capa - logo centralizado
 */
function CoverPage() {
  const logoUrl = `${window.location.origin}/Razai.png`;
  
  return (
    <Page size="A4" style={{ backgroundColor: '#ffffff' }}>
      <View style={styles.coverPage}>
        <View style={styles.coverLogoContainer}>
          <Image 
            src={logoUrl} 
            style={styles.coverLogo}
          />
        </View>
      </View>
    </Page>
  );
}

/**
 * Página separadora de seção
 */
function SectionDividerPage({ title, count }: { title: string; count: number }) {
  return (
    <Page size="A4" style={{ backgroundColor: '#ffffff' }}>
      <View style={styles.sectionDivider}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>
          {count} {count === 1 ? 'item' : 'itens'}
        </Text>
      </View>
    </Page>
  );
}

/**
 * Página de conteúdo com cores
 */
function CoresContentPage({ pagina }: { pagina: PaginaCores }) {
  return (
    <Page size="A4" style={styles.page}>
      <TecidoHeaderCores 
        tecido={pagina.tecido}
        count={pagina.totalCoresDoTecido}
        continuacao={pagina.continuacao}
      />

      <View style={styles.gridContainer}>
        {pagina.cores.map((vinculo, index) => (
          <ColorCard
            key={vinculo.id}
            vinculo={vinculo}
            index={index}
            totalItems={pagina.cores.length}
          />
        ))}
      </View>

      <PageFooter />
    </Page>
  );
}

/**
 * Página de conteúdo com estampas
 */
function EstampasContentPage({ pagina }: { pagina: PaginaEstampas }) {
  return (
    <Page size="A4" style={styles.page}>
      <TecidoHeaderEstampas 
        tecido={pagina.tecido}
        count={pagina.totalEstampasDoTecido}
        continuacao={pagina.continuacao}
      />

      <View style={styles.gridContainer}>
        {pagina.estampas.map((estampa, index) => (
          <EstampaCard
            key={estampa.id}
            estampa={estampa}
            index={index}
            totalItems={pagina.estampas.length}
          />
        ))}
      </View>

      <PageFooter />
    </Page>
  );
}

/**
 * Documento PDF do catálogo completo (cores + estampas)
 */
export function CatalogoPdfDocument({ 
  tecidosComVinculos, 
  tecidosComEstampas = [] 
}: CatalogoPdfDocumentProps) {
  const paginasCores = criarPaginasCores(tecidosComVinculos);
  const paginasEstampas = criarPaginasEstampas(tecidosComEstampas);

  const totalCores = tecidosComVinculos.reduce((acc, t) => acc + t.vinculos.length, 0);
  const totalEstampas = tecidosComEstampas.reduce((acc, t) => acc + t.estampas.length, 0);

  const temCores = paginasCores.length > 0;
  const temEstampas = paginasEstampas.length > 0;

  return (
    <Document>
      {/* Capa - apenas logo */}
      <CoverPage />

      {/* Seção de Cores */}
      {temCores && (
        <>
          {/* Página separadora de cores (só se tiver estampas também) */}
          {temEstampas && (
            <SectionDividerPage title="CORES" count={totalCores} />
          )}

          {/* Páginas de cores */}
          {paginasCores.map((pagina, index) => (
            <CoresContentPage key={`cor-${index}`} pagina={pagina} />
          ))}
        </>
      )}

      {/* Seção de Estampas */}
      {temEstampas && (
        <>
          {/* Página separadora de estampas */}
          <SectionDividerPage title="ESTAMPAS" count={totalEstampas} />

          {/* Páginas de estampas */}
          {paginasEstampas.map((pagina, index) => (
            <EstampasContentPage key={`est-${index}`} pagina={pagina} />
          ))}
        </>
      )}
    </Document>
  );
}
