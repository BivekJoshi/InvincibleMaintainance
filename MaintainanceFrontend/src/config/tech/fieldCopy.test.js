import { describe, expect, it } from 'vitest';
import { FIELD_COPY, fieldCopy } from '@/config/tech/fieldCopy';
import { JOB_STATUSES } from '@/config/constants';
import { FIELD_PHOTO_KINDS } from '@/helpers/fieldJob';

/** Every key path in a copy object, with the kind of value at it (a function or words). */
function shape(value, path = '') {
  if (typeof value === 'function') return [`${path}()`];
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => shape(v, path ? `${path}.${k}` : k));
  return [path];
}

describe('field copy', () => {
  it('has the same keys in English and Nepali — J1 moves both into its catalogues', () => {
    expect(shape(FIELD_COPY.ne).sort()).toEqual(shape(FIELD_COPY.en).sort());
  });

  it('names every job status and every photo kind in both languages', () => {
    for (const locale of ['en', 'ne']) {
      for (const status of JOB_STATUSES) expect(FIELD_COPY[locale].status[status], `${locale} ${status}`).toBeTruthy();
      for (const kind of [...FIELD_PHOTO_KINDS, 'SIGNATURE']) expect(FIELD_COPY[locale].photos.kinds[kind]).toBeTruthy();
    }
  });

  it('says counts in words, and Nepali in Devanagari', () => {
    expect(fieldCopy('en').job.finish.openTasks(1)).toBe('1 checklist item is still open — tick it before completing.');
    expect(fieldCopy('en').job.finish.openTasks(2)).toBe('2 checklist items are still open — tick them before completing.');
    expect(fieldCopy('en').sync.what(3, 1)).toBe('3 changes and 1 photo');
    expect(fieldCopy('ne').job.finish.openTasks(2)).toMatch(/चेकलिस्ट बाँकी/);
    expect(fieldCopy('fr')).toBe(FIELD_COPY.en);
  });
});
