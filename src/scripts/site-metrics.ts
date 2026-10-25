import { forms, socials } from '../config';

/**
 * Private, cookie-free usage metrics. Sends only the page path, the referring
 * site's scheme and hostname, an optional utm_source tag, and fixed link or
 * event identifiers. Form answers, email drafts and full URLs are never sent.
 */

const ENDPOINT = '/api/site-metrics';
const DEBUG_FLAG = 'bcec-metrics-debug';

type Metric =
  | { type: 'pageview'; referrer: string; campaign: string | null }
  | { type: 'link'; link: string }
  | { type: 'event'; name: string };

const knownLinks = new Map<string, string>(
  [
    [forms.membership, 'membership-form'],
    [socials.facebook, 'facebook'],
    [socials.instagram, 'instagram'],
  ].filter(([url]) => Boolean(url)) as [string, string][],
);

const debugEnabled = () => {
  try {
    return localStorage.getItem(DEBUG_FLAG) === '1';
  } catch {
    return false;
  }
};

const optedOut = () => {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || navigator.doNotTrack === '1';
};

const isEnabled = () => {
  if (/^\/admin(\/|$)/.test(location.pathname)) return false;
  if (debugEnabled()) return true;
  if (optedOut() || navigator.webdriver) return false;
  return !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
};

const send = (metric: Metric) => {
  if (!isEnabled()) return;
  const body = JSON.stringify({ ...metric, path: location.pathname });
  try {
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: 'text/plain' }))) return;
  } catch {
    // Fall back to fetch below.
  }
  fetch(ENDPOINT, {
    method: 'POST',
    body,
    keepalive: true,
    credentials: 'omit',
    headers: { 'Content-Type': 'text/plain' },
  }).catch(() => {});
};

export const trackEvent = (name: string) => send({ type: 'event', name });

const cleanId = (value: string) => value.replace(/[^A-Za-z0-9._~:/\-%+]/g, '-').slice(0, 160);

const linkIdFor = (anchor: HTMLAnchorElement): string | null => {
  if (anchor.hasAttribute('data-no-track')) return null;
  if (anchor.dataset.trackLink) return cleanId(anchor.dataset.trackLink);

  let url: URL;
  try {
    url = new URL(anchor.href, location.href);
  } catch {
    return null;
  }

  const known = knownLinks.get(anchor.href) ?? knownLinks.get(anchor.getAttribute('href') ?? '');
  if (known) return known;

  if (url.protocol === 'mailto:') {
    return socials.email && url.pathname.toLowerCase() === socials.email.toLowerCase() ? 'email-bcec' : null;
  }
  if (url.protocol === 'tel:') return cleanId(`tel:${url.pathname.replace(/[^0-9+]/g, '')}`);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  if (url.origin === location.origin) {
    return /\.pdf$/i.test(url.pathname) ? cleanId(url.pathname) : null;
  }
  const host = url.hostname.replace(/^www\./, '');
  const path = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');
  return cleanId(`${host}${path}`);
};

const onLinkActivate = (event: MouseEvent) => {
  if (event.type === 'auxclick' && event.button !== 1) return;
  const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
  if (!target) return;
  const link = linkIdFor(target);
  if (link) send({ type: 'link', link });
};

const referrerOrigin = () => {
  if (!document.referrer) return '';
  try {
    const url = new URL(document.referrer);
    return `${url.protocol}//${url.hostname}`;
  } catch {
    return '';
  }
};

let started = false;

export const initSiteMetrics = () => {
  if (started) return;
  started = true;
  // Identity invite/recovery links are being redirected to the admin login page.
  if (/^#[a-z_]+_token=/.test(location.hash)) return;

  const campaign = new URLSearchParams(location.search).get('utm_source');
  send({ type: 'pageview', referrer: referrerOrigin(), campaign });

  document.addEventListener('click', onLinkActivate, { capture: true });
  document.addEventListener('auxclick', onLinkActivate, { capture: true });
};
