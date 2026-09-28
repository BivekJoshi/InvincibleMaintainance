import { RecordCombobox } from '@/components/common/RecordCombobox';
import { CustomerStatement } from '@/components/finance/CustomerStatement';
import { CUSTOMER_RELATION } from '@/config/admin/jobViews';

/**
 * Customer statement (Phase I5): pick a customer (`?customerId=` in the URL), then their account — the same
 * `CustomerStatement` as the Statement tab on the customer's page, with its CSV. A statement covers the whole
 * account, so the date range does not apply.
 */
export function StatementReport({ params, patch }) {
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2" data-testid="statement-picker">
        <span className="text-sm font-medium" id="statement-customer">Customer</span>
        <RecordCombobox
          path={CUSTOMER_RELATION.path}
          labelKey={CUSTOMER_RELATION.labelKey}
          value={params.customerId ?? null}
          onChange={(id) => patch({ customerId: id ?? undefined })}
          placeholder="Pick a customer…"
          searchPlaceholder="Search name or phone…"
          className="w-full sm:w-80"
          aria-labelledby="statement-customer"
        />
      </div>
      {params.customerId ? (
        <CustomerStatement customerId={params.customerId} storageKey="report-statement" />
      ) : (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Pick a customer to see every invoice and payment on their account, with the running balance.
        </p>
      )}
    </>
  );
}
