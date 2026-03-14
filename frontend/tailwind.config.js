/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'navy': {
          900: '#0a0e1a',
          800: '#0d1117',
          700: '#111827',
          600: '#1a2235',
          500: '#1f2d45',
        },
        'flag': {
          'critical': '#ef4444',
          'high': '#f97316',
          'medium': '#eab308',
          'low': '#3b82f6',
          'none': '#6b7280',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-critical': 'pulse-critical 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slide-in 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
      },
      keyframes: {
        'pulse-critical': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(239, 68, 68, 0)' },
        },
        'slide-in': {
          from: { transform: 'translateX(100%)', opacity: 0 },
          to: { transform: 'translateX(0)', opacity: 1 },
        },
        'fade-in': {
          from: { opacity: 0, transform: 'translateY(8px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
