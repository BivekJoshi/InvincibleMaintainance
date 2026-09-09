import { lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { RequireAuth } from './RequireAuth';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { TechLayout } from '@/components/layout/TechLayout';
import { FIELD_ROLES, OFFICE_ROLES } from '@/config/constants';

// Route-level splitting: the marketing site never downloads the back office.
const HomePage = lazy(() => import('@/pages/public/HomePage'));
const ServicesPage = lazy(() => import('@/pages/public/ServicesPage'));
const ServiceDetailPage = lazy(() => import('@/pages/public/ServiceDetailPage'));
const PricingPage = lazy(() => import('@/pages/public/PricingPage'));
const ContactPage = lazy(() => import('@/pages/public/ContactPage'));
const BookingPage = lazy(() => import('@/pages/public/BookingPage'));
const ProjectsPage = lazy(() => import('@/pages/public/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('@/pages/public/ProjectDetailPage'));
const QuotationPublicPage = lazy(() => import('@/pages/public/QuotationPublicPage'));
const InvoicePublicPage = lazy(() => import('@/pages/public/InvoicePublicPage'));
const WarrantyPublicPage = lazy(() => import('@/pages/public/WarrantyPublicPage'));

const LoginPage = lazy(() => import('@/pages/public/LoginPage'));
const DashboardPage = lazy(() => import('@/pages/admin/DashboardPage'));
const LeadsPage = lazy(() => import('@/pages/admin/LeadsPage'));
const SlaBoardPage = lazy(() => import('@/pages/admin/SlaBoardPage'));
const LeadDetailPage = lazy(() => import('@/pages/admin/LeadDetailPage'));
const SurveysPage = lazy(() => import('@/pages/admin/SurveysPage'));
const SurveyReviewPage = lazy(() => import('@/pages/admin/SurveyReviewPage'));
const QuotationsPage = lazy(() => import('@/pages/admin/QuotationsPage'));
const QuotationBuilderPage = lazy(() => import('@/pages/admin/QuotationBuilderPage'));

const TechTodayPage = lazy(() => import('@/pages/tech/TechTodayPage'));
const SurveyListPage = lazy(() => import('@/pages/tech/SurveyListPage'));
const SurveyFormPage = lazy(() => import('@/pages/tech/SurveyFormPage'));
const TechJobPage = lazy(() => import('@/pages/tech/TechJobPage'));

const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

function Fallback() {
  return (
    <div className="flex min-h-[50dvh] items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />
    </div>
  );
}

export function AppRoutes() {
  const location = useLocation();
  return (
    <Suspense fallback={<Fallback />}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
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
              <Route path="/admin" element={<DashboardPage />} />
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
      </AnimatePresence>
    </Suspense>
  );
}
