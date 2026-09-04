/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#4A1E0B', secondary: '#5E2A11' },
        biscuit: { DEFAULT: '#DCC3A9', light: '#EDD9C4' },
        marigold: { DEFAULT: '#F07B2C', dark: '#C25A12', bg: '#FEF3EA' },
        canvas: '#FBF7F2',
      },
      fontFamily: {
        display: ['Plus Jakarta Sans', 'Georgia', 'serif'],
        ui: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
