import { useEffect } from 'react';

/**
 * Sets the document title, meta description and a JSON-LD block per route.
 * A single-page app has no server render, so this is what search crawlers
 * and link previews read.
 */
export function useSeo({ title, description, jsonLd, canonical }) {
  useEffect(() => {
    if (!title) return undefined;
    const previous = document.title;
    document.title = `${title} · Homeplex Nepal`;
    return () => { document.title = previous; };
  }, [title]);

  useEffect(() => {
    if (!description) return undefined;
    let tag = document.querySelector('meta[name="description"]');
    const had = Boolean(tag);
    const before = tag?.getAttribute('content');
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('name', 'description');
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', description);
    return () => {
      if (had && before != null) tag.setAttribute('content', before);
      else tag.remove();
    };
  }, [description]);

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
