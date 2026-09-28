import { Navigate, useLocation, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageTransition } from '@/three/motion/motionKit';
import { useAuth } from '@/hooks/useAuth';
import { useReportParams } from '@/hooks/useReportParams';
import { REPORT_GROUPS, reportGroupsFor } from '@/config/admin/financeViews';
import { LeadSourcesReport } from './sections/LeadSourcesReport';
import { FunnelReport } from './sections/FunnelReport';
import { SlaReport } from './sections/SlaReport';
import { LostReport } from './sections/LostReport';
import { TechniciansReport } from './sections/TechniciansReport';
import { WarrantyClaimsReport } from './sections/WarrantyClaimsReport';
import { JobMarginReport } from './sections/JobMarginReport';

const SECTIONS = {
  'lead-sources': LeadSourcesReport,
  funnel: FunnelReport,
  sla: SlaReport,
  lost: LostReport,
  technicians: TechniciansReport,
  'warranty-claims': WarrantyClaimsReport,
  'job-margin': JobMarginReport,
};

const DESCRIPTIONS = {
  sales: 'Where leads come from, how far they get, whether the two-hour promise holds, and why leads are lost.',
  operations: 'What each technician finished, and how often finished work comes back under warranty.',
  'job-margin': 'What each finished job was invoiced against what it cost — materials, labour and expenses.',
};

/**
 * `/admin/reports/:group` (Phase I10) — the sales and operations reports the API serves, one screen per audience and
 * each behind its own capability (its nav item's): **Sales reports** (`reports:sales`: lead sources, funnel, SLA
 * compliance, lost leads — Phase L1's report folded in), **Operations reports** (`reports:ops`: technicians,
 * warranty claims by type and by service) and **Job margin** (`costs:read` only — the money wall). Every report has
 * the shared date range (in the URL, with its BS twin) and the API's CSV for the same filters. `/admin/reports` opens
 * the first group the role may see; `/admin/reports/lost` (the old address) opens Sales › Lost leads.
 */
export default function ReportsPage() {
  const { group: groupKey } = useParams();
  const { search } = useLocation();
  const { can } = useAuth();
  const allowed = reportGroupsFor(can);
  const group = REPORT_GROUPS.find((g) => g.value === groupKey);

  if (groupKey === 'lost') {
    const rest = new URLSearchParams(search);
    rest.set('report', 'lost');
    return <Navigate to={`/admin/reports/sales?${rest}`} replace />;
  }
  if (!group || !can(group.capability)) {
    return <Navigate to={allowed.length ? `/admin/reports/${allowed[0].value}` : '/admin'} replace />;
  }
  return <ReportGroup key={group.value} group={group} />;
}

function ReportGroup({ group }) {
  const [params, patch] = useReportParams({ report: group.reports[0].value });
  const report = group.reports.some((r) => r.value === params.report) ? params.report : group.reports[0].value;
  const Section = SECTIONS[report];
  const single = group.reports.length === 1;

  return (
    <PageTransition>
      <PageHeader title={group.label} description={DESCRIPTIONS[group.value]} />
      {single ? <Section params={params} patch={patch} /> : (
        <Tabs value={report} onValueChange={(next) => patch({ report: next })}>
          <div className="-mx-1 mb-4 overflow-x-auto px-1">
            <TabsList aria-label={group.label}>
              {group.reports.map((r) => <TabsTrigger key={r.value} value={r.value}>{r.label}</TabsTrigger>)}
            </TabsList>
          </div>
          <TabsContent value={report}>
            <Section params={params} patch={patch} />
          </TabsContent>
        </Tabs>
      )}
    </PageTransition>
  );
}
