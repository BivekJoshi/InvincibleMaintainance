import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { RequireAuth } from './RequireAuth';
import { RouteFallback } from './PageOutlet';
import {
  HomePage, ServicesPage, ServiceDetailPage, PricingPage, ContactPage, BookingPage,
  ProjectsPage, ProjectDetailPage, QuotationPublicPage, InvoicePublicPage, WarrantyPublicPage, VisitPublicPage,
  BlogPage, BlogPostPage, GenericPage, SettingsPage,
  LoginPage, LeadsPage, SlaBoardPage, LeadDetailPage, LeadBoardPage, CustomersPage, CustomerDetailPage, SurveysPage,
  SurveyReviewPage, QuotationsPage, QuotationBuilderPage, QuotationPrintPage, ResourceListPage, ResourceEditPage,
  HomeComposerPage, MediaLibraryPage, ResetPasswordPage,
  JobsPage, JobDetailPage, DispatchBoardPage, StockPage,
  InvoicesPage, InvoiceDetailPage, InvoicePrintPage, PaymentsPage, FinanceReportsPage, ReportsPage,
  WarrantiesPage, WarrantyDetailPage, WarrantyClaimsPage, AmcContractsPage, AmcContractDetailPage, ServiceRemindersPage,
  UsersPage, RolesPage, AuditLogPage, LoginActivityPage, MessageLogsPage, MessageTemplatesPage, MessageTemplateEditPage,
  TechTodayPage, SurveyListPage, SurveyFormPage, TechJobPage, TechHistoryPage, NotFoundPage,
} from './routeModules';
import { AdminHome, ContentHome } from './AdminLanding';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { AdminLayout } from '@/components/layout/AdminLayout/AdminLayout';
import { FIELD_ROLES, OFFICE_ROLES } from '@/config/constants';

/**
 * The field app's shell is loaded with its pages, not with the site: it carries the sync engine, both
 * queues, the field API and its en/ne copy (Phase H2), none of which a visitor to the marketing site needs.
 */
const TechLayout = lazy(() => import('@/components/layout/TechLayout').then((m) => ({ default: m.TechLayout })));

/**
 * The route table only. Two things it deliberately does not do:
 *
 *   - It does not key `<Routes>` on the pathname. That remounted the layout —
 *     header, footer, every subscription — on every single navigation.
 *   - It does not hold the Suspense boundary for pages inside a shell. Each
 *     layout's `<PageOutlet />` does, so a chunk still in flight replaces the
 *     content area and not the whole screen.
 *
 * The boundary here is only for the routes that have no shell of their own.
 */
