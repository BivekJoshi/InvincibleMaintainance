import { expect } from '@playwright/test';

/**
 * Approves in the builder's open "Approve this quotation" dialog (Phase L4's margin gate). The dialog asks for an
 * acknowledgement up front when a row's cost is unknown; a known margin below `quotation.minMarginPct` is the API's
 * to spot — its 422 LOW_MARGIN brings the box up, and the approval is sent again with it ticked.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} remark
 * @returns {Promise<'acknowledged'|'approved'>} whether a low or unknown margin had to be acknowledged
 */
export async function approveInDialog(page, remark) {
  const dialog = page.getByRole('dialog', { name: 'Approve this quotation' });
  await expect(dialog).toBeVisible();
  const ack = dialog.getByRole('checkbox');
  await dialog.getByRole('textbox').fill(remark);
  let acknowledged = false;
  if (await ack.count()) {
    await ack.check();
    acknowledged = true;
  }
  await dialog.getByRole('button', { name: 'Approve' }).click();
  // Either the dialog closes, or the API answered LOW_MARGIN and the box is there, unticked.
  const asked = await ack.waitFor({ state: 'visible', timeout: 4000 })
    .then(async () => !(await ack.isChecked()))
    .catch(() => false);
  if (asked) {
    await expect(dialog.getByRole('alert')).toContainText(/margin/i);
    await ack.check();
    await dialog.getByRole('button', { name: 'Approve' }).click();
    acknowledged = true;
  }
  await expect(dialog).toBeHidden();
  return acknowledged ? 'acknowledged' : 'approved';
}

/** "Rs. 1,23,456.50" for a paisa amount — the SPA's `formatNpr`, for asserting what a page shows. */
export const rupeesText = (paisa) => `Rs. ${(paisa / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
