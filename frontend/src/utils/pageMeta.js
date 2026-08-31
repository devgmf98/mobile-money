import { useEffect } from 'react';

/* Every route in a single-page app serves the same index.html, so without this
   Google sees one title and one description for /login, /register and every
   other page — near-duplicates competing with each other. Setting them per
   route gives each page its own search result.

   Google renders JavaScript before indexing, so updating the DOM here is
   enough; the tags do not have to be in the served HTML. */
const setTag = (selector, attr, value) => {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement(selector.startsWith('link') ? 'link' : 'meta');
    const [, name] = selector.match(/\[(?:name|property|rel)="([^"]+)"\]/) || [];
    if (name) {
      if (selector.startsWith('link')) el.setAttribute('rel', name);
      else el.setAttribute(selector.includes('property=') ? 'property' : 'name', name);
    }
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
};

const SITE = 'https://gpay-ss.netlify.app';

export function usePageMeta({ title, description, path }) {
  useEffect(() => {
    if (title) {
      document.title = title;
      setTag('meta[property="og:title"]', 'content', title);
      setTag('meta[name="twitter:title"]', 'content', title);
    }

    if (description) {
      setTag('meta[name="description"]', 'content', description);
      setTag('meta[property="og:description"]', 'content', description);
      setTag('meta[name="twitter:description"]', 'content', description);
    }

    if (path) {
      /* A canonical per page, so the crawler is not told every route is "/". */
      setTag('link[rel="canonical"]', 'href', SITE + path);
      setTag('meta[property="og:url"]', 'content', SITE + path);
    }
  }, [title, description, path]);
}
