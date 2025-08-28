/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        blueshift: {
          cyan: '#00FFFF',
          blue: '#69A2F1',
          'blue-dark': '#3B4D8C',
          orange: '#FFAD66',
          red: '#FF6B8A',
          green: '#DDEAE0',
          dark: '#0A0B0D',
          darker: '#050506',
          gray: {
            900: '#111114',
            800: '#1A1B1F',
            700: '#2A2B30',
            600: '#3A3B42',
            500: '#6B6D76',
            400: '#9CA0AA',
            300: '#CDD1DB',
          }
        }
      },
      fontFamily: {
        'mono': ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
        'sans': ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
      },
      animation: {
        'gradient': 'gradient 3s ease infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-dark': 'linear-gradient(135deg, #0A0B0D 0%, #111114 100%)',
      },
    },
  },
  plugins: [],
}