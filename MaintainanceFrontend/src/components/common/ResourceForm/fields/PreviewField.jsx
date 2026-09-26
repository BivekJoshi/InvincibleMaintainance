/**
 * `{ type: 'preview', name, label, component }` — a panel worked out from the form's values, with no
 * value of its own: nothing is loaded into it or sent from it (`DISPLAY_TYPES` in `formValues.js`).
 * `component` renders inside the form and reads the values with `useWatch()`; it gets the spec as
 * `field`. The rate library's live **Cost vs rate** card is one, shown only with `capability: 'costs:read'`
 * like any other field.
 *
 * @param {{ field: { label?: string, component: import('react').ComponentType<{ field: object, id: string }> }, id: string }} props
 */
export function PreviewField({ field, id }) {
  const Panel = field.component;
  return (
    <section aria-labelledby={field.label ? `${id}-title` : undefined} className="min-w-0">
      <Panel field={field} id={id} />
    </section>
  );
}
