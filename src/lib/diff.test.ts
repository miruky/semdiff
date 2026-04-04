import { describe, expect, it } from 'vitest';
import { diffJson, diffStats, isEqual, type DiffNode } from './diff';

function find(node: DiffNode, path: string): DiffNode | null {
  if (node.path === path) return node;
  for (const child of node.children) {
    const hit = find(child, path);
    if (hit) return hit;
  }
  return null;
}

describe('isEqual', () => {
  it('キー順序の違いを同値とみなす', () => {
    expect(isEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it('入れ子の差を検出する', () => {
    expect(isEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false);
  });

  it('nullと0と空文字を区別する', () => {
    expect(isEqual(null, 0)).toBe(false);
    expect(isEqual(0, '')).toBe(false);
  });
});

describe('diffJson: オブジェクト', () => {
  it('追加・削除・変更をキー単位で検出する', () => {
    const root = diffJson({ keep: 1, drop: 2, change: 3 }, { keep: 1, change: 4, fresh: 5 });
    expect(find(root, 'keep')?.kind).toBe('unchanged');
    expect(find(root, 'drop')?.kind).toBe('removed');
    expect(find(root, 'fresh')?.kind).toBe('added');
    const changed = find(root, 'change');
    expect(changed?.kind).toBe('changed');
    expect(changed?.before).toBe(3);
    expect(changed?.after).toBe(4);
  });

  it('入れ子のパスをドット区切りで組み立てる', () => {
    const root = diffJson({ a: { b: { c: 1 } } }, { a: { b: { c: 2 } } });
    expect(find(root, 'a.b.c')?.kind).toBe('changed');
  });

  it('型の変化は構造を展開せず1つの変更にする', () => {
    const root = diffJson({ value: [1, 2] }, { value: { a: 1 } });
    const node = find(root, 'value');
    expect(node?.kind).toBe('changed');
    expect(node?.children).toHaveLength(0);
  });
});

describe('diffJson: 配列', () => {
  it('途中への挿入を挿入として検出する(後続を変更扱いしない)', () => {
    const root = diffJson([1, 2, 3], [1, 99, 2, 3]);
    const kinds = root.children.map((c) => c.kind);
    expect(kinds).toEqual(['unchanged', 'added', 'unchanged', 'unchanged']);
  });

  it('削除を検出する', () => {
    const root = diffJson(['a', 'b', 'c'], ['a', 'c']);
    expect(root.children.map((c) => c.kind)).toEqual(['unchanged', 'removed', 'unchanged']);
  });

  it('オブジェクト要素の中身の変更は変更として突き合わせる', () => {
    const root = diffJson([{ id: 1, v: 'x' }], [{ id: 1, v: 'y' }]);
    expect(find(root, '[0].v')?.kind).toBe('changed');
  });
});

describe('diffStats', () => {
  it('葉の変更だけを数える', () => {
    const root = diffJson(
      { drop: 1, change: { deep: 2 }, keep: 3 },
      { change: { deep: 9 }, keep: 3, fresh: [1, 2] },
    );
    expect(diffStats(root)).toEqual({ added: 1, removed: 1, changed: 1 });
  });

  it('同一の入力は差分ゼロ', () => {
    const root = diffJson({ a: [1, 2, { b: 3 }] }, { a: [1, 2, { b: 3 }] });
    expect(root.kind).toBe('unchanged');
    expect(diffStats(root)).toEqual({ added: 0, removed: 0, changed: 0 });
  });
});
