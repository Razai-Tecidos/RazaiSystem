import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';

export interface VinculosChecklistPdfRow {
  id: string;
  tecidoNome: string;
  tipo: 'Cor' | 'Estampa';
  nome: string;
  sku?: string;
  previewUrl?: string;
}

export interface VinculosChecklistPdfSection {
  tecidoId: string;
  tecidoNome: string;
  tecidoSku?: string;
  rows: VinculosChecklistPdfRow[];
}

interface VinculosChecklistPdfDocumentProps {
  sections: VinculosChecklistPdfSection[];
  showPreviews?: boolean;
}

interface SectionChunk {
  tecidoId: string;
  tecidoNome: string;
  tecidoSku?: string;
  rows: VinculosChecklistPdfRow[];
  chunkIndex: number;
  totalChunks: number;
  estimatedHeight: number;
}

const A4_HEIGHT = 841.89;
const PAGE_MARGIN = 28;
const PAGE_HEADER_HEIGHT = 36;
const SECTION_TITLE_HEIGHT = 30;
const TABLE_HEADER_HEIGHT = 26;
const ROW_HEIGHT = 38;
const SECTION_BOTTOM_SPACE = 12;
const MIN_ROWS_FOR_SPLIT_IN_CURRENT_PAGE = 3;

const CONTENT_HEIGHT = A4_HEIGHT - PAGE_MARGIN * 2;
const PAGE_CONTENT_LIMIT = CONTENT_HEIGHT - PAGE_HEADER_HEIGHT;

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    paddingTop: PAGE_MARGIN,
    paddingBottom: PAGE_MARGIN,
    paddingHorizontal: PAGE_MARGIN,
  },
  pageHeader: {
    height: PAGE_HEADER_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
  },
  pageMeta: {
    fontSize: 9,
    color: '#6b7280',
  },
  section: {
    marginBottom: SECTION_BOTTOM_SPACE,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 4,
    overflow: 'hidden',
  },
  sectionTitleRow: {
    height: SECTION_TITLE_HEIGHT,
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#111827',
  },
  sectionSubtitle: {
    fontSize: 8,
    color: '#6b7280',
  },
  tableHeader: {
    height: TABLE_HEADER_HEIGHT,
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    alignItems: 'center',
  },
  headerCell: {
    fontSize: 8,
    color: '#374151',
    fontWeight: 'bold',
    paddingHorizontal: 6,
  },
  row: {
    minHeight: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  cell: {
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  cellText: {
    fontSize: 8,
    color: '#111827',
  },
  cellMuted: {
    fontSize: 7,
    color: '#6b7280',
    marginTop: 2,
  },
  thumbWrap: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  thumbFallback: {
    fontSize: 7,
    color: '#9ca3af',
  },
  checkboxCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: '#6b7280',
    borderRadius: 2,
  },
});

function getColumnWidths(showPreviews: boolean) {
  if (showPreviews) {
    return {
      tecido: '28%',
      tipo: '14%',
      item: '36%',
      preview: '12%',
      check: '10%',
    } as const;
  }

  return {
    tecido: '32%',
    tipo: '14%',
    item: '44%',
    preview: '0%',
    check: '10%',
  } as const;
}

function estimateSectionHeight(rowsCount: number): number {
  return SECTION_TITLE_HEIGHT + TABLE_HEADER_HEIGHT + rowsCount * ROW_HEIGHT + SECTION_BOTTOM_SPACE;
}

function paginateSections(sections: VinculosChecklistPdfSection[]): SectionChunk[][] {
  const pages: SectionChunk[][] = [];
  let currentPage: SectionChunk[] = [];
  let currentHeight = 0;
  const sectionBaseHeight = SECTION_TITLE_HEIGHT + TABLE_HEADER_HEIGHT + SECTION_BOTTOM_SPACE;
  const minSectionHeightWithOneRow = sectionBaseHeight + ROW_HEIGHT;

  sections
    .filter((section) => section.rows.length > 0)
    .forEach((section) => {
      // Sempre iniciar novo tecido em uma nova página.
      if (currentPage.length > 0) {
        pages.push(currentPage);
        currentPage = [];
        currentHeight = 0;
      }

      let rowCursor = 0;

      while (rowCursor < section.rows.length) {
        const availableHeight = PAGE_CONTENT_LIMIT - currentHeight;
        const remainingRows = section.rows.length - rowCursor;

        if (availableHeight < minSectionHeightWithOneRow) {
          if (currentPage.length > 0) {
            pages.push(currentPage);
            currentPage = [];
            currentHeight = 0;
            continue;
          }
        }

        const maxRowsFit = Math.floor((availableHeight - sectionBaseHeight) / ROW_HEIGHT);
        if (maxRowsFit <= 0) {
          if (currentPage.length > 0) {
            pages.push(currentPage);
            currentPage = [];
            currentHeight = 0;
            continue;
          }
          // Fallback defensivo para nao entrar em loop.
          const chunk: SectionChunk = {
            tecidoId: section.tecidoId,
            tecidoNome: section.tecidoNome,
            tecidoSku: section.tecidoSku,
            rows: section.rows.slice(rowCursor, rowCursor + 1),
            chunkIndex: 1,
            totalChunks: 1,
            estimatedHeight: estimateSectionHeight(1),
          };
          currentPage.push(chunk);
          currentHeight += chunk.estimatedHeight;
          rowCursor += 1;
          continue;
        }

        if (
          currentPage.length > 0 &&
          remainingRows > maxRowsFit &&
          maxRowsFit < MIN_ROWS_FOR_SPLIT_IN_CURRENT_PAGE
        ) {
          pages.push(currentPage);
          currentPage = [];
          currentHeight = 0;
          continue;
        }

        const rowsToTake = Math.min(remainingRows, maxRowsFit);
        const rows = section.rows.slice(rowCursor, rowCursor + rowsToTake);
        const chunk: SectionChunk = {
          tecidoId: section.tecidoId,
          tecidoNome: section.tecidoNome,
          tecidoSku: section.tecidoSku,
          rows,
          chunkIndex: 1,
          totalChunks: 1,
          estimatedHeight: estimateSectionHeight(rows.length),
        };

        currentPage.push(chunk);
        currentHeight += chunk.estimatedHeight;
        rowCursor += rowsToTake;

        if (rowCursor < section.rows.length) {
          pages.push(currentPage);
          currentPage = [];
          currentHeight = 0;
        }
      }
    });

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  const chunksBySection = new Map<string, SectionChunk[]>();
  pages.forEach((page) => {
    page.forEach((chunk) => {
      const sectionKey = `${chunk.tecidoId}|${chunk.tecidoNome}|${chunk.tecidoSku || ''}`;
      const list = chunksBySection.get(sectionKey) || [];
      list.push(chunk);
      chunksBySection.set(sectionKey, list);
    });
  });

  chunksBySection.forEach((chunks) => {
    const totalChunks = chunks.length;
    chunks.forEach((chunk, index) => {
      chunk.chunkIndex = index + 1;
      chunk.totalChunks = totalChunks;
    });
  });

  return pages;
}

