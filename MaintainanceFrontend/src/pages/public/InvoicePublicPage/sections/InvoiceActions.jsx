import { Phone, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * The two things a customer does with an invoice they have questions about:
 * call the number on it, or print it for their own records.
 *
 * `print:hidden` on the buttons — a printed invoice with a "Print" button on
 * it is a bug that reaches the customer's filing cabinet.
 */
export function InvoiceActions({ number, phone }) {
  return (
    <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
      <p className="text-xs text-muted-foreground">
        Questions about this invoice? Call us and quote {number}.
      </p>
      <div className="flex gap-2 print:hidden">
        {phone ? (
          <Button asChild variant="outline" size="sm">
            <a href={`tel:${phone}`}><Phone className="h-4 w-4" /> {phone}</a>
          </Button>
        ) : null}
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>
    </footer>
  );
}
