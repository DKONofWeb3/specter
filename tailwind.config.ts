// tailwind.config.ts
import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        inj:      "#0B5CFF",
        "inj-l":  "#3a7fff",
        bg:       "#080a0f",
        s1:       "#0d1017",
        s2:       "#111520",
        s3:       "#161b28",
        green:    "#00c27a",
        red:      "#f03e5e",
        yellow:   "#f5b731",
        blue:     "#38bdf8",
        t1:       "#edf0ff",
        t2:       "#8892b8",
        t3:       "#434d6e",
      },
      fontFamily: {
        sans: ["Geist", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "monospace"],
      },
    },
  },
  plugins: [],
}

export default config
