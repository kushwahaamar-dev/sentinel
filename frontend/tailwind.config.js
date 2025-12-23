/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ocean: "#050505",
        land: "#1a1a1a",
        neon: "#00e0ff",
        quake: "#ff3366",
        fire: "#ff9d00",
        storm: "#9b5cff"
      },
      fontFamily: {
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      backdropBlur: {
        war: "10px"
      }
    }
  },
  plugins: []
};
