/**
 * ────────────────────────────────────────────────────────────────
 *  SITE CONFIG — edit this file to update site-wide details.
 *  Most day-to-day changes (org name, links, socials) happen here.
 * ────────────────────────────────────────────────────────────────
 */

export const site = {
  /** Full organisation name — shown in header, footer and SEO. */
  name: 'Belmont Community Environmental Champions Inc.',
  /** Short name for the org, used in the footer and SEO. */
  shortName: 'BCEC',
  /** Desktop header logo (in `public/`). */
  logoDesktop: '/site_assets/BCEC Logo Long.svg',
  /** Mobile header logo (in `public/`). */
  logoMobile: '/site_assets/BCEC Logo Graphic.svg',
  /** Short tagline / credibility line shown on the home page hero. */
  tagline: 'Grounded in kindness, we care about our community & our local environment.',
  /** One-sentence description used for SEO and social sharing. */
  description:
    'Belmont Community Environmental Champions (BCEC) is a group of local residents who care deeply for the environmental health of our area. We advocate for and run projects and events that educate and inspire the community to enjoy a cleaner, greener, and more connected local environment.',
  /** Your purchased domain (no trailing slash). Also set this in astro.config.mjs. */
  url: 'https://belmontcommunityec.org.au',
};

/**
 * Google Form links. Paste the "share" links from your Google Forms here.
 */
export const forms = {
  membership: 'https://forms.gle/Fn5hG5xGeUd7SrKv6',
};

/**
 * Social + contact links. Leave a value as an empty string ('') to hide it.
 */
export const socials = {
  email: 'belmontcommunityec@gmail.com',
  facebook: 'https://facebook.com/BelmontCEC',
  instagram: 'https://www.instagram.com/belmont_community_enviro_champ/',
};

/**
 * Site-level patrons shown in the supporters roll-up regardless of project/event
 * data. Each entry is an organisation `id` from src/content/organisations.ts.
 */
export const patrons = ['cassie-rowe-mla'];

/**
 * Primary navigation. Add/remove items to change the menu.
 */
export const nav = [
  { label: 'Home', href: '/' },
  { label: 'Projects', href: '/projects' },
  { label: 'Events', href: '/events' },
  { label: 'Advocacy', href: '/advocacy' },
  { label: 'Get Involved', href: '/get-involved' },
  { label: 'About', href: '/about' },
];
