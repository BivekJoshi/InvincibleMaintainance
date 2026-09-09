import { fiscalYear } from './nepaliDate.js';

/**
 * Allocates a gap-free document number inside the caller's transaction.
 * Must be called with a Prisma transaction client so the counter row lock
 * is held until the document row is written.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {'QT'|'JOB'|'INV'|'AMC'|'PAY'|'SRV'} scope
 */
export async function nextNumber(tx, scope, date = new Date()) {
  const year = fiscalYear(date);
  const counter = await tx.counter.upsert({
    where: { scope_year: { scope, year } },
    create: { scope, year, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${scope}-${year}-${String(counter.value).padStart(4, '0')}`;
}
