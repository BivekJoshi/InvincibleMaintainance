import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useGetBootstrapQuery } from '@/api/publicApi';
import { selectLocale } from '@/redux/slices/uiSlice';
import { COMPANY_FALLBACKS, SETTINGS_KEYS } from '@/config/site/company';

/**
 * The company's own details, already resolved.
 *
 * `/public/bootstrap` returns settings as a flat key→string map, which every
 * consumer used to destructure by hand — five copies of
 * `settings['contact.phonePrimary'] ?? '01-5407720'`, and five chances for one
 * of them to keep an old number. This reads the same cached query (RTK Query
 * dedupes it) and hands back named fields with the fallbacks already applied.
 *
 * @returns {{
 *   settings: Record<string, string>, categories: object[], isLoading: boolean,
 *   name: string, initial: string, tagline: string,
 *   phone: string, mobile: string, email: string, address: string, city: string,
 *   mapEmbed: string|undefined,
 * }}
 */
export function useSiteSettings() {
  const locale = useSelector(selectLocale);
  const { data, isLoading } = useGetBootstrapQuery(locale);

  return useMemo(() => {
    const settings = data?.settings ?? {};
    const read = (key, fallback = '') => settings[SETTINGS_KEYS[key]] || fallback;
    const name = read('name', COMPANY_FALLBACKS.name);

    return {
      settings,
      categories: data?.nav?.categories ?? [],
      isLoading,
      name,
      initial: name.trim()[0]?.toUpperCase() ?? 'H',
      tagline: read('tagline', COMPANY_FALLBACKS.tagline),
      phone: read('phone', COMPANY_FALLBACKS.phone),
      mobile: read('mobile', COMPANY_FALLBACKS.mobile),
      email: read('email', COMPANY_FALLBACKS.email),
      address: read('address', COMPANY_FALLBACKS.address),
      city: read('city', COMPANY_FALLBACKS.city),
      mapEmbed: settings[SETTINGS_KEYS.mapEmbed],
    };
  }, [data, isLoading]);
}
