import { describe, expect, it } from 'vitest';
import { detectFormat, parseInput, stripJsonComments, stripTrailingCommas } from './parse';

describe('stripJsonComments', () => {
  it('行コメントとブロックコメントを除く', () => {
    const src = '{\n  // 行\n  "a": 1, /* 中 */ "b": 2\n}';
    expect(JSON.parse(stripJsonComments(src))).toEqual({ a: 1, b: 2 });
  });

  it('文字列内のスラッシュは残す', () => {
    const src = '{ "url": "https://example.com", "re": "a//b" }';
    expect(JSON.parse(stripJsonComments(src))).toEqual({
      url: 'https://example.com',
      re: 'a//b',
    });
  });
});

describe('stripTrailingCommas', () => {
  it('オブジェクトと配列の末尾カンマを除く', () => {
    expect(JSON.parse(stripTrailingCommas('{ "a": [1, 2,], }'))).toEqual({ a: [1, 2] });
  });

  it('文字列内のカンマは残す', () => {
    expect(JSON.parse(stripTrailingCommas('{ "a": "x,y" }'))).toEqual({ a: 'x,y' });
  });
});

describe('detectFormat', () => {
  it('波括弧・角括弧で始まればJSON', () => {
    expect(detectFormat('{"a":1}')).toBe('json');
    expect(detectFormat('  [1,2]')).toBe('json');
  });

  it('キー: 値の並びはYAML', () => {
    expect(detectFormat('name: api\nversion: 2')).toBe('yaml');
  });

  it('= 代入やテーブル見出しはTOML', () => {
    expect(detectFormat('name = "api"\nversion = 2')).toBe('toml');
    expect(detectFormat('# 設定\n[server]\nport = 8080')).toBe('toml');
    expect(detectFormat('[deps]\nzod = "^3"')).toBe('toml');
  });

  it('ドット区切りキーの代入もTOMLと見なす', () => {
    expect(detectFormat('server.port = 8080')).toBe('toml');
  });
});

describe('parseInput', () => {
  it('空文字はnull', () => {
    expect(parseInput('', 'auto')).toEqual({ ok: true, value: null });
  });

  it('コメントと末尾カンマつきJSONを読む', () => {
    const result = parseInput('{\n  "a": 1, // コメント\n  "b": [2, 3,],\n}', 'json');
    expect(result).toEqual({ ok: true, value: { a: 1, b: [2, 3] } });
  });

  it('YAMLをJSON互換の値として読む', () => {
    const result = parseInput('name: api-server\ntags:\n  - http\n  - backend', 'yaml');
    expect(result).toEqual({ ok: true, value: { name: 'api-server', tags: ['http', 'backend'] } });
  });

  it('autoはYAMLの平叙な記述を判別する', () => {
    const result = parseInput('version: 2', 'auto');
    expect(result).toEqual({ ok: true, value: { version: 2 } });
  });

  it('壊れたJSONはエラーを返す', () => {
    const result = parseInput('{ "a": }', 'json');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('JSON');
  });

  it('TOMLをJSON互換の値として読む', () => {
    const src = 'name = "api"\n[deps]\nzod = "^3.23.0"\nports = [80, 443]';
    expect(parseInput(src, 'toml')).toEqual({
      ok: true,
      value: { name: 'api', deps: { zod: '^3.23.0', ports: [80, 443] } },
    });
  });

  it('TOMLの日時はISO文字列へ寄せる', () => {
    const result = parseInput('at = 2026-01-02T03:04:05Z', 'toml');
    expect(result).toEqual({ ok: true, value: { at: '2026-01-02T03:04:05.000Z' } });
  });

  it('JSONとTOMLを同じ値として突き合わせられる', () => {
    const fromJson = parseInput('{ "port": 8080, "name": "api" }', 'json');
    const fromToml = parseInput('name = "api"\nport = 8080', 'toml');
    expect(fromJson.ok && fromToml.ok && fromJson.value).toEqual(
      fromToml.ok ? fromToml.value : null,
    );
  });

  it('壊れたTOMLはエラーを返す', () => {
    const result = parseInput('a = = 1', 'toml');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('TOML');
  });
});
