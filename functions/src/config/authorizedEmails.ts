// Lista de emails autorizados para acessar o sistema
const AUTHORIZED_EMAILS: string[] = [
  'razai.contato@gmail.com'
];

/**
 * Verifica se um email está autorizado para acessar o sistema
 */
export function isEmailAuthorized(email: string | undefined | null): boolean {
  if (!email) return false;
  
  // Se a lista estiver vazia, permite qualquer email (apenas para desenvolvimento)
  // Em produção, sempre deve ter pelo menos um email
  if (AUTHORIZED_EMAILS.length === 0) {
    console.warn('⚠️ Nenhum email autorizado configurado. Permitindo acesso para desenvolvimento.');
    return true;
  }
  
  return AUTHORIZED_EMAILS.includes(email.toLowerCase().trim());
}

/**
 * Retorna a lista de emails autorizados
 */
export function getAuthorizedEmails(): string[] {
  return [...AUTHORIZED_EMAILS];
}
