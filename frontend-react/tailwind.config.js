/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#4f46e5', dark: '#4338ca', light: '#eef2ff' },
        teal: { DEFAULT: '#0f9d8c', light: '#e3f9f6' },
        amber: { DEFAULT: '#d97706', light: '#fef3e2' },
        danger: { DEFAULT: '#dc2626', light: '#fef2f2' },
        success: { DEFAULT: '#16a34a', light: '#f0fdf4' },
        ink: '#1a1d29',
      },
      borderRadius: {
        xl: '16px',
      },
    },
  },
  plugins: [],
};
