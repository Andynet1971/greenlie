import { describe, expect, it } from 'vitest';
import { VERDICTS, isFailing, severity, worst, type Judgement } from './verdict.js';

describe('isFailing', () => {
  it('stays quiet only for ok and unknown', () => {
    expect(VERDICTS.filter((v) => !isFailing(v))).toEqual(['ok', 'unknown']);
  });
});

describe('severity', () => {
  it('ranks down above everything and ok below everything', () => {
    expect(severity('down')).toBeGreaterThan(severity('thin'));
    expect(severity('thin')).toBeGreaterThan(severity('slow'));
    expect(severity('unknown')).toBeGreaterThan(severity('ok'));
  });
});

describe('worst', () => {
  const slow: Judgement = { verdict: 'slow', reason: 'slow' };
  const thin: Judgement = { verdict: 'thin', reason: 'thin' };

  it('keeps the more severe judgement, whichever side it is on', () => {
    expect(worst(slow, thin)).toBe(thin);
    expect(worst(thin, slow)).toBe(thin);
  });

  it('keeps the first one on a tie', () => {
    const other: Judgement = { verdict: 'slow', reason: 'other' };
    expect(worst(slow, other)).toBe(slow);
  });
});
