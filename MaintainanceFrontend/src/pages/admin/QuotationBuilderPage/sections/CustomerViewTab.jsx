import { useState } from 'react';
import { Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { QuotationDocument } from '@/components/documents/QuotationDocument';
import { SavedOnlyNotice } from './TakeoffTab';

/**
 * The Customer view tab: the saved quotation as the customer's link shows it — the same `QuotationDocument`
 * the public page and the print render, in English or Nepali (starting in the customer's language). It reads only
 * the customer's fields, so a manager's view shows no cost either.
 *
 * `options` are the panel's two switches as they stand in the form (`showMeasurements`, `summaryOnly`, Phase L4):
 * the document follows them before they are saved, so the office sees what each one does. Every figure is still
 * the saved quotation's.
 *
 * @param {{ quotation: object, dirty: boolean, defaultLocale?: string,
 *   options?: { showMeasurements?: boolean, summaryOnly?: boolean } }} props
 */
export function CustomerViewTab({ quotation, dirty, defaultLocale = 'en', options }) {
  const [locale, setLocale] = useState(defaultLocale === 'ne' ? 'ne' : 'en');
  const shown = {
    ...quotation,
    ...(typeof options?.showMeasurements === 'boolean' ? { showMeasurements: options.showMeasurements } : {}),
    ...(typeof options?.summaryOnly === 'boolean' ? { summaryOnly: options.summaryOnly } : {}),
  };
  return (
    <div className="space-y-3">
      <SavedOnlyNotice dirty={dirty} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Eye className="h-4 w-4" aria-hidden /> What the customer sees on their link.
        </p>
        <ToggleGroup type="single" size="sm" value={locale} onValueChange={(v) => { if (v) setLocale(v); }} aria-label="Language">
          <ToggleGroupItem value="en">English</ToggleGroupItem>
          <ToggleGroupItem value="ne"><span lang="ne">नेपाली</span></ToggleGroupItem>
        </ToggleGroup>
      </div>
      <Card data-testid="customer-view">
        <CardContent className="p-4 sm:p-8">
          <QuotationDocument quotation={shown} locale={locale} />
        </CardContent>
      </Card>
    </div>
  );
}
