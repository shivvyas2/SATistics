/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        paper: '#ECEAE4',
        ink: '#17171C',
        cobalt: { DEFAULT: '#3A33E8', soft: '#DCDBFB' },
        lime: { DEFAULT: '#D4F34A', soft: '#F1FBC9' },
        coral: { DEFAULT: '#FF6B4A', soft: '#FFE1D9' },
        mist: '#F7F6F2',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      },
      boxShadow: {
        brutal: '4px 4px 0 0 #17171C',
        'brutal-sm': '2px 2px 0 0 #17171C',
        'brutal-lg': '8px 8px 0 0 #17171C',
        glass: '0 20px 50px -20px rgba(23, 23, 28, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}
