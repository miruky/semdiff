import { describe, expect, it } from 'vitest';
import { applyPatch, escapePointer, toJsonPatch, type PatchOp } from './patch';
import type { Json } from './diff';

// パッチの正しさは「変更前に当てると変更後になる」ことで検証する
function roundTrip(before: Json, after: Json): void {
  const ops = toJsonPatch(before, after);
  expect(applyPatch(before, ops)).toEqual(after);
}

describe('escapePointer', () => {
  it('~ と / を符号化する', () => {
    expect(escapePointer('a/b')).toBe('a~1b');
    expect(escapePointer('m~n')).toBe('m~0n');
  });
});

describe('toJsonPatch / applyPatch', () => {
  it('オブジェクトの追加・削除・変更を再現する', () => {
    roundTrip({ keep: 1, drop: 2, change: 3 }, { keep: 1, change: 4, fresh: 5 });
  });

  it('入れ子の変更を再現する', () => {
    roundTrip({ a: { b: { c: 1 } } }, { a: { b: { c: 2 } } });
  });

  it('配列の変化は丸ごと置き換える', () => {
    const ops = toJsonPatch({ tags: ['a', 'b'] }, { tags: ['a', 'x', 'b'] });
    expect(ops).toEqual([{ op: 'replace', path: '/tags', value: ['a', 'x', 'b'] }]);
    roundTrip({ tags: ['a', 'b'] }, { tags: ['a', 'x', 'b'] });
  });

  it('型の変化を置き換えとして扱う', () => {
    roundTrip({ v: [1, 2] }, { v: { a: 1 } });
  });

  it('ルートのプリミティブ変化を置き換える', () => {
    expect(toJsonPatch(1, 2)).toEqual([{ op: 'replace', path: '', value: 2 }]);
    roundTrip(1, 2);
  });

  it('スラッシュを含むキーをJSON Pointerで指す', () => {
    const ops = toJsonPatch({ 'a/b': 1 }, { 'a/b': 2 });
    expect(ops).toEqual([{ op: 'replace', path: '/a~1b', value: 2 }] satisfies PatchOp[]);
    roundTrip({ 'a/b': 1 }, { 'a/b': 2 });
  });

  it('差分が無ければ空のパッチ', () => {
    expect(toJsonPatch({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toEqual([]);
  });
});
