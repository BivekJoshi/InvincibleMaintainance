import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { describe, it, expect } from 'vitest';
import { MESSAGE_KEYS, nestVars, placeholdersIn, sampleVarsFor } from '@/config/admin/messageKeys';

/** Every `templateKey: '…'` the API's services send. */
const SERVICES = resolve(cwd(), '../MaintainanceBackend/src/services');
const sent = new Set(readdirSync(SERVICES).flatMap((f) => [
  ...readFileSync(resolve(SERVICES, f), 'utf8').matchAll(/(?:templateKey:\s*|invite \? )'([a-z_]+)'/g),
].map((m) => m[1])));

describe('message keys', () => {
  it('describes every key the API sends', () => {
    expect(sent.size).toBeGreaterThan(15);
    for (const key of sent) expect(MESSAGE_KEYS[key], key).toBeTruthy();
  });

  it('finds placeholders as the API does', () => {
    const texts = ['नमस्ते {{name}}, {{ quotation.number }} {{name}}', 'Subject {{appName}} {{ bad key }} {{x.y.z}}'];
    expect(placeholdersIn(...texts)).toEqual(['name', 'quotation.number', 'appName', 'x.y.z']);
    // The same pattern as the API's (importing the service would load its config).
    const source = readFileSync(resolve(SERVICES, 'notify.service.js'), 'utf8');
    expect(source).toContain('const PLACEHOLDER = /\\{\\{\\s*([\\w.]+)\\s*\\}\\}/g;');
  });

  it('fills sample values by name, and a dotted path by its last part', () => {
    expect(sampleVarsFor(['name', 'quotation.number', 'nothing'])).toEqual({
      name: 'Sita Rai', 'quotation.number': 'QT-2083-0001', nothing: '',
    });
    expect(nestVars({ name: 'राम', 'quotation.number': 'QT-1', 'quotation.total': '5' }))
      .toEqual({ name: 'राम', quotation: { number: 'QT-1', total: '5' } });
  });
});
