// 入力と表示設定をURLのハッシュに載せて共有できるようにする。
// 比較データはネットワークに送らない方針なので、URLへの符号化だけで完結させる。
import type { Format } from './parse';

export interface ShareState {
  before: string;
  after: string;
  beforeFormat: Format;
  afterFormat: Format;
  hideUnchanged: boolean;
}

const PREFIX = 's1:';

// マルチバイト文字を含む文字列をURL安全なbase64へ。btoaはLatin-1しか扱えないため
// 先にUTF-8のバイト列へ落としてから符号化する。
function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
  const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function isFormat(value: unknown): value is Format {
  return value === 'auto' || value === 'json' || value === 'yaml';
}

export function encodeState(state: ShareState): string {
  const compact = {
    a: state.before,
    b: state.after,
    fa: state.beforeFormat,
    fb: state.afterFormat,
    h: state.hideUnchanged ? 1 : 0,
  };
  return PREFIX + toBase64Url(JSON.stringify(compact));
}

export function decodeState(raw: string): ShareState | null {
  const trimmed = raw.startsWith('#') ? raw.slice(1) : raw;
  if (!trimmed.startsWith(PREFIX)) return null;
  try {
    const json = fromBase64Url(trimmed.slice(PREFIX.length));
    const parsed = JSON.parse(json) as Record<string, unknown>;
    if (typeof parsed.a !== 'string' || typeof parsed.b !== 'string') return null;
    return {
      before: parsed.a,
      after: parsed.b,
      beforeFormat: isFormat(parsed.fa) ? parsed.fa : 'auto',
      afterFormat: isFormat(parsed.fb) ? parsed.fb : 'auto',
      hideUnchanged: parsed.h !== 0,
    };
  } catch {
    return null;
  }
}
