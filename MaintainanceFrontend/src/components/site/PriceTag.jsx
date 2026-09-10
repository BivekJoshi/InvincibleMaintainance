import { formatNpr } from '@/helpers/format';
import { cn } from '@/helpers/utils';

/** The price line on a product card, or the honest absence of one. */
export function PriceTag({ service, className }) {
  if (!service.priceFrom) {
    return (
      <p className={cn('text-sm font-medium text-muted-foreground', className)}>Priced after inspection</p>
    );
  }
  return (
    <p className={className}>
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">From</span>
      <span className="mt-0.5 block text-lg font-bold leading-none tabular-nums">
        {formatNpr(service.priceFrom, { compact: true })}
        {service.priceUnit ? <span className="text-xs font-normal text-muted-foreground"> /{service.priceUnit}</span> : null}
      </span>
    </p>
  );
}

/** A published rate as a range, for the pages that show the band rather than the floor. */
export function PriceRange({ service, className }) {
  if (!service.priceFrom) {
    return <p className={cn('text-sm font-medium text-muted-foreground', className)}>Priced after a free inspection</p>;
  }
  return (
    <p className={cn('text-2xl font-bold tabular-nums', className)}>
      {formatNpr(service.priceFrom, { compact: true })}
      <span className="text-sm font-normal text-muted-foreground">
        {' – '}{formatNpr(service.priceTo ?? service.priceFrom, { compact: true, symbol: false })}
        {service.priceUnit ? ` /${service.priceUnit}` : null}
      </span>
    </p>
  );
}
