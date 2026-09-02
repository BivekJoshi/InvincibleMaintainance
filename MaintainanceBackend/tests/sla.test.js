import { describe, it, expect } from 'vitest';
import { slaState, decorateSla } from '../src/services/sla.service.js';

const minutes = (n) => new Date(Date.now() + n * 60000);

describe('SLA state — the 2-hour promise', () => {
  it('reports ok when there is comfortable time left', () => {
    expect(slaState({ slaDueAt: minutes(90), firstResponseAt: null }, 30)).toBe('ok');
  });

  it('warns inside the warning window', () => {
    expect(slaState({ slaDueAt: minutes(20), firstResponseAt: null }, 30)).toBe('at_risk');
  });

  it('breaches once the deadline passes with no response', () => {
    expect(slaState({ slaDueAt: minutes(-5), firstResponseAt: null }, 30)).toBe('breached');
  });

  it('records met when the response beat the deadline', () => {
    expect(slaState({ slaDueAt: minutes(30), firstResponseAt: minutes(-10) }, 30)).toBe('met');
  });

  it('still reports breached when the response came late — responding does not erase the miss', () => {
    expect(slaState({ slaDueAt: minutes(-60), firstResponseAt: minutes(-5) }, 30)).toBe('breached');
  });

  it('reports none when no SLA was set', () => {
    expect(slaState({ slaDueAt: null, firstResponseAt: null })).toBe('none');
  });

  it('decorates a lead with a countdown', () => {
    const d = decorateSla({ slaDueAt: minutes(45), firstResponseAt: null });
    expect(d.sla.state).toBe('ok');
    expect(d.sla.minutesRemaining).toBeGreaterThan(43);
    expect(d.sla.minutesRemaining).toBeLessThanOrEqual(45);
  });
});
