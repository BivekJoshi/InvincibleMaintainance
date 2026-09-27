import { createContext, useContext } from 'react';

/**
 * Whether the form around a field can be changed right now. A `<fieldset disabled>` disables inputs, but an
 * EditableGrid's cells are not inputs, so the grid fields (`lineItems`, `grid`, `measurements`, `recipe`) read
 * this instead: `readOnly` is the form's `readOnly` prop, or a save in flight.
 */
export const FormModeContext = createContext({ readOnly: false });

/** @returns {{ readOnly: boolean }} */
export const useFormMode = () => useContext(FormModeContext);
