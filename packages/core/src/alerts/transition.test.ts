import { describe, expect, it } from 'vitest';
import { detectTransition } from './transition.js';

describe('detectTransition', () => {
  it('says nothing when a new check starts out healthy', () => {
    expect(detectTransition(undefined, 'ok')).toBeNull();
    expect(detectTransition(undefined, 'unknown')).toBeNull();
  });

  it('alerts when a new check starts out broken', () => {
    expect(detectTransition(undefined, 'down')).toEqual({ kind: 'failing', from: undefined, to: 'down' });
  });

  it('alerts once when a healthy check starts failing', () => {
    expect(detectTransition('ok', 'thin')).toEqual({ kind: 'failing', from: 'ok', to: 'thin' });
  });

  it('does not repeat itself while the failure lasts', () => {
    expect(detectTransition('down', 'down')).toBeNull();
  });

  it('alerts when one failure turns into another', () => {
    expect(detectTransition('slow', 'down')).toEqual({ kind: 'changed', from: 'slow', to: 'down' });
  });

  it('announces the recovery', () => {
    expect(detectTransition('thin', 'ok')).toEqual({ kind: 'recovered', from: 'thin', to: 'ok' });
  });

  it('stays quiet between healthy states', () => {
    expect(detectTransition('unknown', 'ok')).toBeNull();
    expect(detectTransition('ok', 'ok')).toBeNull();
  });
});
