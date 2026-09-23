import { describe, expect, it } from 'vitest';
import { interpolate } from './interpolate.js';

describe('interpolate', () => {
  it('replaces variables inside nested strings', () => {
    const input = { a: 'Bearer ${TOKEN}', list: ['${HOST}/x', 3], deep: { b: '${HOST}' } };
    expect(interpolate(input, { TOKEN: 't0k', HOST: 'https://h' })).toEqual({
      value: { a: 'Bearer t0k', list: ['https://h/x', 3], deep: { b: 'https://h' } },
      missing: [],
    });
  });

  it('leaves everything that is not a string alone', () => {
    const input = { n: 1, yes: true, nothing: null };
    expect(interpolate(input, {}).value).toEqual(input);
  });

  it('reports each missing variable once', () => {
    expect(interpolate(['${A}', '${A}', '${B}'], {}).missing).toEqual(['A', 'B']);
  });

  it('allows an empty value, which is set, just empty', () => {
    expect(interpolate('x${EMPTY}y', { EMPTY: '' })).toEqual({ value: 'xy', missing: [] });
  });

  it('cannot change the structure, whatever the secret contains', () => {
    expect(interpolate({ token: '${T}' }, { T: 'a: b\n- c' }).value).toEqual({ token: 'a: b\n- c' });
  });

  it('ignores text that only looks like a variable', () => {
    expect(interpolate('$HOME and ${1X}', {}).value).toBe('$HOME and ${1X}');
  });
});
