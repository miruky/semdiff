// 入力テキストを意味的diffが扱えるJSON値に変換する。
// JSONはコメントと末尾カンマを許容(JSONC)し、YAMLはJSON互換のスキーマで読む。
// TOMLはsmol-tomlで読み、JSONに無い日時はISO文字列へ寄せて比較できるようにする。
import yaml from 'js-yaml';
import { parse as parseToml } from 'smol-toml';
import type { Json } from './diff';

export type Format = 'auto' | 'json' | 'yaml' | 'toml';

export type ParseResult = { ok: true; value: Json } | { ok: false; error: string };

// 文字列リテラルを壊さずに // と /* */ を取り除く。
// JSONの値比較では位置情報が要らないため、コメントは空白に置換するだけでよい。
export function stripJsonComments(input: string): string {
  let out = '';
  let inString = false;
  let quote = '';
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;
    const next = input[i + 1];
    if (inString) {
      out += ch;
      if (ch === '\\') {
        out += input[i + 1] ?? '';
        i += 1;
      } else if (ch === quote) {
        inString = false;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === '/' && next === '/') {
      while (i < input.length && input[i] !== '\n') i += 1;
      out += '\n';
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < input.length && !(input[i] === '*' && input[i + 1] === '/')) i += 1;
      i += 1; // 閉じる '/' の手前まで進め、ループのi++で読み飛ばす
      continue;
    }
    out += ch;
  }
  return out;
}

// オブジェクト・配列の閉じ括弧直前の余分なカンマを除く(文字列内は対象外)。
export function stripTrailingCommas(input: string): string {
  let out = '';
  let inString = false;
  let quote = '';
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;
    if (inString) {
      out += ch;
      if (ch === '\\') {
        out += input[i + 1] ?? '';
        i += 1;
      } else if (ch === quote) {
        inString = false;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === ',') {
      let j = i + 1;
      while (j < input.length && /\s/.test(input[j]!)) j += 1;
      if (input[j] === '}' || input[j] === ']') continue; // カンマを捨てる
    }
    out += ch;
  }
  return out;
}

// TOML特有の行(bareキーの = 代入、または [table] / [[array]] 見出し)があるか。
// YAMLは key: value で = を使わないため、これらは形式の決め手になる。
function looksLikeToml(text: string): boolean {
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    if (/^[A-Za-z0-9_."'-]+(\s*\.\s*[A-Za-z0-9_."'-]+)*\s*=\s*\S/.test(line)) return true;
    if (/^\[\[?\s*[A-Za-z0-9_."'.\s-]+\s*\]\]?\s*(#.*)?$/.test(line)) return true;
  }
  return false;
}

// 形式の自動判別。先頭が { " ならJSON、TOML特有の行があればTOMLとする。
// 先頭が [ はJSON配列ともTOMLの [table] とも取れるため、TOML判定を先に通す。
export function detectFormat(text: string): 'json' | 'yaml' | 'toml' {
  const trimmed = text.trim();
  if (trimmed === '') return 'json';
  const head = trimmed[0]!;
  if (head === '{' || head === '"') return 'json';
  if (looksLikeToml(text)) return 'toml';
  if (head === '[') return 'json';
  return 'yaml';
}

function ensureJsonValue(value: unknown): Json {
  // js-yamlにJSON_SCHEMAを渡しているため、ここに来るのはJSON互換の値のみ。
  // undefinedだけはJSONに無いのでnullへ寄せる。
  return (value ?? null) as Json;
}

// TOMLの解析結果をJSON互換の値へ寄せる。日時(Date)はISO文字列に、
// それ以外の入れ子は再帰的にたどる。比較ロジックがJSON値だけを前提にするため。
function normalizeToml(value: unknown): Json {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return Number(value);
  if (Array.isArray(value)) return value.map(normalizeToml);
  if (typeof value === 'object') {
    const out: { [key: string]: Json } = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = normalizeToml(v);
    }
    return out;
  }
  return value as Json;
}

export function parseInput(text: string, format: Format): ParseResult {
  if (text.trim() === '') return { ok: true, value: null };
  const effective = format === 'auto' ? detectFormat(text) : format;
  if (effective === 'yaml') {
    try {
      const value = yaml.load(text, { schema: yaml.JSON_SCHEMA });
      return { ok: true, value: ensureJsonValue(value) };
    } catch (cause) {
      return { ok: false, error: `YAMLとして読めない: ${(cause as Error).message}` };
    }
  }
  if (effective === 'toml') {
    try {
      return { ok: true, value: normalizeToml(parseToml(text)) };
    } catch (cause) {
      return { ok: false, error: `TOMLとして読めない: ${(cause as Error).message}` };
    }
  }
  try {
    const value = JSON.parse(stripTrailingCommas(stripJsonComments(text))) as Json;
    return { ok: true, value };
  } catch (cause) {
    return { ok: false, error: `JSONとして読めない: ${(cause as Error).message}` };
  }
}
