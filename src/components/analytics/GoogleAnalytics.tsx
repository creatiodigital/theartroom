import Script from 'next/script'

import { INTERNAL_TRAFFIC_KEY } from '@/lib/analytics/track'

/**
 * Loads Google Analytics 4 with Consent Mode v2.
 *
 * - Renders nothing unless NEXT_PUBLIC_GA_MEASUREMENT_ID is set. We only set
 *   that var in Vercel's Production environment, so staging and local never
 *   load GA and never pollute the gallery's real analytics data.
 * - All storage starts `denied`. GA sends only cookieless pings until the
 *   user accepts in the cookie banner, at which point `analytics_storage`
 *   flips to `granted` (see src/lib/consent.ts). We only use analytics, so
 *   the ad_* signals stay denied permanently.
 * - On startup we replay any previously stored consent so returning visitors
 *   who already accepted are measured immediately.
 * - Internal traffic: a browser that has been signed in (admin, artist, curator;
 *   see InternalTrafficMarker) or opened any page with `?ar_internal=1` sends
 *   `traffic_type: internal` on every hit; `?ar_internal=0` clears it. GA4's
 *   "Internal Traffic" data filter drops those hits once it is Active.
 * - Custom events fired before this script ran wait in `window.__arEvents`
 *   (src/lib/analytics/track.ts) and are sent right after `config`.
 */
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
// Deployed build the client booted. Sent as a GA4 param so any metric can be
// segmented by app version (register `app_version` as a custom dimension in GA4
// to report on it). Lets us see if traffic is coming from a stale/cached build.
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || 'dev'

export const GoogleAnalytics = () => {
  if (!GA_MEASUREMENT_ID) return null

  return (
    <>
      <Script
        id="ga-consent-init"
        strategy="lazyOnload"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('js', new Date());
            gtag('consent', 'default', {
              ad_storage: 'denied',
              ad_user_data: 'denied',
              ad_personalization: 'denied',
              analytics_storage: 'denied'
            });
            var internal = false;
            try {
              var stored = JSON.parse(window.localStorage.getItem('cookie-consent'));
              if (stored && stored.analytics === true) {
                gtag('consent', 'update', { analytics_storage: 'granted' });
              }
            } catch (e) {}
            try {
              var mark = window.location.search.match(/[?&]ar_internal=([01])/);
              if (mark) {
                if (mark[1] === '1') window.localStorage.setItem('${INTERNAL_TRAFFIC_KEY}', '1');
                else window.localStorage.removeItem('${INTERNAL_TRAFFIC_KEY}');
              }
              internal = window.localStorage.getItem('${INTERNAL_TRAFFIC_KEY}') === '1';
            } catch (e) {}
            var config = { app_version: '${BUILD_ID}' };
            if (internal) config.traffic_type = 'internal';
            // Back from 3D Secure or PayPal, Stripe adds the payment's client secret to the URL
            // until the checkout tidies it: never send that to Google.
            var here = window.location.href;
            var safe = here
              .replace(/([?&])(payment_intent_client_secret|setup_intent_client_secret)=[^&#]*&?/g, '$1')
              .replace(/[?&](#|$)/, '$1');
            if (safe !== here) config.page_location = safe;
            gtag('config', '${GA_MEASUREMENT_ID}', config);
            var queued = window.__arEvents || [];
            window.__arEvents = [];
            for (var i = 0; i < queued.length; i++) gtag('event', queued[i][0], queued[i][1]);
          `,
        }}
      />
      <Script
        id="ga-lib"
        strategy="lazyOnload"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
    </>
  )
}
