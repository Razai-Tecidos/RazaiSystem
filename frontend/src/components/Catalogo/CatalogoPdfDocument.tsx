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

// ============================================================================
// CONFIGURAÇÕES DE LAYOUT - A4
// ============================================================================

// Margens
const MARGIN = {
  top: 40,
  bottom: 50,
  left: 40,
  right: 40,
};

// Footer
const FOOTER_HEIGHT = 25;

// Grid de cores: 4 colunas x 4 linhas = 16 cores por página
const COLS = 4;
const ROWS = 4;
const GAP = 10;
const CORES_POR_PAGINA = COLS * ROWS;

// Grid de estampas: 4 colunas x 4 linhas = 16 estampas por página
const ESTAMPAS_POR_PAGINA = 16;

// Tamanho do card de cor
const CARD_SIZE = 115;

// Header do grupo de tecido
const TECIDO_HEADER_HEIGHT = 55;

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
    marginBottom: 12,
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
    gap: 20,
  },
  tecidoDetalheItem: {
    flexDirection: 'row',
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
    marginRight: GAP,
    marginBottom: GAP,
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
    marginRight: GAP,
    marginBottom: GAP,
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
function ColorCard({ vinculo }: { vinculo: CorTecido }) {
  const imagemCatalogo = vinculo.imagemGerada || vinculo.imagemTingida;

  return (
    <View style={styles.colorCard} wrap={false}>
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
function EstampaCard({ estampa }: { estampa: Estampa }) {
  return (
    <View style={styles.estampaCard} wrap={false}>
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
  continuacao 
}: { 
  tecido: Tecido;
  count: number;
  continuacao?: boolean;
}) {
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
        {tecido.composicao && (
          <View style={styles.tecidoDetalheItem}>
            <Text style={styles.tecidoDetalheLabel}>Composição:</Text>
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
  continuacao 
}: { 
  tecido: Tecido;
  count: number;
  continuacao?: boolean;
}) {
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
        {tecido.composicao && (
          <View style={styles.tecidoDetalheItem}>
            <Text style={styles.tecidoDetalheLabel}>Composição:</Text>
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
        {pagina.cores.map((vinculo) => (
          <ColorCard key={vinculo.id} vinculo={vinculo} />
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
        {pagina.estampas.map((estampa) => (
          <EstampaCard key={estampa.id} estampa={estampa} />
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
