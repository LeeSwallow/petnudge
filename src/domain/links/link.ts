// Which addresses may leave the app for the external browser: a full http or
// https address with a host and no user name or password in it. Returns the
// normalized address, or null. Used by the chat's links (renderer, to decide
// what is a link) and again by main before it opens anything, since the
// renderer is not trusted.

const MAX_LENGTH = 2048;

export const externalUrl = (raw: unknown): string | null => {
  if (typeof raw !== 'string' || raw.length > MAX_LENGTH) return null;
  const trimmed = raw.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname || url.username || url.password) return null;
  return url.href.length > MAX_LENGTH ? null : url.href;
};
