/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx,css}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        truegle: {
          blue: '#4285f4',
          red: '#ea4335',
          yellow: '#fbbc05',
          green: '#34a853',
          purple: '#9333ea',
        },
      },
    },
  },
  plugins: [],
};
