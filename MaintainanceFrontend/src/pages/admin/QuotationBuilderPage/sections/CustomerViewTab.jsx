import { useState } from 'react';
import { Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { QuotationDocument } from '@/components/documents/QuotationDocument';
import { SavedOnlyNotice } from './TakeoffTab';

/**
 * The Customer view tab: the saved quotation as the customer's link shows it — the same `QuotationDocument`
 * the public page renders, in English or Nepali. It reads only the customer's fields, so a manager's view shows
 * no cost either.
 */
export function CustomerViewTab({ quotation, dirty, defaultLocale = 'en' }) {
  const [locale, setLocale] = useState(defaultLocale === 'ne' ? 'ne' : 'en');
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
        <CardContent className="p-6 sm:p-8">
          <QuotationDocument quotation={quotation} locale={locale} />
        </CardContent>
      </Card>
    </div>
  );
}
