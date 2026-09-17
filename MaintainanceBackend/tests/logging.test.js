import { describe, it, expect } from 'vitest';
import { runWithContext, getContext, setContext, isValidRequestId } from '../src/lib/requestContext.js';
import { createLogger, maskPhone } from '../src/lib/logger.js';
import { auditDiff, redactValue } from '../src/lib/auditDiff.js';

describe('requestContext', () => {
  it('is empty outside a run, and survives awaits inside one', async () => {
    expect(getContext()).toBeUndefined();
    await runWithContext({ requestId: 'req-00000001', actorType: 'public' }, async () => {
      await new Promise((r) => setTimeout(r, 5));
      expect(getContext()).toMatchObject({ requestId: 'req-00000001', actorType: 'public' });
      setContext({ userId: 'u1', role: 'ADMIN', actorType: 'user' });
      await Promise.resolve();
      expect(getContext()).toMatchObject({ requestId: 'req-00000001', userId: 'u1', actorType: 'user' });
    });
    expect(getContext()).toBeUndefined();
  });

  it('setContext outside a run is a no-op, not a crash', () => {
    expect(() => setContext({ userId: 'x' })).not.toThrow();
    expect(getContext()).toBeUndefined();
  });

  it('keeps concurrent runs apart', async () => {
    const seen = await Promise.all(['a', 'b', 'c'].map((id) => runWithContext({ requestId: `req-${id}-0000` }, async () => {
      await new Promise((r) => setTimeout(r, Math.random() * 10));
      return getContext().requestId;
    })));
    expect(seen).toEqual(['req-a-0000', 'req-b-0000', 'req-c-0000']);
  });
});

describe('isValidRequestId', () => {
  it.each(['abcdefgh', 'client-supplied.id_0001', 'A'.repeat(64), '3f0c6a1e-8a52-4c0e-9d51-0f6f3e1c2b7a'])('accepts %s', (id) => {
    expect(isValidRequestId(id)).toBe(true);
  });
  it.each(['short', 'x'.repeat(65), 'has space', 'new\nline', 'semi;colon', '', undefined, 42])('rejects %s', (id) => {
    expect(isValidRequestId(id)).toBe(false);
  });
});

describe('maskPhone', () => {
  it.each([
    ['9841234567', '******4567'],
    ['+977-9812345678', '******5678'],
    ['01-5407720', '******7720'],
  ])('%s → %s', (input, out) => { expect(maskPhone(input)).toBe(out); });

  it('leaves non-phones alone', () => {
    expect(maskPhone('Sita Sharma')).toBe('Sita Sharma');
    expect(maskPhone(null)).toBe(null);
  });
});

describe('logger', () => {
  const capture = () => {
    const lines = [];
    const logger = createLogger({ level: 'info', destination: { write: (c) => lines.push(String(c)) } });
    return { logger, out: () => lines.join('') };
  };

  it('redacts credentials at any depth the request carries them', () => {
    const { logger, out } = capture();
    logger.info({
      req: { headers: { authorization: 'Bearer abc.def.ghi', cookie: 'refresh_token=zzz' } },
      res: { headers: { 'set-cookie': 'refresh_token=yyy' } },
      body: { password: 'Password123', newPassword: 'n', currentPassword: 'c', otp: '123456' },
      data: { accessToken: 'at', refreshToken: 'rt', token: 't', passwordHash: 'h', tokenHash: 'th', publicToken: 'pt' },
      password: 'top-level',
    }, 'secrets');
    const text = out();
    for (const secret of ['abc.def.ghi', 'zzz', 'yyy', 'Password123', '123456', '"at"', '"rt"', 'top-level', '"pt"']) {
      expect(text).not.toContain(secret);
    }
    expect(text).toContain('[redacted]');
  });

  it('masks phones under the keys that carry them, and adds the context ids', () => {
    const { logger, out } = capture();
    runWithContext({ requestId: 'req-mixin-01', userId: 'user-1' }, () => {
      logger.info({ to: '9841234567', customer: { phone: '9812345678' } }, 'hello');
    });
    const line = JSON.parse(out());
    expect(line.to).toBe('******4567');
    expect(line.customer.phone).toBe('******5678');
    expect(line.requestId).toBe('req-mixin-01');
    expect(line.userId).toBe('user-1');
  });
});

describe('auditDiff', () => {
  it('keeps only the scalar fields that changed', () => {
    const before = { id: '1', name: 'Old', status: 'NEW', updatedAt: new Date('2026-01-01'), notes: null };
    const after = { id: '1', name: 'New', status: 'NEW', updatedAt: new Date('2026-01-02'), notes: null };
    expect(auditDiff('Lead', before, after)).toEqual({ before: { name: 'Old' }, after: { name: 'New' } });
  });

  it('a create has no before, and lists what was set', () => {
    expect(auditDiff('Faq', null, { id: 'f1', question: 'Q?', answer: 'A', sortOrder: 0 })).toEqual({
      before: null, after: { id: 'f1', question: 'Q?', answer: 'A', sortOrder: 0 },
    });
  });

  it('a delete has no after', () => {
    expect(auditDiff('Faq', { id: 'f1', question: 'Q?' }, null)).toEqual({ before: { id: 'f1', question: 'Q?' }, after: null });
  });

  it('compares Json by value and keeps Devanagari', () => {
    expect(auditDiff('Setting', { value: { a: 1 } }, { value: { a: 1 } })).toEqual({ before: null, after: null });
    expect(auditDiff('Setting', { value: 'पुरानो' }, { value: 'नयाँ' })).toEqual({ before: { value: 'पुरानो' }, after: { value: 'नयाँ' } });
  });

  it('ignores relation fields and nested writes', () => {
    const d = auditDiff('Quotation', { status: 'DRAFT', items: [{ id: 'x' }] }, { status: 'SENT', items: { create: [] }, customer: { name: 'C' } });
    expect(d).toEqual({ before: { status: 'DRAFT' }, after: { status: 'SENT' } });
  });

  it('redacts secrets but still shows that they changed', () => {
    const d = auditDiff('User', { passwordHash: '$argon2id$old', name: 'A' }, { passwordHash: '$argon2id$new', name: 'A' });
    expect(d).toEqual({ before: { passwordHash: '[redacted]' }, after: { passwordHash: '[redacted]' } });
    expect(redactValue('otpCode', '123456')).toBe('[redacted]');
    expect(redactValue('webhookSecret', 's')).toBe('[redacted]');
    expect(redactValue('name', 'Ram')).toBe('Ram');
  });
});
