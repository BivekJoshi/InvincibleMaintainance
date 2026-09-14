import { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { RequireAuth } from './RequireAuth';
import { RouteFallback } from './PageOutlet';
import {
  HomePage, ServicesPage, ServiceDetailPage, PricingPage, ContactPage, BookingPage,
  ProjectsPage, ProjectDetailPage, QuotationPublicPage, InvoicePublicPage, WarrantyPublicPage,
  LoginPage, LeadsPage, SlaBoardPage, LeadDetailPage, SurveysPage,
  SurveyReviewPage, QuotationsPage, QuotationBuilderPage, ResourceListPage, ResourceEditPage,
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
        </Route>

        <Route path="/login" element={<LoginPage />} />

        {/* Back office — every role except the field app's */}
        <Route element={<RequireAuth roles={OFFICE_ROLES} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminHome />} />
            <Route element={<RequireAuth capability="leads:read" />}>
              <Route path="/admin/leads" element={<LeadsPage />} />
              <Route path="/admin/leads/:id" element={<LeadDetailPage />} />
              <Route path="/admin/sla" element={<SlaBoardPage />} />
            </Route>
            <Route element={<RequireAuth capability="surveys:read" />}>
              <Route path="/admin/surveys" element={<SurveysPage />} />
              <Route path="/admin/surveys/:id" element={<SurveyReviewPage />} />
            </Route>
            <Route element={<RequireAuth capability="quotations:read" />}>
              <Route path="/admin/quotations" element={<QuotationsPage />} />
              <Route path="/admin/quotations/:id" element={<QuotationBuilderPage />} />
            </Route>
            {/* CMS resources from config/admin/resourceRegistry.js; each page checks its entry's own capability */}
            <Route element={<RequireAuth capability="cms:read" />}>
              <Route path="/admin/content" element={<ContentHome />} />
              <Route path="/admin/content/:resource" element={<ResourceListPage />} />
              <Route path="/admin/content/:resource/new" element={<ResourceEditPage />} />
              <Route path="/admin/content/:resource/:id" element={<ResourceEditPage />} />
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
