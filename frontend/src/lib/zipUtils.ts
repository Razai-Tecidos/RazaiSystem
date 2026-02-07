import JSZip from 'jszip';
import { saveAs } from 'file-saver';

/**
 * Cria um arquivo ZIP com múltiplas imagens
 */
export async function createZipFromImages(
  images: Array<{ url: string; filename: string }>,
  zipFilename: string
): Promise<void> {
  const zip = new JSZip();
  
  // Baixar cada imagem e adicionar ao ZIP
  for (const image of images) {
    try {
      const response = await fetch(image.url);
      if (!response.ok) {
        console.warn(`Falha ao baixar ${image.url}: ${response.statusText}`);
        continue;
      }
      const blob = await response.blob();
      zip.file(image.filename, blob);
    } catch (error) {
      console.error(`Erro ao processar ${image.filename}:`, error);
      // Continuar com as outras imagens mesmo se uma falhar
    }
  }
  
  // Gerar o arquivo ZIP e fazer download
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  saveAs(zipBlob, zipFilename);
}
