import { useState } from 'react';
import { useController } from 'react-hook-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ProseBody } from '@/components/site/ProseBody';
import { splitParagraphs } from '@/helpers/prose';
import { FormField } from '../FormField';

/**
 * `{ type: 'prose' }` (alias `markdown`) — long copy with Write and Preview tabs.
 *
 * The public site shows this as plain paragraphs split on blank lines — no markdown,
 * no HTML — so the preview renders it with the same `ProseBody` the service page uses.
 */
export function ProseField({ field, id }) {
  const { field: input, fieldState } = useController({ name: field.name });
  const [tab, setTab] = useState('write');
  const count = splitParagraphs(input.value).length;
  const spec = { ...field, description: field.description ?? 'Plain text. Leave an empty line between paragraphs.' };

  return (
    <FormField id={id} field={spec} error={fieldState.error}>
      {(control) => (
        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="write">Write</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            <span className="text-xs text-muted-foreground">{count} paragraph{count === 1 ? '' : 's'}</span>
          </div>
          <TabsContent value="write" className="mt-2">
            <Textarea
              {...control}
              ref={input.ref}
              name={input.name}
              rows={field.rows ?? 10}
              value={input.value ?? ''}
              onChange={input.onChange}
              onBlur={input.onBlur}
              placeholder={field.placeholder}
              disabled={field.disabled}
            />
          </TabsContent>
          <TabsContent value="preview" className="mt-2">
            <div className="min-h-[160px] rounded-md border bg-background p-4">
              {count
                ? <ProseBody body={input.value} />
                : <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </FormField>
  );
}
