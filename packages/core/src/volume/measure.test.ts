import { describe, expect, it } from 'vitest';
import { measureVolume } from './measure.js';

describe('measureVolume', () => {
  it('counts the items of the list at the path', () => {
    expect(measureVolume({ data: { jobs: [1, 2, 3] } }, '$.data.jobs')).toEqual({ ok: true, volume: 3 });
  });

  it('measures an empty list as zero — a real volume, not an error', () => {
    expect(measureVolume({ items: [] }, '$.items')).toEqual({ ok: true, volume: 0 });
  });

  it('works when the whole body is the list', () => {
    expect(measureVolume(['a', 'b'], '$')).toEqual({ ok: true, volume: 2 });
  });

  it('treats a missing path as a changed API, not as zero', () => {
    expect(measureVolume({ results: [] }, '$.items')).toEqual({
      ok: false,
      error: 'the response has nothing at $.items',
    });
  });

  it.each([
    [{ items: null }, 'null'],
    [{ items: { a: 1 } }, 'an object'],
    [{ items: 'none' }, 'a string'],
    [{ items: 3 }, 'a number'],
  ])('refuses a non-list: %j', (body, found) => {
    expect(measureVolume(body, '$.items')).toEqual({ ok: false, error: `expected a list at $.items, found ${found}` });
  });

  it('says so when the body is not JSON at all — the maintenance page case', () => {
    expect(measureVolume('<html>maintenance</html>', '$.items')).toEqual({ ok: false, error: 'the response is not JSON' });
  });

  it('reports a missing path inside a body that is not an object', () => {
    expect(measureVolume(42, '$.items')).toEqual({ ok: false, error: 'the response has nothing at $.items' });
  });
});
