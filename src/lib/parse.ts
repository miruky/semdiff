// 入力テキストを意味的diffが扱えるJSON値に変換する。
// JSONはコメントと末尾カンマを許容(JSONC)し、YAMLはJSON互換のスキーマで読む。
import yaml from 'js-yaml';
import type { Json } from './diff';

export type Format = 'auto' | 'json' | 'yaml';

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

// JSONともYAMLとも取れる入力の判別。先頭が { か [ ならJSON、それ以外はYAML寄りに倒す。
export function detectFormat(text: string): 'json' | 'yaml' {
  const trimmed = text.trim();
  if (trimmed === '') return 'json';
  const head = trimmed[0]!;
  if (head === '{' || head === '[') return 'json';
  if (head === '"') return 'json';
  return 'yaml';
}

function ensureJsonValue(value: unknown): Json {
  // js-yamlにJSON_SCHEMAを渡しているため、ここに来るのはJSON互換の値のみ。
  // undefinedだけはJSONに無いのでnullへ寄せる。
  return (value ?? null) as Json;
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
  try {
    const value = JSON.parse(stripTrailingCommas(stripJsonComments(text))) as Json;
    return { ok: true, value };
  } catch (cause) {
    return { ok: false, error: `JSONとして読めない: ${(cause as Error).message}` };
  }
}
