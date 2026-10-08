import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return [
    { url: SITE_URL, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/developer`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/credits`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/signup`, lastModified, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${SITE_URL}/login`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
