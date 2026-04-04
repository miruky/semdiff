import { describe, expect, it } from 'vitest';
import { diffJson } from './diff';
import { toMarkdown } from './report';

describe('toMarkdown', () => {
  it('変更を種別・パス・変更内容の表にする', () => {
    const node = diffJson({ drop: 1, ver: '1.0' }, { ver: '2.0', add: true });
    const md = toMarkdown(node);
    expect(md).toContain('追加 1 / 削除 1 / 変更 1');
    expect(md).toContain('| 変更 | `ver` | `"1.0"` → `"2.0"` |');
    expect(md).toContain('| 削除 | `drop` | `1` |');
    expect(md).toContain('| 追加 | `add` | `true` |');
  });

  it('差分なしは表を出さない', () => {
    const md = toMarkdown(diffJson({ a: 1 }, { a: 1 }));
    expect(md).toContain('差分なし');
    expect(md).not.toContain('| 種別 |');
  });

  it('値のパイプを無害化する', () => {
    const md = toMarkdown(diffJson({}, { cmd: 'a|b' }));
    expect(md).toContain('a\\|b');
  });
});
