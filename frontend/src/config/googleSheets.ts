/**
 * Configuração do Google Sheets API
 * 
 * Para usar esta funcionalidade, você precisa:
 * 1. Criar um projeto no Google Cloud Console
 * 2. Habilitar a Google Sheets API
 * 3. Criar credenciais OAuth 2.0 (tipo: Web application)
 * 4. Adicionar a origem autorizada: http://localhost:5173 (dev) e seu domínio de produção
 * 5. Adicionar as variáveis de ambiente abaixo
 */

export const GOOGLE_SHEETS_CONFIG = {
  // API Key (opcional, para algumas operações públicas)
  API_KEY: import.meta.env.VITE_GOOGLE_API_KEY || '',
  
  // Client ID do OAuth 2.0
  CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  
  // Escopos necessários
  SCOPES: 'https://www.googleapis.com/auth/spreadsheets',
  
  // Discovery document
  DISCOVERY_DOCS: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
};
