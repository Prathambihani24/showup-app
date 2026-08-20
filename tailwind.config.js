/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.js",
    "./screens/**/*.js",
    "./components/**/*.js",
    "./lib/**/*.js",
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#7C3AED',
          light: '#F3EEFF',
          dark: '#5B21B6',
        },
        surface: '#FAFAFA',
        card: '#FFFFFF',
        border: '#F0F0F0',
        borderStrong: '#EFEFEF',
        text: '#0a0a0a',
        textMuted: '#999999',
        textSubtle: '#C4C4C4',
        success: '#22C55E',
        successLight: '#F0FDF4',
        danger: '#EF4444',
        dangerLight: '#FFF5F5',
        warning: '#F59E0B',
        warningLight: '#FFFBEB',
      },
      fontSize: {
        'display': ['32px', { lineHeight: '38px', fontWeight: '900', letterSpacing: '-1.5px' }],
        'title': ['28px', { lineHeight: '34px', fontWeight: '900', letterSpacing: '-1px' }],
        'heading': ['22px', { lineHeight: '28px', fontWeight: '800' }],
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '500' }],
        'body': ['14px', { lineHeight: '20px', fontWeight: '500' }],
        'body-sm': ['13px', { lineHeight: '18px', fontWeight: '600' }],
        'label': ['10px', { lineHeight: '14px', fontWeight: '700', letterSpacing: '1.5px' }],
        'pill': ['11px', { lineHeight: '14px', fontWeight: '600' }],
        'stat': ['26px', { lineHeight: '30px', fontWeight: '900' }],
        'activity': ['19px', { lineHeight: '24px', fontWeight: '800', letterSpacing: '-0.4px' }],
      },
      spacing: {
        '18': '72px',
        '22': '88px',
        '26': '104px',
      },
      borderRadius: {
        '4xl': '24px',
        '5xl': '32px',
      },
      boxShadow: {
        'card': '0 4px 16px rgba(0,0,0,0.06)',
        'card-hover': '0 8px 24px rgba(0,0,0,0.08)',
        'btn': '0 8px 20px rgba(124,58,237,0.4)',
        'input': '0 2px 8px rgba(0,0,0,0.04)',
        'badge': '0 2px 8px rgba(0,0,0,0.05)',
      },
    },
  },
  plugins: [],
}