// ─────────────────────────────────────────────────────────────
//  SPECTER · lib/format.ts
//  All display formatting helpers used across the UI.
//  Import these everywhere — never format inline.
// ─────────────────────────────────────────────────────────────

// ── PRICE ─────────────────────────────────────────────────────

/**
 * Format a token price for display.
 * Handles everything from $0.000000089 to $84,000
 */
export function fPrice(price: number): string {
  if (!price || price === 0) return "$0.00"
  if (price >= 10_000) return "$" + price.toLocaleString("en-US", { maximumFractionDigits: 0 })
  if (price >= 1_000)  return "$" + price.toLocaleString("en-US", { maximumFractionDigits: 2 })
  if (price >= 1)      return "$" + price.toFixed(2)
  if (price >= 0.01)   return "$" + price.toFixed(4)
  if (price >= 0.0001) return "$" + price.toFixed(6)
  // Very small prices — scientific would be ugly, use 8 dp
  return "$" + price.toFixed(8)
}

// ── PERCENTAGE ────────────────────────────────────────────────

/**
 * Format a percentage change for display.
 * e.g. 3.241 → "+3.24%", -0.5 → "-0.50%"
 */
export function fPct(pct: number): string {
  const sign = pct >= 0 ? "+" : ""
  return `${sign}${pct.toFixed(2)}%`
}

/**
 * CSS class for a percentage value. Use with Tailwind.
 */
export function pctClass(pct: number): string {
  return pct >= 0 ? "text-green" : "text-red"
}

// ── VOLUME / USD AMOUNTS ──────────────────────────────────────

/**
 * Compact USD value for display in tables.
 * e.g. 1_234_567 → "$1.23M", 890_000 → "$890K"
 */
export function fUsd(amount: number): string {
  if (!amount || amount === 0) return "$0"
  if (amount >= 1_000_000_000) return "$" + (amount / 1_000_000_000).toFixed(2) + "B"
  if (amount >= 1_000_000)     return "$" + (amount / 1_000_000).toFixed(2) + "M"
  if (amount >= 1_000)         return "$" + (amount / 1_000).toFixed(1) + "K"
  return "$" + amount.toFixed(0)
}

/**
 * Full USD value with commas for detail panels.
 * e.g. 1234567.89 → "$1,234,567.89"
 */
export function fUsdFull(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  })
}

// ── QUANTITY ──────────────────────────────────────────────────

/**
 * Format a token quantity.
 * e.g. 12345.6789 → "12,345.68"
 */
export function fQty(qty: number): string {
  if (qty >= 1_000_000) return (qty / 1_000_000).toFixed(2) + "M"
  if (qty >= 1_000)     return qty.toLocaleString("en-US", { maximumFractionDigits: 2 })
  if (qty >= 1)         return qty.toFixed(4)
  return qty.toFixed(6)
}

// ── WALLET ADDRESS ────────────────────────────────────────────

/**
 * Shorten a wallet/subaccount address for display.
 * e.g. "inj1abc...xyz" → "inj1abc...xyz" (first 8, last 6)
 */
export function fWallet(address: string): string {
  if (!address || address === "unknown" || address.length < 12) return address
  return `${address.slice(0, 8)}...${address.slice(-6)}`
}

/**
 * Full wallet with copy-friendly format.
 * Returns the full address — use fWallet() for display.
 */
export function fullWallet(address: string): string {
  return address
}

// ── TIME ──────────────────────────────────────────────────────

/**
 * Relative time from unix ms timestamp.
 * e.g. "2m ago", "1h ago", "3d ago"
 */
export function fTimeAgo(unixMs: number): string {
  const diff = Date.now() - unixMs
  const s = diff / 1000
  const m = s / 60
  const h = m / 60
  const d = h / 24

  if (s < 10)  return "just now"
  if (s < 60)  return `${Math.floor(s)}s ago`
  if (m < 60)  return `${Math.floor(m)}m ago`
  if (h < 24)  return `${Math.floor(h)}h ago`
  if (d < 30)  return `${Math.floor(d)}d ago`
  return new Date(unixMs).toLocaleDateString()
}

/**
 * Format unix ms as HH:MM:SS for the live trade feed.
 */
export function fTime(unixMs: number): string {
  return new Date(unixMs).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

// ── RISK ──────────────────────────────────────────────────────

/**
 * Tailwind color class for a risk score (0–100).
 */
export function riskColorClass(score: number): string {
  if (score >= 75) return "text-red"
  if (score >= 50) return "text-orange-400"
  if (score >= 25) return "text-yellow-400"
  return "text-green"
}

/**
 * Hex color for risk score — used in canvas/D3 where Tailwind can't reach.
 */
export function riskColor(score: number): string {
  if (score >= 75) return "#f0506e"
  if (score >= 50) return "#fb923c"
  if (score >= 25) return "#facc15"
  return "#22d3a5"
}

/**
 * Short risk label from score.
 */
export function riskLabel(score: number): "HIGH" | "MED" | "LOW" | "SAFE" {
  if (score >= 75) return "HIGH"
  if (score >= 50) return "MED"
  if (score >= 25) return "LOW"
  return "SAFE"
}

// ── TOKEN AGE ─────────────────────────────────────────────────

/**
 * Human-readable age from ms duration.
 * e.g. 86400000 → "1d", 3600000 → "1h"
 */
export function fAge(ageMs: number): string {
  const s = ageMs / 1000
  const m = s / 60
  const h = m / 60
  const d = h / 24
  const mo = d / 30
  const y = d / 365

  if (y >= 1)  return `${Math.floor(y)}y`
  if (mo >= 1) return `${Math.floor(mo)}mo`
  if (d >= 1)  return `${Math.floor(d)}d`
  if (h >= 1)  return `${Math.floor(h)}h`
  return `${Math.floor(m)}min`
}

// ── TICKER ────────────────────────────────────────────────────

/**
 * Extract base symbol from ticker string.
 * "INJ/USDT" → "INJ"
 */
export function baseSymbol(ticker: string): string {
  return ticker.split("/")[0] ?? ticker
}
