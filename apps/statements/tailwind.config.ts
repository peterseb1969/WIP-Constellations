import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2B579A',
          light: '#5B9BD5',
        },
        accent: '#ED7D31',
        success: '#2E8B57',
        danger: '#DC3545',
        surface: '#FFFFFF',
        background: '#F8FAFC',
        'text-primary': '#333333',
        'text-muted': '#999999',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