export function VinculosChecklistPdfDocument({
  sections,
  showPreviews = true,
}: VinculosChecklistPdfDocumentProps) {
  const pages = paginateSections(sections);
  const generationDate = new Date().toLocaleDateString('pt-BR');
  const columnWidths = getColumnWidths(showPreviews);

  return (
    <Document>
      {pages.map((pageSections, pageIndex) => (
        <Page key={`checklist-page-${pageIndex + 1}`} size="A4" style={styles.page}>
          <View style={styles.pageHeader} fixed>
            <Text style={styles.pageTitle}>Checklist de Vinculos por Tecido</Text>
            <Text style={styles.pageMeta}>
              Gerado em {generationDate} - Pagina {pageIndex + 1}/{pages.length}
            </Text>
          </View>

          {pageSections.map((section) => (
            <View
              key={`${section.tecidoId}-${section.chunkIndex}`}
              style={styles.section}
              wrap={false}
            >
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>
                  {section.tecidoNome}
                  {section.tecidoSku ? ` (${section.tecidoSku})` : ''}
                </Text>
                {section.totalChunks > 1 ? (
                  <Text style={styles.sectionSubtitle}>
                    Parte {section.chunkIndex}/{section.totalChunks}
                  </Text>
                ) : (
                  <Text style={styles.sectionSubtitle}>{section.rows.length} item(ns)</Text>
                )}
              </View>

              <View style={styles.tableHeader}>
                <View style={[styles.cell, { width: columnWidths.tecido }]}>
                  <Text style={styles.headerCell}>Tecido</Text>
                </View>
                <View style={[styles.cell, { width: columnWidths.tipo }]}>
                  <Text style={styles.headerCell}>Tipo</Text>
                </View>
                <View style={[styles.cell, { width: columnWidths.item }]}>
                  <Text style={styles.headerCell}>Cor / Estampa</Text>
                </View>
                {showPreviews && (
                  <View style={[styles.cell, { width: columnWidths.preview }]}>
                    <Text style={styles.headerCell}>Thumb</Text>
                  </View>
                )}
                <View style={[styles.cell, styles.checkboxCell, { width: columnWidths.check }]}>
                  <Text style={styles.headerCell}>Check</Text>
                </View>
              </View>

              {section.rows.map((row) => (
                <View key={row.id} style={styles.row}>
                  <View style={[styles.cell, { width: columnWidths.tecido }]}>
                    <Text style={styles.cellText}>{row.tecidoNome}</Text>
                  </View>
                  <View style={[styles.cell, { width: columnWidths.tipo }]}>
                    <Text style={styles.cellText}>{row.tipo}</Text>
                  </View>
                  <View style={[styles.cell, { width: columnWidths.item }]}>
                    <Text style={styles.cellText}>{row.nome}</Text>
                    <Text style={styles.cellMuted}>{row.sku || 'Sem SKU'}</Text>
                  </View>
                  {showPreviews && (
                    <View style={[styles.cell, { width: columnWidths.preview }]}>
                      <View style={styles.thumbWrap}>
                        {row.previewUrl ? (
                          <Image src={row.previewUrl} style={styles.thumb} />
                        ) : (
                          <Text style={styles.thumbFallback}>-</Text>
                        )}
                      </View>
                    </View>
                  )}
                  <View style={[styles.cell, styles.checkboxCell, { width: columnWidths.check }]}>
                    <View style={styles.checkbox} />
                  </View>
                </View>
              ))}
            </View>
          ))}
        </Page>
      ))}
    </Document>
  );
}
