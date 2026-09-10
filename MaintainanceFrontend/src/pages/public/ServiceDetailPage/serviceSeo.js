/**
 * The structured data a service page publishes.
 *
 * This is the whole reason the per-service page exists: the site it replaces
 * had one page for every trade and so ranked for none of the long-tail
 * searches — "waterproofing cost Kathmandu" — that people actually type.
 *
 * Prices are integer paisa in the database and decimal rupees in schema.org,
 * so the divide happens here and nowhere else on the page.
 *
 * @param {object} service the resolved service row
 * @param {string} companyName
 * @returns {object|null} JSON-LD, or null before the service has loaded
 */
export function serviceJsonLd(service, companyName) {
  if (!service) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    description: service.excerpt,
    provider: { '@type': 'LocalBusiness', name: companyName },
    areaServed: 'Kathmandu Valley',
    ...(service.priceFrom ? {
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'NPR',
        lowPrice: service.priceFrom / 100,
        highPrice: (service.priceTo ?? service.priceFrom) / 100,
      },
    } : {}),
  };
}
