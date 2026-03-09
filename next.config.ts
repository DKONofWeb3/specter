import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // ── Turbopack (Next.js 16 default) ────────────────────────
  // Empty config silences the webpack/turbopack conflict warning.
  // Injective SDK works fine under Turbopack with no extra config.
  turbopack: {},

  // ── External packages (moved out of experimental in Next 16) ──
  serverExternalPackages: [
    "@injectivelabs/sdk-ts",
    "@injectivelabs/networks",
  ],

  // ── Images: allow token logo CDNs ─────────────────────────
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.injective.com" },
      { protocol: "https", hostname: "**.coingecko.com" },
      { protocol: "https", hostname: "raw.githubusercontent.com" },
    ],
  },
}

export default nextConfig