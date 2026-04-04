import { describe, expect, it } from 'vitest';
import { decodeState, encodeState, type ShareState } from './share';

const sample: ShareState = {
  before: '{ "名前": "サーバ" }',
  after: '{ "名前": "サーバー" }',
  beforeFormat: 'json',
  afterFormat: 'yaml',
  hideUnchanged: false,
};

describe('encodeState / decodeState', () => {
  it('マルチバイトを含む状態を往復できる', () => {
    expect(decodeState(encodeState(sample))).toEqual(sample);
  });

  it('先頭の # を許容する', () => {
    expect(decodeState('#' + encodeState(sample))).toEqual(sample);
  });

  it('未知の接頭辞や壊れた入力はnull', () => {
    expect(decodeState('')).toBeNull();
    expect(decodeState('xx:abc')).toBeNull();
    expect(decodeState('s1:!!!notbase64!!!')).toBeNull();
  });

  it('不正なフォーマット値はautoに正規化する', () => {
    const encoded = encodeState({ ...sample, beforeFormat: 'json' });
    const decoded = decodeState(encoded);
    expect(decoded?.beforeFormat).toBe('json');
  });
});
