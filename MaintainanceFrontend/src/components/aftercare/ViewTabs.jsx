import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * An aftercare list's tabs (`config/admin/aftercareViews.js`) — the quotation queue's look. The tab lives in
 * the URL, so the caller passes the current one and writes the next.
 *
 * @param {{ views: { value: string, label: string }[], value: string, onChange: (view: string) => void,
 *   label: string, children?: import('react').ReactNode }} props  `children` sits beside the tabs (a day picker)
 */
export function ViewTabs({ views, value, onChange, label, children }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Tabs value={value} onValueChange={onChange} className="min-w-0 max-w-full">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList aria-label={label} className="h-auto w-max">
            {views.map((v) => (
              <TabsTrigger key={v.value} value={v.value} className="whitespace-nowrap">{v.label}</TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>
      {children}
    </div>
  );
}
