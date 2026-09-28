import { CustomerStatement } from '@/components/finance/CustomerStatement';

/**
 * The account: invoices and payments in order, with the running balance (`reports:finance`). Since Phase I the same
 * statement as Finance reports › Customer statement — `components/finance/CustomerStatement`, with its CSV.
 */
export function CustomerStatementTab({ customerId }) {
  return <CustomerStatement customerId={customerId} storageKey="customer-page-statement" />;
}
