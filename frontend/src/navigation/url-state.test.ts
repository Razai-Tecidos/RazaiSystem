import { describe, expect, it, beforeEach } from 'vitest';
import {
  buildHashForPage,
  parsePageFromHash,
  syncUrlHashWithPage,
} from './url-state';

describe('url-state', () => {
  beforeEach(() => {
    window.location.pathname = '/';
    window.location.search = '';
    window.location.hash = '';
  });

  it('parses valid hash formats', () => {
    expect(parsePageFromHash('#/tecidos')).toBe('tecidos');
    expect(parsePageFromHash('#tecidos')).toBe('tecidos');
    expect(parsePageFromHash('/tecidos')).toBe('tecidos');
  });

  it('returns null for invalid hashes', () => {
    expect(parsePageFromHash('')).toBeNull();
    expect(parsePageFromHash('#/nao-existe')).toBeNull();
    expect(parsePageFromHash('#/')).toBeNull();
  });

  it('builds hash with home as empty hash', () => {
    expect(buildHashForPage('home')).toBe('');
    expect(buildHashForPage('cores')).toBe('#/cores');
  });

  it('pushes history state with hash by default', () => {
    syncUrlHashWithPage('catalogo');
    expect(window.history.pushState).toHaveBeenCalledWith(null, '', '/#/catalogo');
  });

  it('uses replaceState when requested', () => {
    syncUrlHashWithPage('shopee', { replace: true });
    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/#/shopee');
  });

  it('does not push history when URL is already in sync', () => {
    window.location.hash = '#/cores';
    syncUrlHashWithPage('cores');
    expect(window.history.pushState).not.toHaveBeenCalled();
  });
});
