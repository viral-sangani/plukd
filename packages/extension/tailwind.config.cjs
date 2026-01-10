/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
        './entrypoints/**/*.{html,ts,tsx}',
        './components/**/*.{ts,tsx,js,jsx}',
    ],
    prefix: "tw-",
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            fontFamily: {
                sans: ['Barlow', 'sans-serif'],
                mono: ['ui-monospace', 'SFMono-Regular', 'Roboto Mono', 'Menlo', 'Monaco', 'monospace'],
            },
            colors: {
                // Plukd Design System color palette
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                "input-bg": "#1a1a1a", // Plukd background-subtle
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                // Plukd specific colors
                'plukd-bg': '#080808',
                'plukd-bg-muted': '#121212',
                'plukd-bg-subtle': '#1a1a1a',
                'plukd-border': '#1f1f1f',
                'plukd-border-emphasis': '#2a2a2a',
                'plukd-accent': '#e84326',
                'plukd-accent-hover': '#d63920',
                'plukd-foreground': '#fafafa',
                'plukd-foreground-secondary': '#ababab',
                'plukd-foreground-muted': '#71717a',
                'plukd-source-twitter': '#1da1f2',
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            keyframes: {
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
    corePlugins: {
        preflight: false,
    }
}
