import { describe, expect, it } from 'vitest';
import { parsePath, resolvePath } from './path.js';

describe('parsePath', () => {
  it.each([
    ['$', []],
    ['$.items', ['items']],
    ['$.data.jobs', ['data', 'jobs']],
    ['$.results[0].items', ['results', 0, 'items']],
    ['$[2]', [2]],
    ['$.page-data.$ref_1', ['page-data', '$ref_1']],
  ])('parses %s', (path, segments) => {
    expect(parsePath(path)).toEqual(segments);
  });

  it('requires the $ root', () => {
    expect(() => parsePath('data.jobs')).toThrow(/must start with "\$"/);
  });

  it.each([
    ['$.', '"."'],
    ['$..items', '"..items"'],
    ['$[x]', '"[x]"'],
    ['$.items extra', '" extra"'],
  ])('points at what is wrong in %s', (path, rest) => {
    expect(() => parsePath(path)).toThrow(`unexpected ${rest}`);
  });
});

describe('resolvePath', () => {
  const body = { data: { jobs: [{ id: 1 }, { id: 2 }], empty: null } };

  it('walks keys and indexes', () => {
    expect(resolvePath(body, ['data', 'jobs', 1, 'id'])).toEqual({ found: true, value: 2 });
  });

  it('returns the root for an empty path', () => {
    expect(resolvePath(body, [])).toEqual({ found: true, value: body });
  });

  it('finds a key whose value is null', () => {
    expect(resolvePath(body, ['data', 'empty'])).toEqual({ found: true, value: null });
  });

  it.each([
    [['data', 'posts'], '$.data.posts'],
    [['data', 'jobs', 5], '$.data.jobs[5]'],
    [['data', 'empty', 'x'], '$.data.empty.x'],
    [['data', 'jobs', 0, 'id', 'x'], '$.data.jobs[0].id.x'],
  ] as const)('reports how far it got before %j went missing', (segments, missing) => {
    expect(resolvePath(body, segments)).toEqual({ found: false, missing });
  });

  it('does not follow inherited properties', () => {
    expect(resolvePath({}, ['toString'])).toEqual({ found: false, missing: '$.toString' });
  });
});
