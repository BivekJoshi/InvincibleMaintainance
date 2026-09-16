import { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { RequireAuth } from './RequireAuth';
import { RouteFallback } from './PageOutlet';
import {
  HomePage, ServicesPage, ServiceDetailPage, PricingPage, ContactPage, BookingPage,
  ProjectsPage, ProjectDetailPage, QuotationPublicPage, InvoicePublicPage, WarrantyPublicPage,
  BlogPage, BlogPostPage, GenericPage, SettingsPage,
  LoginPage, LeadsPage, SlaBoardPage, LeadDetailPage, LeadBoardPage, CustomersPage, CustomerDetailPage, SurveysPage,
  SurveyReviewPage, QuotationsPage, QuotationBuilderPage, ResourceListPage, ResourceEditPage,
  HomeComposerPage, MediaLibraryPage,
  TechTodayPage, SurveyListPage, SurveyFormPage, TechJobPage, NotFoundPage,
} from './routeModules';
import { AdminHome, ContentHome } from './AdminLanding';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { AdminLayout } from '@/components/layout/AdminLayout/AdminLayout';
import { TechLayout } from '@/components/layout/TechLayout';
import { FIELD_ROLES, OFFICE_ROLES } from '@/config/constants';

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
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          {/* A CMS page, e.g. /about. Last: a static public route of the same name wins, and
              an address with no page behind it renders the not-found page. */}
          <Route path="/:slug" element={<GenericPage />} />
        </Route>

        <Route path="/login" element={<LoginPage />} />

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
            <Route element={<RequireAuth capability="customers:read" />}>
              <Route path="/admin/customers" element={<CustomersPage />} />
              <Route path="/admin/customers/:id" element={<CustomerDetailPage />} />
            </Route>
            <Route element={<RequireAuth capability="surveys:read" />}>
              <Route path="/admin/surveys" element={<SurveysPage />} />
              <Route path="/admin/surveys/:id" element={<SurveyReviewPage />} />
            </Route>
            <Route element={<RequireAuth capability="quotations:read" />}>
              <Route path="/admin/quotations" element={<QuotationsPage />} />
              <Route path="/admin/quotations/:id" element={<QuotationBuilderPage />} />
              {/* The rate card is a registry entry with its own address (see its entry's basePath) */}
              <Route path="/admin/rate-card" element={<ResourceListPage resource="rate-card" />} />
              <Route path="/admin/rate-card/new" element={<ResourceEditPage resource="rate-card" />} />
              <Route path="/admin/rate-card/:id" element={<ResourceEditPage resource="rate-card" />} />
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
          </Route>
        </Route>

        {/* Field app — technicians and surveyors */}
        <Route element={<RequireAuth roles={[...FIELD_ROLES, 'ADMIN', 'DISPATCHER']} />}>
          <Route element={<TechLayout />}>
            <Route path="/tech" element={<TechTodayPage />} />
            <Route path="/tech/jobs/:id" element={<TechJobPage />} />
            <Route path="/tech/surveys" element={<SurveyListPage />} />
            <Route path="/tech/surveys/:id" element={<SurveyFormPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
