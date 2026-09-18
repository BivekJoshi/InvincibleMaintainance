import { useEffect } from 'react';
import { useSiteSettings } from '@/hooks/useSiteSettings';

/**
 * Sets the document title, meta description and a JSON-LD block per route.
 * A single-page app has no server render, so this is what search crawlers
 * and link previews read.
 *
 * The company name in the title, and the title and description of a page that has none of
 * its own (the home page), come from Settings → Search engines and tracking.
 */
export function useSeo({ title, description, jsonLd, canonical } = {}) {
  const { name, seoTitle, seoDescription } = useSiteSettings();
  const fullTitle = title ? `${title} · ${name}` : seoTitle;
  const fullDescription = description || seoDescription;

  useEffect(() => {
    if (!fullTitle) return undefined;
    const previous = document.title;
    document.title = fullTitle;
    return () => { document.title = previous; };
  }, [fullTitle]);

  useEffect(() => {
    if (!fullDescription) return undefined;
    let tag = document.querySelector('meta[name="description"]');
    const had = Boolean(tag);
    const before = tag?.getAttribute('content');
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('name', 'description');
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', fullDescription);
    return () => {
      if (had && before != null) tag.setAttribute('content', before);
      else tag.remove();
    };
  }, [fullDescription]);

  useEffect(() => {
    if (!canonical) return undefined;
    const link = document.createElement('link');
    link.rel = 'canonical';
    link.href = canonical;
    document.head.appendChild(link);
    return () => link.remove();
  }, [canonical]);

  useEffect(() => {
    if (!jsonLd) return undefined;
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);
    return () => script.remove();
  }, [jsonLd]);
}
