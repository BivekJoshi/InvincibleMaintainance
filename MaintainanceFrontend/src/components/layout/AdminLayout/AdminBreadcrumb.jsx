import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { breadcrumbsFor } from '@/config/admin/adminNav';

/** Group › screen › New | Edit, read from the current path — no page has to set it. */
export function AdminBreadcrumb({ className }) {
  const { pathname } = useLocation();
  const crumbs = breadcrumbsFor(pathname);
  if (!crumbs.length) return null;

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList className="flex-nowrap">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={`${crumb.label}-${i}`}>
              {i > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem className="min-w-0">
                {last ? (
                  <BreadcrumbPage className="truncate text-gold"><b>{crumb.label}</b></BreadcrumbPage>
                ) : crumb.to ? (
                  <BreadcrumbLink asChild><Link to={crumb.to} className="truncate">{crumb.label}</Link></BreadcrumbLink>
                ) : (
                  <span className="truncate">{crumb.label}</span>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
