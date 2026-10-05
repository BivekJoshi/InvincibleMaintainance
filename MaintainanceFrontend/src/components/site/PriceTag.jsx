import { SITE } from '@/config/i18n/site';
import { useT } from '@/hooks/useT';
import { formatNpr } from '@/helpers/format';
import { cn } from '@/helpers/utils';

/** The price line on a product card, or the honest absence of one — in the visitor's language (`रु.` in Nepali). */
export function PriceTag({ service, className }) {
  const t = useT(SITE);
  if (!service.priceFrom) {
    return (
      <p className={cn('text-sm font-medium text-muted-foreground', className)}>{t('price.afterInspection')}</p>
    );
  }
  return (
    <p className={className}>
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('price.from')}</span>
      <span className="mt-0.5 block text-lg font-bold leading-none tabular-nums">
        {formatNpr(service.priceFrom, { compact: true, locale: t.locale })}
        {service.priceUnit ? <span className="text-xs font-normal text-muted-foreground"> /{service.priceUnit}</span> : null}
      </span>
    </p>
  );
}

/** A published rate as a range, for the pages that show the band rather than the floor. */
export function PriceRange({ service, className }) {
  const t = useT(SITE);
  if (!service.priceFrom) {
    return <p className={cn('text-sm font-medium text-muted-foreground', className)}>{t('price.afterFreeInspection')}</p>;
  }
  return (
    <p className={cn('text-2xl font-bold tabular-nums', className)}>
      {formatNpr(service.priceFrom, { compact: true, locale: t.locale })}
      <span className="text-sm font-normal text-muted-foreground">
        {' – '}{formatNpr(service.priceTo ?? service.priceFrom, { compact: true, symbol: false, locale: t.locale })}
        {service.priceUnit ? ` /${service.priceUnit}` : null}
      </span>
    </p>
  );
}
