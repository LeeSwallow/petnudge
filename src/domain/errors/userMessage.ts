import { t } from '../../i18n';
// One way to turn anything thrown into what the user reads (`text`, in the app's language,
// short) and what the log keeps (`detail`). DomainError and a failed Wire
// (src/core/errors.ts) carry their own message; IPC wraps errors from main
// in "Error invoking remote method 'x': Error: …", which is taken off.

export type UserMessage = { text: string; detail: string };
const fallback = () => t('error.generic');
const IPC_WRAPPER = /^Error invoking remote method '[^']+': (Error: )?/;

const isCoded = (v: unknown): v is { code: string; message: string } =>
  typeof v === 'object' && v !== null && typeof (v as { code?: unknown }).code === 'string' && typeof (v as { message?: unknown }).message === 'string';

export const toUserMessage = (error: unknown): UserMessage => {
  if (isCoded(error)) return { text: error.message || fallback(), detail: error.code };
  if (typeof error === 'object' && error !== null && (error as { ok?: unknown }).ok === false && isCoded((error as { error?: unknown }).error)) {
    return toUserMessage((error as { error: unknown }).error);
  }
  if (error instanceof Error) {
    const text = error.message.replace(IPC_WRAPPER, '');
    return text ? { text, detail: error.stack?.split('\n')[1]?.trim() ?? '' } : { text: fallback(), detail: error.name };
  }
  if (typeof error === 'string' && error) return { text: error, detail: '' };
  return { text: fallback(), detail: String(error) };
};
