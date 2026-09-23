import { describe, expect, it } from 'vitest';
import { composeAlert } from './message.js';

const at = new Date('2026-09-23T08:30:00Z');

describe('composeAlert', () => {
  it('names the failure in the title', () => {
    expect(
      composeAlert({
        checkName: 'Job feed',
        transition: { kind: 'failing', from: 'ok', to: 'thin' },
        reason: 'delivered 3, under 50% of the usual 100',
        at,
      }),
    ).toEqual({
      title: '[Greenlie] Job feed is THIN',
      body: 'Job feed: delivered 3, under 50% of the usual 100.\nAt 2026-09-23T08:30:00.000Z.',
    });
  });

  it('says what it was before when one failure turns into another', () => {
    const alert = composeAlert({
      checkName: 'API',
      transition: { kind: 'changed', from: 'slow', to: 'down' },
      reason: 'answered 503, expected 200',
      at,
    });
    expect(alert.title).toBe('[Greenlie] API is DOWN');
    expect(alert.body).toContain('It was slow before.');
  });

  it('announces a recovery with what it recovered from', () => {
    const alert = composeAlert({
      checkName: 'API',
      transition: { kind: 'recovered', from: 'down', to: 'ok' },
      reason: 'answered 200 in 90ms',
      at,
    });
    expect(alert.title).toBe('[Greenlie] API recovered (was down)');
    expect(alert.body).toBe('API: answered 200 in 90ms.\nAt 2026-09-23T08:30:00.000Z.');
  });
});
