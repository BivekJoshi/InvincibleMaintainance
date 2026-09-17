import { describe, it, expect } from 'vitest';
import { placeholdersIn, previewTemplate, renderTemplate } from '../src/services/notify.service.js';
import { maskAddress } from '../src/services/message.service.js';

describe('message templates', () => {
  it('finds each placeholder once, in order, with or without spaces', () => {
    expect(placeholdersIn('Hi {{name}}, {{ quotation.number }} for {{name}}', 'Subject {{appName}}'))
      .toEqual(['name', 'quotation.number', 'appName']);
    expect(placeholdersIn(undefined, '')).toEqual([]);
  });

  it('previews Devanagari with nested vars and reports what is missing', () => {
    const out = previewTemplate(
      { subject: '{{appName}} बाट', body: 'नमस्ते {{name}}, कोटेसन {{q.number}} को रकम रु. {{q.total}}' },
      { name: 'सीता', q: { number: 'QT-2083-0001', total: '' } },
    );
    expect(out).toEqual({
      subject: ' बाट',
      body: 'नमस्ते सीता, कोटेसन QT-2083-0001 को रकम रु. ',
      placeholders: ['appName', 'name', 'q.number', 'q.total'],
      missing: ['appName', 'q.total'],
    });
  });

  it('renders 0 as a value, not as missing', () => {
    expect(renderTemplate('{{n}} left', { n: 0 })).toBe('0 left');
    expect(previewTemplate({ body: '{{n}}' }, { n: 0 }).missing).toEqual([]);
  });
});

describe('maskAddress', () => {
  it.each([
    ['9841234567', '******4567'],
    ['+977 984-1234567', '******4567'],
    ['01-5407720', '******7720'],
    ['ram@example.com', 'ra***@example.com'],
    ['r@x.np', 'r***@x.np'],
    ['short', '***hort'],
    [null, null],
  ])('%s → %s', (input, masked) => {
    expect(maskAddress(input)).toBe(masked);
  });
});
