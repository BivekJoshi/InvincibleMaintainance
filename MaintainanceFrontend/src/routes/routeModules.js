import { lazy } from 'react';

/**
 * Every route's chunk, in one place.
 *
 * `lazy()` on its own can only start a download once the route is already on
 * screen, so a first visit to a page spends a network round trip with nothing
 * to show. Each entry here also carries `preload()`, which starts that same
 * import early — on hover, or when the shell goes idle — so the click that
 * follows renders from memory.
 *
 * This file imports no layout and no component, only page modules, so the
 * header can preload a route without pulling the router back in a cycle.
 *
 * @param {() => Promise<{ default: React.ComponentType }>} loader
 * @returns {React.LazyExoticComponent & { preload: () => Promise<unknown> }}
 */
function route(loader) {
  const Component = lazy(loader);
  let started;
  Component.preload = () => (started ??= loader());
  return Component;
}

// Public marketing site
export const HomePage = route(() => import('@/pages/public/HomePage/HomePage'));
export const ServicesPage = route(() => import('@/pages/public/ServicesPage/ServicesPage'));
export const ServiceDetailPage = route(() => import('@/pages/public/ServiceDetailPage/ServiceDetailPage'));
export const PricingPage = route(() => import('@/pages/public/PricingPage/PricingPage'));
export const ContactPage = route(() => import('@/pages/public/ContactPage/ContactPage'));
export const BookingPage = route(() => import('@/pages/public/BookingPage'));
export const ProjectsPage = route(() => import('@/pages/public/ProjectsPage/ProjectsPage'));
export const ProjectDetailPage = route(() => import('@/pages/public/ProjectDetailPage/ProjectDetailPage'));
export const QuotationPublicPage = route(() => import('@/pages/public/QuotationPublicPage/QuotationPublicPage'));
export const InvoicePublicPage = route(() => import('@/pages/public/InvoicePublicPage/InvoicePublicPage'));
export const WarrantyPublicPage = route(() => import('@/pages/public/WarrantyPublicPage/WarrantyPublicPage'));
export const BlogPage = route(() => import('@/pages/public/BlogPage/BlogPage'));
export const BlogPostPage = route(() => import('@/pages/public/BlogPostPage/BlogPostPage'));
export const GenericPage = route(() => import('@/pages/public/GenericPage/GenericPage'));

export const LoginPage = route(() => import('@/pages/public/LoginPage/LoginPage'));
export const ResetPasswordPage = route(() => import('@/pages/public/ResetPasswordPage/ResetPasswordPage'));

// Back office
export const DashboardPage = route(() => import('@/pages/admin/DashboardPage'));
export const LeadsPage = route(() => import('@/pages/admin/LeadsPage'));
export const SlaBoardPage = route(() => import('@/pages/admin/SlaBoardPage'));
export const LeadDetailPage = route(() => import('@/pages/admin/LeadDetailPage'));
export const LeadBoardPage = route(() => import('@/pages/admin/LeadBoardPage/LeadBoardPage'));
export const CustomersPage = route(() => import('@/pages/admin/CustomersPage'));
export const CustomerDetailPage = route(() => import('@/pages/admin/CustomerDetailPage/CustomerDetailPage'));
export const SurveysPage = route(() => import('@/pages/admin/SurveysPage'));
export const SurveyReviewPage = route(() => import('@/pages/admin/SurveyReviewPage'));
export const QuotationsPage = route(() => import('@/pages/admin/QuotationsPage'));
export const QuotationBuilderPage = route(() => import('@/pages/admin/QuotationBuilderPage/QuotationBuilderPage'));
export const ResourceListPage = route(() => import('@/pages/admin/ResourceListPage'));
export const ResourceEditPage = route(() => import('@/pages/admin/ResourceEditPage'));
export const HomeComposerPage = route(() => import('@/pages/admin/HomeComposerPage'));
export const MediaLibraryPage = route(() => import('@/pages/admin/MediaLibraryPage'));
export const SettingsPage = route(() => import('@/pages/admin/SettingsPage'));
export const UsersPage = route(() => import('@/pages/admin/UsersPage'));
export const RolesPage = route(() => import('@/pages/admin/RolesPage'));
export const AuditLogPage = route(() => import('@/pages/admin/AuditLogPage'));
export const LoginActivityPage = route(() => import('@/pages/admin/LoginActivityPage'));
export const MessageLogsPage = route(() => import('@/pages/admin/MessageLogsPage'));
export const MessageTemplatesPage = route(() => import('@/pages/admin/MessageTemplatesPage'));
export const MessageTemplateEditPage = route(() => import('@/pages/admin/MessageTemplateEditPage/MessageTemplateEditPage'));

// Field app
export const TechTodayPage = route(() => import('@/pages/tech/TechTodayPage'));
export const SurveyListPage = route(() => import('@/pages/tech/SurveyListPage'));
export const SurveyFormPage = route(() => import('@/pages/tech/SurveyFormPage'));
export const TechJobPage = route(() => import('@/pages/tech/TechJobPage'));

export const NotFoundPage = route(() => import('@/pages/NotFoundPage'));

/**
 * What each shell is likely to need next. A visitor on the marketing site
 * never pulls the back office down, and vice versa — the split that made the
 * chunks worth having stays intact.
 */
const GROUPS = {
  public: [ServicesPage, ProjectsPage, PricingPage, ContactPage, BookingPage, ServiceDetailPage, ProjectDetailPage, BlogPage],
  admin: [
    LeadsPage, LeadDetailPage, LeadBoardPage, CustomersPage, CustomerDetailPage, SlaBoardPage, SurveysPage, QuotationsPage, ResourceListPage, ResourceEditPage,
    HomeComposerPage, MediaLibraryPage, SettingsPage, UsersPage, AuditLogPage, MessageLogsPage,
  ],
  tech: [TechJobPage, SurveyListPage, SurveyFormPage],
};

/** Where the site nav's paths live, for preloading a link under the pointer. */
const BY_PATH = {
  '/': HomePage,
  '/services': ServicesPage,
  '/pricing': PricingPage,
  '/contact': ContactPage,
  '/book': BookingPage,
  '/projects': ProjectsPage,
  '/blog': BlogPage,
  '/login': LoginPage,
};

/** Starts the chunks a shell is likely to need next. Safe to call repeatedly. */
export function preloadGroup(name) {
  for (const page of GROUPS[name] ?? []) page.preload();
}

/** Starts the chunk behind a path — call it on hover or focus of a link. */
export function preloadPath(path) {
  const page = BY_PATH[path]
    ?? (path?.startsWith('/services/') ? ServiceDetailPage : path?.startsWith('/blog/') ? BlogPostPage : undefined);
  page?.preload();
}
