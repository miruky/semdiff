// 値が変わった葉で、文字列としてどこが変わったのかを示すための最小編集の切り出し。
// 共通の接頭辞・接尾辞を取り除き、中央の差し替え部分だけを強調できるようにする。
// "1.4.0" → "2.0.0" のような版番号や "^4.0.0" → "^5.1.0" のような範囲指定で、
// 変わった桁だけが目に入るようにするのが狙い。

export interface AffixDiff {
  // 両者で一致する先頭・末尾
  prefix: string;
  suffix: string;
  // 中央の差し替え部分(片方が空になることもある)
  fromMid: string;
  toMid: string;
}

export function affixDiff(from: string, to: string): AffixDiff {
  const max = Math.min(from.length, to.length);
  let p = 0;
  while (p < max && from[p] === to[p]) p += 1;
  let s = 0;
  while (s < max - p && from[from.length - 1 - s] === to[to.length - 1 - s]) s += 1;
  return {
    prefix: from.slice(0, p),
    suffix: from.slice(from.length - s),
    fromMid: from.slice(p, from.length - s),
    toMid: to.slice(p, to.length - s),
  };
}
