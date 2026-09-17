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
};

/** A safe DOM id for a field, from the form's `useId()` prefix and the field name. */
const fieldId = (prefix, name) => `${prefix}-${String(name).replace(/[^\w-]/g, '-')}`;

/**
 * Lays fields out on a two-column grid. A field takes the full width unless its
 * spec says `span: 'half'`; a group always does.
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
        if (field.type === 'group') {
          return (
            <div key={key} className="sm:col-span-2">
              <GroupField field={field}>
                <FieldGrid fields={field.fields} idPrefix={idPrefix} />
              </GroupField>
            </div>
          );
        }
        const Component = FIELD_TYPES[field.type];
        if (!Component) throw new Error(`ResourceForm: unknown field type "${field.type}" for "${field.name}"`);
        return (
          <div key={key} className={cn(field.span === 'half' ? 'sm:col-span-1' : 'sm:col-span-2')}>
            <Component field={field} id={fieldId(idPrefix, field.name)} />
          </div>
        );
      })}
    </div>
  );
}
