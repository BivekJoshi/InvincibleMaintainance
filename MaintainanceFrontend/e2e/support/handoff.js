/**
 * Phase L6: a customer's Accept raises the ADVANCE invoice for the ON_ACCEPT stage of the payment schedule (the
 * default one is 50 · 40 · 10), and the job cannot be scheduled, assigned or started until it is paid (422
 * ADVANCE_UNPAID). A spec whose point is not the gate pays it over the API first — as the office would — the same
 * way as the API suite's `payAdvance` (MaintainanceBackend/tests/api/helpers.js).
 *
 * @param {{ get: Function, post: Function }} accountant  `apiAs('ACCOUNTANT')` (or ADMIN)
 * @param {string} jobId
 * @returns {Promise<object|null>} the payment, or null when the job was not waiting for an advance
 */
export async function payAdvance(accountant, jobId) {
  const job = await accountant.get(`/admin/jobs/${jobId}`);
  const invoice = job.advance?.invoice;
  if (!job.advance?.awaitingAdvance || !invoice) return null;
  // Rupees in a request body; the balance is the server's paisa.
  return accountant.post(`/admin/invoices/${invoice.id}/payments`, {
    amount: invoice.balance / 100, method: 'BANK', reference: `E2E advance ${job.number}`,
  });
}
