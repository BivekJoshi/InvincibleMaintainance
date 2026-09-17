/**
 * The on/off words for the operations registry entries, where `isActive` means "offered for new
 * work", not "on the website". Pass `what` for the deletion sentence.
 *
 * @param {string} kept  what survives a delete, e.g. 'Jobs that used it keep it.'
 * @returns {Partial<import('../resourceRegistry').ActiveCopy>}
 */
export const inUseCopy = (kept) => ({
  column: 'In use',
  switchLabel: 'In use:',
  turnOn: 'Put back in use',
  turnOff: 'Retire',
  turnedOn: 'is back in use',
  turnedOff: 'is retired — not offered for new work',
  deleteOne: `It is no longer offered. ${kept}`,
  deleteMany: `They are no longer offered. ${kept}`,
});
