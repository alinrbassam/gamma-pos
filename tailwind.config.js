/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,js,ts,jsx,tsx}', './src/modules/**/*.{html,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fdf5f2',
          100: '#faece6',
          200: '#f5d6cb',
          300: '#edb5a3',
          400: '#df7e63',
          500: '#d04b28',
          600: '#c83818',
          700: '#a72b11',
          800: '#87230e',
          900: '#6e1f0e',
          950: '#3c0d05',
        },
        delish: {
          50: '#fdf5f2',
          100: '#faece6',
          200: '#f5d6cb',
          300: '#edb5a3',
          400: '#df7e63',
          500: '#d04b28',
          600: '#c83818',
          700: '#a72b11',
          800: '#87230e',
          900: '#6e1f0e',
          950: '#3c0d05',
        },
        charcoal: {
          600: '#3d424e',
          700: '#2b2f38',
          800: '#21242b',
          850: '#1a1c21',
          900: '#141518',
          950: '#0e0f12',
        },
        surface: {
          light: '#fbf9f6',
          dark: '#0e0f12',
          cardLight: '#ffffff',
          cardDark: '#141518',
        },
      },
    },
  },
  plugins: [],
};