export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback className="min-h-dvh" />}>
      <Routes>
        {/* Public marketing site */}
        <Route element={<SiteLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/services/:slug" element={<ServiceDetailPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/book" element={<BookingPage />} />
          <Route path="/book/:slug" element={<BookingPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:slug" element={<ProjectDetailPage />} />
          <Route path="/quotation/:token" element={<QuotationPublicPage />} />
          <Route path="/invoice/:token" element={<InvoicePublicPage />} />
          <Route path="/warranty/:token" element={<WarrantyPublicPage />} />
          {/* The customer confirms a booked site visit, or asks for another time (Phase L5) */}
          <Route path="/visit/:token" element={<VisitPublicPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          {/* A CMS page, e.g. /about. Last: a static public route of the same name wins, and
              an address with no page behind it renders the not-found page. */}
          <Route path="/:slug" element={<GenericPage />} />
        </Route>

        <Route path="/login" element={<LoginPage />} />
        {/* Where a reset link and a new account's invite land */}
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* A quotation's print (Phase L4): the back office's, but a sheet of paper — no shell, no sidebar */}
        <Route element={<RequireAuth roles={OFFICE_ROLES} />}>
          <Route element={<RequireAuth capability="quotations:read" />}>
            <Route path="/admin/quotations/:id/print" element={<QuotationPrintPage />} />
          </Route>
          {/* An invoice's print (Phase I), the same pattern */}
          <Route element={<RequireAuth capability="invoices:read" />}>
            <Route path="/admin/invoices/:id/print" element={<InvoicePrintPage />} />
          </Route>
        </Route>

        {/* Back office — every role except the field app's */}
        <Route element={<RequireAuth roles={OFFICE_ROLES} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminHome />} />
            <Route element={<RequireAuth capability="leads:read" />}>
              <Route path="/admin/leads" element={<LeadsPage />} />
              {/* A static segment outranks :id */}
              <Route path="/admin/leads/board" element={<LeadBoardPage />} />
              <Route path="/admin/leads/:id" element={<LeadDetailPage />} />
              <Route path="/admin/sla" element={<SlaBoardPage />} />
            </Route>
            {/* The sales and operations reports (Phase I10): each group checks its own capability (sales, ops, costs:read);
                /admin/reports opens the first the role may see, /admin/reports/lost (Phase L1's address) Sales › Lost leads */}
            <Route path="/admin/reports" element={<ReportsPage />} />
            <Route path="/admin/reports/:group" element={<ReportsPage />} />
            {/* Finance (Phase I): invoices, payments, the finance reports; expenses are a registry entry (its basePath) */}
            <Route element={<RequireAuth capability="invoices:read" />}>
              <Route path="/admin/invoices" element={<InvoicesPage />} />
              <Route path="/admin/invoices/:id" element={<InvoiceDetailPage />} />
            </Route>
            <Route element={<RequireAuth capability="payments:read" />}>
              <Route path="/admin/finance/payments" element={<PaymentsPage />} />
            </Route>
            <Route element={<RequireAuth capability="reports:finance" />}>
              <Route path="/admin/finance/reports" element={<FinanceReportsPage />} />
            </Route>
            <Route element={<RequireAuth capability="expenses:read" />}>
              <Route path="/admin/expenses" element={<ResourceListPage resource="expenses" />} />
              <Route path="/admin/expenses/new" element={<ResourceEditPage resource="expenses" />} />
              <Route path="/admin/expenses/:id" element={<ResourceEditPage resource="expenses" />} />
            </Route>
            <Route element={<RequireAuth capability="customers:read" />}>
              <Route path="/admin/customers" element={<CustomersPage />} />
              <Route path="/admin/customers/:id" element={<CustomerDetailPage />} />
            </Route>
            <Route element={<RequireAuth capability="surveys:read" />}>
              <Route path="/admin/surveys" element={<SurveysPage />} />
              <Route path="/admin/surveys/:id" element={<SurveyReviewPage />} />
              {/* Inspection templates (Phase L5): a registry entry with its own address (its basePath) */}
              <Route path="/admin/inspection-templates" element={<ResourceListPage resource="inspection-templates" />} />
              <Route path="/admin/inspection-templates/new" element={<ResourceEditPage resource="inspection-templates" />} />
              <Route path="/admin/inspection-templates/:id" element={<ResourceEditPage resource="inspection-templates" />} />
            </Route>
            <Route element={<RequireAuth capability="quotations:read" />}>
              <Route path="/admin/quotations" element={<QuotationsPage />} />
              <Route path="/admin/quotations/:id" element={<QuotationBuilderPage />} />
            </Route>
            {/* The rate library and its trades (Phase L2), and the terms library (Phase L4): registry entries with their own addresses (their basePath) */}
            <Route element={<RequireAuth capability="rates:read" />}>
              {['rate-card', 'trades', 'quotation-terms'].map((resource) => [
                <Route key={resource} path={`/admin/${resource}`} element={<ResourceListPage resource={resource} />} />,
                <Route key={`${resource}-new`} path={`/admin/${resource}/new`} element={<ResourceEditPage resource={resource} />} />,
                <Route key={`${resource}-id`} path={`/admin/${resource}/:id`} element={<ResourceEditPage resource={resource} />} />,
              ])}
            </Route>
            {/* Operations (Phase H1). The registry entries have their own addresses (their basePath). */}
            <Route element={<RequireAuth capability="jobs:read" />}>
              <Route path="/admin/jobs" element={<JobsPage />} />
              <Route path="/admin/jobs/:id" element={<JobDetailPage />} />
              <Route path="/admin/job-templates" element={<ResourceListPage resource="job-templates" />} />
              <Route path="/admin/job-templates/new" element={<ResourceEditPage resource="job-templates" />} />
              <Route path="/admin/job-templates/:id" element={<ResourceEditPage resource="job-templates" />} />
            </Route>
            <Route element={<RequireAuth capability="jobs:dispatch" />}>
              <Route path="/admin/dispatch" element={<DispatchBoardPage />} />
            </Route>
            <Route element={<RequireAuth capability="technicians:read" />}>
              <Route path="/admin/technicians" element={<ResourceListPage resource="technicians" />} />
              <Route path="/admin/technicians/new" element={<ResourceEditPage resource="technicians" />} />
              <Route path="/admin/technicians/:id" element={<ResourceEditPage resource="technicians" />} />
            </Route>
            <Route element={<RequireAuth capability="materials:read" />}>
              <Route path="/admin/stock" element={<StockPage />} />
              {['materials', 'material-categories', 'suppliers'].map((resource) => [
                <Route key={resource} path={`/admin/${resource}`} element={<ResourceListPage resource={resource} />} />,
                <Route key={`${resource}-new`} path={`/admin/${resource}/new`} element={<ResourceEditPage resource={resource} />} />,
                <Route key={`${resource}-id`} path={`/admin/${resource}/:id`} element={<ResourceEditPage resource={resource} />} />,
              ])}
            </Route>
            {/* Aftercare (Phase I). A claim's own address opens the queue with its decision sheet (the claim notification's link). */}
            <Route element={<RequireAuth capability="warranties:read" />}>
              <Route path="/admin/warranties" element={<WarrantiesPage />} />
              <Route path="/admin/warranties/:id" element={<WarrantyDetailPage />} />
              <Route path="/admin/warranty-claims" element={<WarrantyClaimsPage />} />
              <Route path="/admin/warranty-claims/:id" element={<WarrantyClaimsPage />} />
            </Route>
            <Route element={<RequireAuth capability="amc:read" />}>
              <Route path="/admin/amc-contracts" element={<AmcContractsPage />} />
              <Route path="/admin/amc-contracts/:id" element={<AmcContractDetailPage />} />
            </Route>
            <Route element={<RequireAuth capability="reminders:read" />}>
              <Route path="/admin/service-reminders" element={<ServiceRemindersPage />} />
            </Route>
            {/* CMS resources from config/admin/resourceRegistry.js; each page checks its entry's own capability */}
            <Route element={<RequireAuth capability="cms:read" />}>
              <Route path="/admin/content" element={<ContentHome />} />
              {/* Bespoke content screens; a static segment outranks :resource */}
              <Route path="/admin/content/home" element={<HomeComposerPage />} />
              <Route path="/admin/content/media" element={<MediaLibraryPage />} />
              <Route path="/admin/content/:resource" element={<ResourceListPage />} />
              <Route path="/admin/content/:resource/new" element={<ResourceEditPage />} />
              <Route path="/admin/content/:resource/:id" element={<ResourceEditPage />} />
            </Route>
            {/* Anyone with settings:read sees the values; only ADMIN may save them (the API's rule) */}
            <Route element={<RequireAuth capability="settings:read" />}>
              <Route path="/admin/platform/settings" element={<SettingsPage />} />
            </Route>
            {/* ADMIN only — the API refuses every one of these to any other role */}
            <Route element={<RequireAuth roles={['ADMIN']} />}>
              <Route path="/admin/platform/users" element={<UsersPage />} />
              <Route path="/admin/platform/roles" element={<RolesPage />} />
              <Route path="/admin/platform/audit" element={<AuditLogPage />} />
              <Route path="/admin/platform/login-activity" element={<LoginActivityPage />} />
              <Route path="/admin/platform/messages" element={<MessageLogsPage />} />
              <Route path="/admin/platform/message-templates" element={<MessageTemplatesPage />} />
              <Route path="/admin/platform/message-templates/:key" element={<MessageTemplateEditPage />} />
            </Route>
          </Route>
        </Route>

        {/* Field app — technicians and surveyors */}
        <Route element={<RequireAuth roles={[...FIELD_ROLES, 'ADMIN', 'DISPATCHER']} />}>
          <Route element={<TechLayout />}>
            <Route path="/tech" element={<TechTodayPage />} />
            <Route path="/tech/jobs/:id" element={<TechJobPage />} />
            <Route path="/tech/history" element={<TechHistoryPage />} />
            <Route path="/tech/history/:id" element={<TechJobPage readOnly />} />
            <Route path="/tech/surveys" element={<SurveyListPage />} />
            <Route path="/tech/surveys/:id" element={<SurveyFormPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
