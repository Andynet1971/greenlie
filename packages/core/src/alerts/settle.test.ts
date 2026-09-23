import { describe, expect, it } from 'vitest';
import { settle } from './settle.js';

describe('settle', () => {
  it('waits until there are enough runs', () => {
    expect(settle(['down'], 2)).toBeUndefined();
  });

  it('acts on a single run when one confirmation is enough', () => {
    expect(settle(['ok', 'down'], 1)).toBe('down');
  });

  it('ignores a single bad run between good ones', () => {
    expect(settle(['ok', 'ok', 'down'], 2)).toBeUndefined();
  });

  it('settles once the failure repeats', () => {
    expect(settle(['ok', 'down', 'down'], 2)).toBe('down');
  });

  it('settles a flapping failure on its most severe form', () => {
    expect(settle(['thin', 'down', 'thin'], 3)).toBe('down');
    expect(settle(['slow', 'thin'], 2)).toBe('thin');
  });

  it('needs the recovery confirmed too', () => {
    expect(settle(['down', 'down', 'ok'], 2)).toBeUndefined();
    expect(settle(['down', 'ok', 'ok'], 2)).toBe('ok');
  });

  it('treats learning and ok as the same healthy picture', () => {
    expect(settle(['unknown', 'ok'], 2)).toBe('ok');
  });
});
