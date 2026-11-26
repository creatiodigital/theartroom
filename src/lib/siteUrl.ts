/**
 * The site's own address, for canonical links built in components (Share). The same on the server
 * and in the browser, so a link rendered on the server matches the hydrated one.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://theartroom.gallery'
