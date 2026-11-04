import { GA4_REGEX, ADSENSE_REGEX } from '@/lib/admin/google-integrations.mjs';
import Script from 'next/script';

export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  if (!GA4_REGEX.test(measurementId)) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
        strategy="afterInteractive"
      />
      <Script id="biosfera-ga4" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${JSON.stringify(measurementId)});`}
      </Script>
    </>
  );
}

export function GoogleAdSense({ clientId }: { clientId: string }) {
  if (!ADSENSE_REGEX.test(clientId)) return null;

  return (
    <Script
      id="biosfera-adsense"
      async
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`}
    />
  );
}
