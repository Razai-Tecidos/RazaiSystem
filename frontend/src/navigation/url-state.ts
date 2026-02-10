import { PageId, isPageId } from './modules';

function normalizeHash(hash: string): string {
  if (!hash) return '';
  return hash.startsWith('#') ? hash.slice(1) : hash;
}

export function parsePageFromHash(hash: string): PageId | null {
  const normalized = normalizeHash(hash).trim();
  if (!normalized) return null;

  const pageCandidate = normalized.startsWith('/') ? normalized.slice(1) : normalized;
  if (!pageCandidate) return null;

  return isPageId(pageCandidate) ? pageCandidate : null;
}

export function getPageFromCurrentHash(): PageId | null {
  return parsePageFromHash(window.location.hash);
}

export function buildHashForPage(page: PageId): string {
  if (page === 'home') return '';
  return `#/${page}`;
}

export function syncUrlHashWithPage(page: PageId, options?: { replace?: boolean }) {
  const targetHash = buildHashForPage(page);
  const nextUrl = `${window.location.pathname}${window.location.search}${targetHash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (currentUrl === nextUrl) return;

  const method: 'pushState' | 'replaceState' = options?.replace ? 'replaceState' : 'pushState';
  window.history[method](null, '', nextUrl);
}
