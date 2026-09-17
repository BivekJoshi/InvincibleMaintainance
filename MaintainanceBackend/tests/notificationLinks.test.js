import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every in-app notification link is an SPA path the notification panel can open as it
 * is: `/admin/...` for office staff, `/tech/...` for field staff. A link written any
 * other way (`/leads/:id`) only worked because the panel guessed.
 *
 * Checks the source rather than one call each, so a new notify caller cannot slip past.
 */
const SERVICES = join(import.meta.dirname, '../src/services');

/** `link: <expression>` in notification data — not `vars.link`, which is an SMS/email URL. */
function linkExpressions(source) {
  const out = [];
  for (const line of source.split('\n')) {
    const m = line.match(/\blink:\s*(.+?),?\s*(?:\}|$)/);
    if (!m) continue;
    if (/^vars\.link|^link\s*\?\?/.test(m[1])) continue;
    out.push(m[1].trim());
  }
  return out;
}

describe('notification links', () => {
  const files = readdirSync(SERVICES).filter((f) => f.endsWith('.js'));
  const found = files.flatMap((f) => linkExpressions(readFileSync(join(SERVICES, f), 'utf8')).map((expr) => ({ f, expr })));

  it('finds the notification callers it checks', () => {
    expect(found.length).toBeGreaterThan(8);
  });

  it.each(['lead.service.js', 'sla.service.js', 'quotation.service.js', 'job.service.js', 'survey.service.js',
    'material.service.js', 'warranty.service.js', 'invoice.service.js'])('%s writes only /admin or /tech paths, or web URLs', (file) => {
    const exprs = found.filter((x) => x.f === file).map((x) => x.expr);
    expect(exprs.length).toBeGreaterThan(0);
    for (const expr of exprs) {
      const ok = /^[`'](\/admin\/|\/admin[`']|\/tech\/)/.test(expr)
        || /^admin[A-Z]\w*Path\(/.test(expr)
        || /^webUrl\(/.test(expr)
        || /^changing\.length === 1 \? adminLeadPath\(.+\) : '\/admin\/leads'/.test(expr);
      expect(ok, `${file}: link: ${expr}`).toBe(true);
    }
  });

  it('never builds a link on APP_URL, the API origin', () => {
    for (const f of files) {
      expect(readFileSync(join(SERVICES, f), 'utf8'), f).not.toMatch(/env\.appUrl\}\/(leads|admin|quotation|invoice|warranty)/);
    }
  });
});
