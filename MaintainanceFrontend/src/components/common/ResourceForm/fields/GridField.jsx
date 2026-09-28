import { useCallback, useMemo } from 'react';
import { useController } from 'react-hook-form';
import { EditableGrid } from '@/components/common/EditableGrid/EditableGrid';
import { FormField } from '../FormField';
import { useFormMode } from '../formMode';
import { cellMessages } from './cellMessages';

const blankRow = (columns) => Object.fromEntries(columns.filter((c) => c.editor).map((c) => [c.key, c.editor === 'boolean' ? false : '']));

/**
 * `{ type: 'grid', columns, makeRow?, maxItems?, emptyText?, footer?(rows) }` — an array of small objects
 * edited as a spreadsheet: the kit's EditableGrid behind a ResourceForm field (the only way a page reaches
 * it). `columns` are EditableGrid column specs (keep them in a module constant). A row left completely
 * empty is dropped on save. Read-only while the form is.
 */
export function GridField({ field, id }) {
  const { field: input, fieldState } = useController({ name: field.name });
  const { readOnly: formReadOnly } = useFormMode();
  const rows = Array.isArray(input.value) ? input.value : [];
  const error = fieldState.error;
  const listError = error?.message ?? error?.root?.message;
  const rowErrors = useCallback((i) => cellMessages(error?.[i]), [error]);
  const { columns } = field;
  const makeRow = useMemo(() => field.makeRow ?? (() => blankRow(columns)), [field.makeRow, columns]);
  const onChange = (next) => {
    input.onChange(next);
    input.onBlur();
  };

  return (
    <FormField id={id} field={field} error={listError ? { message: listError } : undefined} as="fieldset">
      {() => (
        <EditableGrid
          ariaLabel={field.label}
          columns={columns}
          rows={rows}
          onChange={onChange}
          makeRow={makeRow}
          readOnly={field.disabled || formReadOnly}
          maxRows={field.maxItems ?? 200}
          rowErrors={rowErrors}
          focusRef={input.ref}
          emptyText={field.emptyText}
          addLabels={{ item: field.addLabel ?? 'Add row' }}
          footer={field.footer?.(rows)}
        />
      )}
    </FormField>
  );
}
