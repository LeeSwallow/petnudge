import { describe, expect, it } from 'vitest';
import { externalUrl } from './link';

describe('external links', () => {
  it('accepts http and https addresses', () => {
    expect(externalUrl('https://example.com/a?b=1#c')).toBe('https://example.com/a?b=1#c');
    expect(externalUrl('http://example.com')).toBe('http://example.com/');
  });

  it('refuses every other scheme and anything that is not a full address', () => {
    for (const url of ['javascript:alert(1)', ' JAVASCRIPT:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'vbscript:x', 'mailto:a@b.c', '//evil.com', '/relative', 'example.com', '', 'https://', 'https://user:pw@example.com']) {
      expect(externalUrl(url), url).toBeNull();
    }
  });

  it('refuses what is not a string or too long', () => {
    expect(externalUrl(undefined)).toBeNull();
    expect(externalUrl({ href: 'https://example.com' })).toBeNull();
    expect(externalUrl(`https://example.com/${'a'.repeat(3000)}`)).toBeNull();
  });
});
