/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        crimson: 'var(--brand-crimson)',
        accent: 'var(--accent)',
        white: 'var(--brand-white)',
        obsidian: 'var(--brand-obsidian)',
        'brand-cream': 'var(--brand-cream)',
        secondary: 'var(--theme-p-color)',
        // primary = dynamic theme heading color
        primary: 'var(--theme-h-color)',
      },
      fontSize: {
        'stat-value': 'var(--stat-value)',
        'stat-label': 'var(--stat-label)',
        'fluid-h1': 'var(--fluid-h1)',
        'fluid-p': 'var(--fluid-p)',
      },
      fontFamily: {
        'outfit': ['Outfit', 'sans-serif'],
        'inter': ['Inter', 'sans-serif'],
        'bebas': ['Bebas Neue', 'sans-serif'],
        'space': ['Space Grotesk', 'sans-serif'],
        'syncopate': ['Syncopate', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
