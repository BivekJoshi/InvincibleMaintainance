import { PageHeader } from '@/components/common/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageTransition } from '@/three/motion/motionKit';
import { useReportParams } from '@/hooks/useReportParams';
import { FINANCE_REPORTS } from '@/config/admin/financeViews';
import { AgingReport } from './sections/AgingReport';
import { RevenueReport } from './sections/RevenueReport';
import { CollectionsReport } from './sections/CollectionsReport';
import { StatementReport } from './sections/StatementReport';

const SECTIONS = { aging: AgingReport, revenue: RevenueReport, collections: CollectionsReport, statement: StatementReport };

/**
 * `/admin/finance/reports` (Phase I5, `reports:finance`): **Aging** (what is owed, by days past due, as of now — a
 * bucket drills down to its invoices), **Revenue** (by month, service or technician: taxable, VAT, invoiced,
 * collected, outstanding), **Collections** (money received by method) and a **Customer statement**. Every report has
 * its table, its CSV (the API's, with the filters on screen), and the range in AD and BS; charts only where a shape
 * says something (revenue by month). Every figure is the server's. The tab, range and grouping live in the URL.
 */
export default function FinanceReportsPage() {
  const [params, patch] = useReportParams({ report: 'aging' });
  const report = SECTIONS[params.report] ? params.report : 'aging';
  const Section = SECTIONS[report];

  return (
    <PageTransition>
      <PageHeader
        title="Finance reports"
        description="What is owed and for how long, what was billed and collected, and each customer’s account."
      />
      <Tabs value={report} onValueChange={(next) => patch({ report: next, bucket: undefined, groupBy: undefined })}>
        <div className="-mx-1 mb-4 overflow-x-auto px-1">
          <TabsList aria-label="Finance reports">
            {FINANCE_REPORTS.map((r) => <TabsTrigger key={r.value} value={r.value}>{r.label}</TabsTrigger>)}
          </TabsList>
        </div>
        <TabsContent value={report}>
          <Section params={params} patch={patch} />
        </TabsContent>
      </Tabs>
    </PageTransition>
  );
}
