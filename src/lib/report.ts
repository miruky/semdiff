// 差分木を共有・記録向けのMarkdownへ書き出す。表の各行が1件の変更に対応する。
import { flattenLeaves, type DiffNode, type Json } from './diff';

const KIND_LABEL = { added: '追加', removed: '削除', changed: '変更' } as const;

function cell(value: Json | undefined): string {
  if (value === undefined) return '';
  // 表のセルを壊さないようにパイプと改行を無害化する
  return JSON.stringify(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function toMarkdown(node: DiffNode): string {
  const leaves = flattenLeaves(node);
  const added = leaves.filter((l) => l.kind === 'added').length;
  const removed = leaves.filter((l) => l.kind === 'removed').length;
  const changed = leaves.filter((l) => l.kind === 'changed').length;

  const lines = ['# 構造差分', '', `追加 ${added} / 削除 ${removed} / 変更 ${changed}`, ''];
  if (leaves.length === 0) {
    lines.push('差分なし。2つの入力は意味的に同一。');
    return lines.join('\n');
  }

  lines.push('| 種別 | パス | 変更 |', '| :--- | :--- | :--- |');
  for (const leaf of leaves) {
    const path = leaf.path === '' ? '(ルート)' : leaf.path;
    let change: string;
    if (leaf.kind === 'changed') change = `\`${cell(leaf.before)}\` → \`${cell(leaf.after)}\``;
    else if (leaf.kind === 'added') change = `\`${cell(leaf.after)}\``;
    else change = `\`${cell(leaf.before)}\``;
    lines.push(`| ${KIND_LABEL[leaf.kind]} | \`${path}\` | ${change} |`);
  }
  return lines.join('\n');
}
