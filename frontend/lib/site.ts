/**
 * Site identity and creator details, shared by metadata, structured data,
 * the footer and the developer page.
 */

export const SITE_URL = 'https://www.satistic.tech'
export const SITE_NAME = 'SATistics'
export const SITE_DESCRIPTION =
  'Train for the SAT and GRE with arcade games built on real-format questions, concept lessons and videos. Built by Shiv Vyas.'

export const CREATOR = {
  name: 'Shiv Vyas',
  handle: 'shivvyas',
  url: 'https://www.shivvyas.com',
  // Same entity id as the Person on shivvyas.com, so search engines join the two sites
  id: 'https://www.shivvyas.com/#person',
  role: 'Software engineer in New York',
  photo: 'https://www.shivvyas.com/images/about.jpeg',
  socialImage: 'https://www.shivvyas.com/images/shiv-vyas-social.png',
  projectImage: 'https://www.shivvyas.com/images/SATistics.png',
  links: {
    website: 'https://www.shivvyas.com',
    linkedin: 'https://www.linkedin.com/in/shivvyas/',
    github: 'https://github.com/shivvyas2',
    instagram: 'https://www.instagram.com/shivvyas_/',
    youtube: 'https://www.youtube.com/@ShivVyas',
  },
}

export const creatorPerson = {
  '@type': 'Person',
  '@id': CREATOR.id,
  name: CREATOR.name,
  alternateName: ['shivvyas', 'Shiv Amitkumar Vyas', 'shivvyas2'],
  url: CREATOR.url,
  image: CREATOR.photo,
  jobTitle: 'Software Developer',
  sameAs: Object.values(CREATOR.links).filter((link) => link !== CREATOR.url),
}

// Renders a JSON-LD block; content is static data from this file
export function jsonLd(data: object) {
  return { __html: JSON.stringify(data).replace(/</g, '\\u003c') }
}
