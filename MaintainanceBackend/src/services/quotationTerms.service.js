import { prisma } from '../lib/prisma.js';
import { makeCrud } from './crud.service.js';

/**
 * The terms library (Phase L4): reusable quotation terms, in English and (optionally) Nepali. A new
 * quotation starts with the default's English body; the builder inserts any entry. Exactly one default:
 * saving one as the default takes the flag from the rest, in the same transaction.
 */
const crud = makeCrud({ model: 'quotationTerms', label: 'Terms', searchFields: ['title', 'body'] });

async function withOneDefault(write, isDefault) {
  if (!isDefault) return write(prisma);
  return prisma.$transaction(async (tx) => {
    await tx.quotationTerms.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    return write(tx);
  });
}

export const quotationTerms = {
  ...crud,
  create: (data) => withOneDefault((db) => db.quotationTerms.create({ data }), data.isDefault),
  async update(id, data) {
    await crud.get(id);
    return withOneDefault((db) => db.quotationTerms.update({ where: { id }, data }), data.isDefault);
  },
};
