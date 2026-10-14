/** @type {import('tailwindcss').Config} */
export default {
  // hover:/group-hover: only where a real hover exists. On iOS a tap applies
  // :hover first, and if that reveals anything (a play badge fading in from
  // opacity-0) Safari spends the tap on the reveal and never clicks — every
  // Tube card took two taps on an iPhone. Android has no such rule, which is
  // why only iPhones showed it (owner, 2026-10-14).
  future: { hoverOnlyWhenSupported: true },
  content:['./index.html', './src/**/*.{js,ts,jsx,tsx,css}'],
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
