/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    container: { center: true, padding: '1.5rem', screens: { '2xl': '1360px' } },
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        // Devanagari needs its own stack or Nepali copy renders in a fallback face.
        deva: ['"Noto Sans Devanagari"', 'Mangal', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        // Brand accents. `ink` is every dark surface, `gold` is every emphasis.
        gold: { DEFAULT: 'hsl(var(--gold))', foreground: 'hsl(var(--gold-foreground))' },
        ink: {
          DEFAULT: 'hsl(var(--ink))',
          foreground: 'hsl(var(--ink-foreground))',
          muted: 'hsl(var(--ink-muted))',
        },
        // Outcome colours. `DEFAULT` is the mark or the text; `surface` and
        // `border` are the panel it sits on. Defined once in globals.css so a
        // component never reaches for a raw Tailwind palette again.
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
          surface: 'hsl(var(--success-surface))',
          border: 'hsl(var(--success-border))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
          surface: 'hsl(var(--warning-surface))',
          border: 'hsl(var(--warning-border))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
          surface: 'hsl(var(--info-surface))',
          border: 'hsl(var(--info-border))',
        },
        // Sticky-note papers in the back office's notes drawer.
        note: Object.fromEntries(['yellow', 'blue', 'green', 'pink', 'purple'].flatMap((c) => [
          [c, `hsl(var(--note-${c}))`],
          [`${c}-edge`, `hsl(var(--note-${c}-edge))`],
        ])),
        // SLA traffic light — used by the lead board and countdown chips.
        sla: {
          ok: 'hsl(var(--sla-ok))',
          warn: 'hsl(var(--sla-warn))',
          breach: 'hsl(var(--sla-breach))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        // Bound to the elevation ramp in globals.css, so a dark theme can cut
        // its own shadows instead of inheriting ones tuned for paper.
        card: 'var(--elevation-2)',
        lift: 'var(--elevation-3)',
        float: '0 40px 90px -40px hsl(var(--ink) / 0.55)',
        hairline: 'var(--elevation-1)',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        // Two identical copies sit side by side; each travels exactly its own
        // width, so the second lands where the first started and the loop is seamless.
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-100%)' } },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '70%': { transform: 'scale(1.6)', opacity: '0' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        marquee: 'marquee 38s linear infinite',
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.16, 1, 0.3, 1) infinite',
      },
    },
  },
  plugins: [import('tailwindcss-animate')],
};
