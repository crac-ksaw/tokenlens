/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        ember: "#b45309",
        sand: "#f4efe7",
        ocean: "#0f3d5e",
        mist: "#cbd5e1",
      },
      boxShadow: {
        panel: "0 24px 60px rgba(15, 61, 94, 0.12)",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'IBM Plex Sans'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};