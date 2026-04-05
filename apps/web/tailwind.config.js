/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './src/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#6366f1',
                    hover: '#4f46e5',
                    light: 'rgba(99,102,241,0.15)',
                },
                dark: {
                    bg: '#0a0a0f',
                    card: '#13131a',
                    border: '#1e1e2e',
                    input: '#1a1a28',
                    muted: '#6b7280',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            keyframes: {
                'fade-in': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
                'spin-slow': { to: { transform: 'rotate(360deg)' } },
            },
            animation: {
                'fade-in': 'fade-in 0.4s ease forwards',
                'spin-slow': 'spin-slow 0.8s linear infinite',
            },
        },
    },
    plugins: [],
};
