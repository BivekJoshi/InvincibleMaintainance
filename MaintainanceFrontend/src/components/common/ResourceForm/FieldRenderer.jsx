import { useWatch } from 'react-hook-form';
import { cn } from '@/helpers/utils';
import { TextField } from './fields/TextField';
import { TextareaField } from './fields/TextareaField';
import { ProseField } from './fields/ProseField';
import { NumberField } from './fields/NumberField';
import { MoneyField } from './fields/MoneyField';
import { SwitchField } from './fields/SwitchField';
import { SelectField } from './fields/SelectField';
import { RelationField } from './fields/RelationField';
import { DateField } from './fields/DateField';
import { DateTimeField } from './fields/DateTimeField';
import { SlugField } from './fields/SlugField';
import { StringListField } from './fields/StringListField';
import { KeyValueField } from './fields/KeyValueField';
import { MediaField } from './fields/MediaField';
import { MediaListField } from './fields/MediaListField';
import { GroupField } from './fields/GroupField';
import { WeekdaysField } from './fields/WeekdaysField';
import { ObjectListField } from './fields/ObjectListField';
import { LineItemsField } from './fields/LineItemsField';
import { ChecklistField } from './fields/ChecklistField';
import { RecipeField } from './fields/RecipeField';
import { PreviewField } from './fields/PreviewField';
import { GridField } from './fields/GridField';
import { MeasurementsField } from './fields/MeasurementsField';
import { PaymentScheduleField } from './fields/PaymentScheduleField';
import { CheckboxField } from './fields/CheckboxField';
import { PhotoUploadField } from './fields/PhotoUploadField';

/**
 * Field type → component. `markdown` is an alias of `prose`: the public site renders
 * long copy as plain paragraphs, not markdown (see `components/site/ProseBody`), and
 * the editor has to produce exactly what the site shows.
 */
const FIELD_TYPES = {
  text: TextField,
  textarea: TextareaField,
  prose: ProseField,
  markdown: ProseField,
  number: NumberField,
  money: MoneyField,
  switch: SwitchField,
  select: SelectField,
  enum: SelectField,
  relation: RelationField,
  date: DateField,
  datetime: DateTimeField,
  slug: SlugField,
  stringList: StringListField,
  keyValue: KeyValueField,
  media: MediaField,
  mediaList: MediaListField,
  weekdays: WeekdaysField,
  objectList: ObjectListField,
  lineItems: LineItemsField,
  checklist: ChecklistField,
  recipe: RecipeField,
  preview: PreviewField,
  grid: GridField,
  measurements: MeasurementsField,
  paymentSchedule: PaymentScheduleField,
  checkbox: CheckboxField,
  // Phase I: one photo uploaded to the form's own endpoint (an expense's bill), with no media library.
  photoUpload: PhotoUploadField,
};

/** A safe DOM id for a field, from the form's `useId()` prefix and the field name. */
const fieldId = (prefix, name) => `${prefix}-${String(name).replace(/[^\w-]/g, '-')}`;

/** One field in its grid cell: full width unless `span: 'half'`; a group always is. */
function FieldCell({ field, idPrefix }) {
  // A hidden field keeps its value and still validates; it is simply not shown (a builder's other tab).
  if (field.hidden && field.type !== 'group') return null;
  if (field.type === 'group') {
    return (
      <div className="sm:col-span-2">
        <GroupField field={field}>
          <FieldGrid fields={field.fields} idPrefix={idPrefix} />
        </GroupField>
      </div>
    );
  }
  const Component = FIELD_TYPES[field.type];
  if (!Component) throw new Error(`ResourceForm: unknown field type "${field.type}" for "${field.name}"`);
  return (
    <div className={cn(field.span === 'half' ? 'sm:col-span-1' : 'sm:col-span-2')}>
      <Component field={field} id={fieldId(idPrefix, field.name)} />
    </div>
  );
}

/**
 * A field whose spec follows the form's values: `adapt(values)` returns overrides for the spec
 * (`{ disabled: true, description }`), `{ hidden: true }` to leave it out, or nothing. A hidden
 * field keeps its value, so a request is built from what the values mean, not from what is shown.
 */
function AdaptiveFieldCell({ field, idPrefix }) {
  const values = useWatch();
  const { hidden, ...overrides } = field.adapt(values ?? {}) ?? {};
  if (hidden) return null;
  return <FieldCell field={{ ...field, ...overrides }} idPrefix={idPrefix} />;
}

/**
 * Lays fields out on a two-column grid. A field takes the full width unless its
 * spec says `span: 'half'`; a group always does. A field with `adapt` follows the
 * form's values (see `AdaptiveFieldCell`).
 *
 * @param {object} props
 * @param {object[]} props.fields
 * @param {string} props.idPrefix
 */
export function FieldGrid({ fields, idPrefix }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {fields.map((field) => {
        const key = field.name ?? field.label;
        return field.adapt
          ? <AdaptiveFieldCell key={key} field={field} idPrefix={idPrefix} />
          : <FieldCell key={key} field={field} idPrefix={idPrefix} />;
      })}
    </div>
  );
}
