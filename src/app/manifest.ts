import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'UnfoldYou',
    short_name: 'UnfoldYou',
    description: 'A social discovery platform where strangers unfold into real connections — anonymously, psychologically, authentically.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0f',
    theme_color: '#0a0a0f',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      }
    ],
  }
}
