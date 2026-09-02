import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { RequireAuth } from './RequireAuth';
import { SiteLayout } from '@/layouts/SiteLayout';
import { AdminLayout } from '@/layouts/AdminLayout';
import { TechLayout } from '@/layouts/TechLayout';

// Route-level splitting: the marketing site never downloads the back office.
const HomePage = lazy(() => import('@/pages/site/HomePage'));
const ServicesPage = lazy(() => import('@/pages/site/ServicesPage'));
const ServiceDetailPage = lazy(() => import('@/pages/site/ServiceDetailPage'));
const PricingPage = lazy(() => import('@/pages/site/PricingPage'));
const ContactPage = lazy(() => import('@/pages/site/ContactPage'));
const QuotationPublicPage = lazy(() => import('@/pages/site/QuotationPublicPage'));
const WarrantyPublicPage = lazy(() => import('@/pages/site/WarrantyPublicPage'));

const LoginPage = lazy(() => import('@/pages/admin/LoginPage'));
const DashboardPage = lazy(() => import('@/pages/admin/DashboardPage'));
const LeadsPage = lazy(() => import('@/pages/admin/LeadsPage'));
const SlaBoardPage = lazy(() => import('@/pages/admin/SlaBoardPage'));

const TechTodayPage = lazy(() => import('@/pages/tech/TechTodayPage'));

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
            <Route path="/quotation/:token" element={<QuotationPublicPage />} />
            <Route path="/warranty/:token" element={<WarrantyPublicPage />} />
          </Route>

          <Route path="/login" element={<LoginPage />} />

          {/* Back office */}
          <Route element={<RequireAuth />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<DashboardPage />} />
              <Route element={<RequireAuth capability="leads:read" />}>
                <Route path="/admin/leads" element={<LeadsPage />} />
                <Route path="/admin/sla" element={<SlaBoardPage />} />
              </Route>
            </Route>
          </Route>

          {/* Technician PWA */}
          <Route element={<RequireAuth roles={['TECHNICIAN', 'ADMIN', 'DISPATCHER']} />}>
            <Route element={<TechLayout />}>
              <Route path="/tech" element={<TechTodayPage />} />
            </Route>
          </Route>

          <Route path="/admin/*" element={<Navigate to="/admin" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
}
