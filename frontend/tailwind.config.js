/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0a',
        surface: '#141414',
        border: '#222222',
        muted: '#555555',
        accent: '#a855f7',
        'accent-dim': '#7c3aed',
      },
    },
  },
  plugins: [],
}
