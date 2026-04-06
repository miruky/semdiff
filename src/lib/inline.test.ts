import { describe, expect, it } from 'vitest';
import { affixDiff } from './inline';

describe('affixDiff', () => {
  it('共通の末尾を残し変わった桁だけを中央に切り出す', () => {
    expect(affixDiff('1.4.0', '2.0.0')).toEqual({
      prefix: '',
      suffix: '.0',
      fromMid: '1.4',
      toMid: '2.0',
    });
  });

  it('共通の接頭辞を取り除く', () => {
    expect(affixDiff('"^4.0.0"', '"^5.1.0"')).toEqual({
      prefix: '"^',
      suffix: '.0"',
      fromMid: '4.0',
      toMid: '5.1',
    });
  });

  it('片方が他方を含むときは中央が片側だけになる', () => {
    expect(affixDiff('abc', 'abcd')).toEqual({
      prefix: 'abc',
      suffix: '',
      fromMid: '',
      toMid: 'd',
    });
  });

  it('まったく異なる文字列は全体が中央になる', () => {
    expect(affixDiff('foo', 'bar')).toEqual({
      prefix: '',
      suffix: '',
      fromMid: 'foo',
      toMid: 'bar',
    });
  });

  it('接頭辞と接尾辞が重ならない', () => {
    // "aa" → "a" で接頭辞が末尾まで食い込まないこと
    expect(affixDiff('aa', 'a')).toEqual({
      prefix: 'a',
      suffix: '',
      fromMid: 'a',
      toMid: '',
    });
  });
});
