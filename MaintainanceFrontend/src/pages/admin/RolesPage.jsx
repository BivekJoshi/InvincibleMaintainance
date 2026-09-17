import { Fragment } from 'react';
import { Check, Minus } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { PageTransition } from '@/three/motion/motionKit';
import { ROLES, ROLE_DESCRIPTIONS } from '@/config/constants';
import { capabilityMatrix } from '@/helpers/capabilityMatrix';
import { titleCase } from '@/helpers/format';

const matrix = capabilityMatrix(ROLES);

/**
 * `/admin/platform/roles` (ADMIN) — what each role can do, read from the same permission map
 * the navigation uses (`helpers/permissions.js`, held to the API's by a parity test).
 * Read-only: roles are decided in code, not here. A fixed matrix, not a server list, so it
 * is a plain table rather than a DataTable.
 */
export default function RolesPage() {
  return (
    <PageTransition>
      <PageHeader
        title="Roles & permissions"
        description="What each role can see and do. The server enforces the same rules on every request."
      />
      <dl className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ROLES.map((role) => (
          <div key={role} className="rounded-lg border p-3">
            <dt className="text-sm font-semibold">{titleCase(role)}</dt>
            <dd className="mt-0.5 text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</dd>
          </div>
        ))}
      </dl>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[760px] text-sm">
          <caption className="sr-only">Which role holds each permission</caption>
          <thead className="sticky top-0 bg-muted/60 text-left">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Permission</th>
              {ROLES.map((role) => (
                <th key={role} scope="col" className="px-2 py-2 text-center text-xs font-medium">{titleCase(role)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((group) => (
              <Fragment key={group.domain}>
                <tr className="border-t bg-muted/20">
                  <th scope="colgroup" colSpan={ROLES.length + 1} className="px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </th>
                </tr>
                {group.rows.map((row) => (
                  <tr key={row.capability} className="border-t">
                    <th scope="row" className="px-3 py-1.5 text-left font-normal">
                      <span className="first-letter:uppercase">{row.action}</span>{' '}
                      <span className="ml-1 font-mono text-xs text-muted-foreground">{row.capability}</span>
                    </th>
                    {ROLES.map((role) => (
                      <td key={role} className="px-2 py-1.5 text-center">
                        {row.holders[role]
                          ? <Check className="mx-auto h-4 w-4 text-success" aria-label={`${titleCase(role)}: yes`} />
                          : <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" aria-label={`${titleCase(role)}: no`} />}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </PageTransition>
  );
}
