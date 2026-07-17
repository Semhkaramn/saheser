'use client';

import { SITE_CONFIG } from '@/lib/site-config';

export default function StructuredData() {
  const siteName = SITE_CONFIG.siteName;
  const siteUrl = SITE_CONFIG.appUrl;
  const siteLogo = SITE_CONFIG.siteLogo;
  const siteDescription = `${siteName} - Puan kazan, rütbe atla, ödüller kazan! Şans çarkı ve daha fazlası. Günlük görevler, etkinlikler ve çekilişlerle kazanma şansını yakala.`;

  // Organization Schema
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteName,
    url: siteUrl,
    logo: siteLogo.startsWith('http') ? siteLogo : `${siteUrl}${siteLogo}`,
    description: siteDescription,
    sameAs: [],
  };

  // Website Schema
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    url: siteUrl,
    description: siteDescription,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteUrl}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  // WebApplication Schema
  const webAppSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: siteName,
    url: siteUrl,
    description: siteDescription,
    applicationCategory: 'GameApplication',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'TRY',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webAppSchema),
        }}
      />
    </>
  );
}
