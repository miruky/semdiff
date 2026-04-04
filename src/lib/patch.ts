// 変更前→変更後を再現するRFC 6902形式のJSON Patchを作る。
// オブジェクトはキー単位でadd/remove/replaceに分解する。配列は要素の対応付けが
// 添字の付け替えを伴い壊れやすいため、変化した配列はreplaceで丸ごと置き換える。
import { isEqual, type Json } from './diff';

export interface PatchOp {
  op: 'add' | 'remove' | 'replace';
  path: string;
  value?: Json;
}

// JSON Pointer(RFC 6901)のトークン用エスケープ。~ と / を符号化する。
export function escapePointer(token: string): string {
  return token.replace(/~/g, '~0').replace(/\//g, '~1');
}

function unescapePointer(token: string): string {
  return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

function isPlainObject(value: Json): value is { [key: string]: Json } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toJsonPatch(before: Json, after: Json): PatchOp[] {
  const ops: PatchOp[] = [];
  build(before, after, '', ops);
  return ops;
}

function build(before: Json, after: Json, pointer: string, ops: PatchOp[]): void {
  if (isEqual(before, after)) return;

  if (isPlainObject(before) && isPlainObject(after)) {
    const beforeKeys = Object.keys(before).sort();
    const afterKeys = Object.keys(after).sort();
    for (const key of beforeKeys) {
      if (!(key in after)) ops.push({ op: 'remove', path: `${pointer}/${escapePointer(key)}` });
    }
    for (const key of afterKeys) {
      const childPointer = `${pointer}/${escapePointer(key)}`;
      if (!(key in before)) ops.push({ op: 'add', path: childPointer, value: after[key] });
      else build(before[key]!, after[key]!, childPointer, ops);
    }
    return;
  }

  // 配列・型の変化・プリミティブの変化はまとめて置き換える
  ops.push({ op: 'replace', path: pointer, value: after });
}

// 生成したパッチを検証するための最小実装。add/remove/replaceのみを解釈する。
export function applyPatch(doc: Json, ops: PatchOp[]): Json {
  let result = clone(doc);
  for (const op of ops) {
    if (op.path === '') {
      if (op.op === 'remove') throw new Error('ルートは削除できない');
      result = clone(op.value ?? null);
      continue;
    }
    const tokens = op.path.split('/').slice(1).map(unescapePointer);
    const last = tokens.pop()!;
    const parent = resolve(result, tokens);
    applyOne(parent, last, op);
  }
  return result;
}

function applyOne(parent: Json, key: string, op: PatchOp): void {
  if (Array.isArray(parent)) {
    const index = key === '-' ? parent.length : Number(key);
    if (op.op === 'remove') parent.splice(index, 1);
    else if (op.op === 'add') parent.splice(index, 0, clone(op.value ?? null));
    else parent[index] = clone(op.value ?? null);
    return;
  }
  if (parent !== null && typeof parent === 'object') {
    const obj = parent as { [k: string]: Json };
    if (op.op === 'remove') delete obj[key];
    else obj[key] = clone(op.value ?? null);
    return;
  }
  throw new Error(`パスをたどれない: ${key}`);
}

function resolve(doc: Json, tokens: string[]): Json {
  let current: Json = doc;
  for (const token of tokens) {
    if (Array.isArray(current)) current = current[Number(token)]!;
    else if (current !== null && typeof current === 'object')
      current = (current as { [k: string]: Json })[token]!;
    else throw new Error(`パスをたどれない: ${token}`);
  }
  return current;
}

function clone(value: Json): Json {
  return value === null || typeof value !== 'object'
    ? value
    : (JSON.parse(JSON.stringify(value)) as Json);
}
