// JSON値の意味的diff。キーの順序を無視し、構造単位で追加・削除・変更を検出する。
// 配列はLCS(最長共通部分列)で対応付け、途中への挿入を変更の連鎖にしない

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export type DiffKind = 'unchanged' | 'added' | 'removed' | 'changed';

export interface DiffNode {
  kind: DiffKind;
  // ルートからのパス。例: items[2].name
  path: string;
  // 末端の表示用ラベル(キー名または配列インデックス)
  label: string;
  before?: Json;
  after?: Json;
  children: DiffNode[];
}

export function isEqual(a: Json, b: Json): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => isEqual(item, b[i]!));
  }
  if (typeof a === 'object') {
    if (Array.isArray(b) || typeof b !== 'object') return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b as object);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(
      (key) => key in (b as object) && isEqual(a[key]!, (b as Record<string, Json>)[key]!),
    );
  }
  return false;
}

function leaf(kind: DiffKind, path: string, label: string, before?: Json, after?: Json): DiffNode {
  return { kind, path, label, before, after, children: [] };
}

function isPlainObject(value: Json): value is { [key: string]: Json } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function diffJson(before: Json, after: Json, path = '', label = '(ルート)'): DiffNode {
  if (isEqual(before, after)) {
    return leaf('unchanged', path, label, before, after);
  }
  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    const children = keys.map((key) => {
      const childPath = path === '' ? key : `${path}.${key}`;
      if (!(key in after)) return leaf('removed', childPath, key, before[key]);
      if (!(key in before)) return leaf('added', childPath, key, undefined, after[key]);
      return diffJson(before[key]!, after[key]!, childPath, key);
    });
    return { kind: 'changed', path, label, children };
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    return diffArray(before, after, path, label);
  }
  // 型が違う、またはプリミティブの値が違う
  return leaf('changed', path, label, before, after);
}

// LCSで一致要素を骨格にし、間の要素を削除・追加として対応付ける
function diffArray(before: Json[], after: Json[], path: string, label: string): DiffNode {
  const matches = lcsMatches(before, after);
  const children: DiffNode[] = [];
  let i = 0;
  let j = 0;
  for (const [mi, mj] of [...matches, [before.length, after.length] as const]) {
    // 一致点まで進む間、双方に残る要素は「変更」として突き合わせる
    while (i < mi && j < mj) {
      children.push(diffJson(before[i]!, after[j]!, `${path}[${j}]`, `[${j}]`));
      i += 1;
      j += 1;
    }
    while (i < mi) {
      children.push(leaf('removed', `${path}[${i}]`, `[${i}]`, before[i]));
      i += 1;
    }
    while (j < mj) {
      children.push(leaf('added', `${path}[${j}]`, `[${j}]`, undefined, after[j]));
      j += 1;
    }
    if (mi < before.length && mj < after.length) {
      children.push(leaf('unchanged', `${path}[${mj}]`, `[${mj}]`, before[mi], after[mj]));
      i = mi + 1;
      j = mj + 1;
    }
  }
  return { kind: 'changed', path, label, children };
}

// 深い等価性に基づくLCS。一致した(beforeIndex, afterIndex)の組を返す
function lcsMatches(a: Json[], b: Json[]): Array<readonly [number, number]> {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const table = new Uint32Array(rows * cols);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i * cols + j] = isEqual(a[i]!, b[j]!)
        ? table[(i + 1) * cols + j + 1]! + 1
        : Math.max(table[(i + 1) * cols + j]!, table[i * cols + j + 1]!);
    }
  }
  const matches: Array<readonly [number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (isEqual(a[i]!, b[j]!)) {
      matches.push([i, j] as const);
      i += 1;
      j += 1;
    } else if (table[(i + 1) * cols + j]! >= table[i * cols + j + 1]!) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return matches;
}

export interface DiffStats {
  added: number;
  removed: number;
  changed: number;
}

// 葉の変更だけを数える。コンテナ自体は子の集計に現れるため数えない
export function diffStats(node: DiffNode): DiffStats {
  const stats: DiffStats = { added: 0, removed: 0, changed: 0 };
  const visit = (n: DiffNode): void => {
    if (n.children.length === 0) {
      if (n.kind === 'added') stats.added += 1;
      else if (n.kind === 'removed') stats.removed += 1;
      else if (n.kind === 'changed') stats.changed += 1;
    }
    n.children.forEach(visit);
  };
  visit(node);
  return stats;
}
