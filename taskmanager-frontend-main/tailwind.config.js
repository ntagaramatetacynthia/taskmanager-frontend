/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        gov: {
          blue:  '#1E3A8A',
          green: '#065F46',
          gold:  '#D97706',
          gray:  '#6B7280',
          light: '#F3F4F6',
        },
        sidebar: {
          bg: '#2F4A8A',
          top: '#2B3F7F',
          active: '#3E5AA8',
          text: '#FFFFFF',
          secondary: '#B8C6E3',
          icon: '#D6E0FF',
          avatar: '#3A4F91',
          accent: '#F59E0B',
          divider: 'rgba(255, 255, 255, 0.08)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.06)',
        panel: '0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)',
      }
    },
  },
  plugins: [],
}
