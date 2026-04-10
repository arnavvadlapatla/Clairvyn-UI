import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      screens: {
        /**
         * `touch:` → max-width 768px. Use with `desktop:` (min 769px).
         * Global CSS helpers in app/globals.css @layer utilities: .touch-safe-x, .touch-scroll-y,
         * .touch-hit-target, .touch-text-comfortable (same breakpoint).
         */
        touch: { max: "768px" },
        /** Desktop layout from 769px */
        desktop: "769px",
      },
      colors: {
        // Clairvyn colour system
        clv: {
          violet: {
            DEFAULT: "#7C5CBF",
            deep: "#5A3A9E",
            mid: "#9B7FD4",
            light: "#EDE8FA",
            xlight: "#F8F5FF",
          },
          accent: {
            DEFAULT: "#8B5CF6",
            bg: "rgba(139, 92, 246, 0.12)",
            text: "#6D28D9",
          },
          border: {
            DEFAULT: "#D4C8F0",
            strong: "#B8A8E0",
          },
          ink: {
            DEFAULT: "#1A1040",
            muted: "#5B4D8A",
            subtle: "#8B7BAE",
            placeholder: "#A090C0",
          },
          bg: {
            surface: "#FFFFFF",
            tint: "#F8F5FF",
            app: "#EDE8FA",
          },
          success: {
            DEFAULT: "#22A06B",
            bg: "#E3F5EE",
          },
          warning: {
            DEFAULT: "#D97706",
            bg: "#FEF3C7",
          },
          error: {
            DEFAULT: "#DC2626",
            bg: "#FEE2E2",
          },
          scroll: {
            thumb: "#B8A8E0",
            hover: "#9070CC",
          },
        },
        // Custom color palette
        teal: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#008080", // Primary teal
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
          950: "#042f2e",
        },
        charcoal: {
          DEFAULT: "#333333",
          50: "#f6f6f6",
          100: "#e7e7e7",
          200: "#d1d1d1",
          300: "#b0b0b0",
          400: "#888888",
          500: "#6d6d6d",
          600: "#5d5d5d",
          700: "#4f4f4f",
          800: "#454545",
          900: "#3d3d3d",
          950: "#333333", // Primary charcoal
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
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
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
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
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config

export default config
