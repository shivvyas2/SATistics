import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    // Signed-in app pages redirect to login, so only public pages are worth crawling
    rules: { userAgent: '*', allow: '/', disallow: ['/dashboard', '/games', '/learn', '/materials', '/mock', '/profile', '/stats'] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
