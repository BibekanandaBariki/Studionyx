/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        emerald: {
          500: '#10b981',
        },
        teal: {
          500: '#14b8a6',
        },
        cyan: {
          500: '#06b6d4',
        },
        slatebg: '#0f172a',
        slatesurface: '#1e293b',
        coolwhite: '#f1f5f9',
      },
      animation: {
        'gradient-xy': 'gradient-xy 8s ease infinite',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
      },
      keyframes: {
        'gradient-xy': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'pulse-soft': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.7' },
          '50%': { transform: 'scale(1.05)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};



