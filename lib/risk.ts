// ─────────────────────────────────────────────────────────────
//  SPECTER · lib/risk.ts
//  Risk scoring engine — produces 0–100 score per token
// ─────────────────────────────────────────────────────────────

import type { RiskBreakdown } from "./types"

// ── THRESHOLDS ────────────────────────────────────────────────
const THRESHOLDS = {
  // Spread: % of mid-price. Higher = worse liquidity
  SPREAD_LOW:    0.005,   // 0.5% — normal
  SPREAD_MED:    0.02,    // 2%   — concerning
  SPREAD_HIGH:   0.05,    // 5%   — risky

  // Liquidity: total USD depth in orderbook
  LIQ_SAFE:      500_000, // $500K+  — safe
  LIQ_MED:       100_000, // $100K+  — moderate
  LIQ_LOW:       25_000,  // $25K+   — low
  // below $25K = very risky

  // Token age: in milliseconds
  AGE_VERY_NEW:  1 * 24 * 60 * 60 * 1000,   // < 1 day
  AGE_NEW:       7 * 24 * 60 * 60 * 1000,   // < 7 days
  AGE_RECENT:    30 * 24 * 60 * 60 * 1000,  // < 30 days
  // 30+ days = normal
}

interface RiskInput {
  spreadPct: number         // e.g. 0.004 = 0.4%
  liquidityUsd: number      // total bid + ask depth in USD
  tokenAgeMs: number        // ms since market was created
  isWhaleActive: boolean    // large whale tx in last hour
  volume24hUsd: number      // 24h volume in USD
}

/**
 * Calculate a composite risk score (0–100) for a token.
 *
 * Score breakdown:
 *   0–25  → Spread score    (wide spread = illiquid = risky)
 *   0–30  → Liquidity score (thin book = risky)
 *   0–25  → Age score       (new token = unproven = risky)
 *   0–20  → Whale score     (large actor = volatility risk)
 *
 * Lower score = safer. Higher score = riskier.
 */
export function calcRiskScore(input: RiskInput): RiskBreakdown {
  const { spreadPct, liquidityUsd, tokenAgeMs, isWhaleActive, volume24hUsd } =
    input

  // ── 1. SPREAD SCORE (0–25) ───────────────────────────────
  let spreadScore = 0
  if (spreadPct >= THRESHOLDS.SPREAD_HIGH) {
    spreadScore = 25
  } else if (spreadPct >= THRESHOLDS.SPREAD_MED) {
    spreadScore = 18
  } else if (spreadPct >= THRESHOLDS.SPREAD_LOW) {
    spreadScore = 8
  }
  // Normalize: interpolate within range for smoother scores
  spreadScore = Math.min(25, Math.round(spreadScore))

  // ── 2. LIQUIDITY SCORE (0–30) ────────────────────────────
  let liquidityScore = 0
  if (liquidityUsd < 10_000) {
    liquidityScore = 30
  } else if (liquidityUsd < THRESHOLDS.LIQ_LOW) {
    liquidityScore = 22
  } else if (liquidityUsd < THRESHOLDS.LIQ_MED) {
    liquidityScore = 14
  } else if (liquidityUsd < THRESHOLDS.LIQ_SAFE) {
    liquidityScore = 6
  }
  liquidityScore = Math.min(30, Math.round(liquidityScore))

  // ── 3. AGE SCORE (0–25) ──────────────────────────────────
  let ageScore = 0
  if (tokenAgeMs < THRESHOLDS.AGE_VERY_NEW) {
    ageScore = 25
  } else if (tokenAgeMs < THRESHOLDS.AGE_NEW) {
    ageScore = 18
  } else if (tokenAgeMs < THRESHOLDS.AGE_RECENT) {
    ageScore = 8
  }
  ageScore = Math.min(25, Math.round(ageScore))

  // ── 4. WHALE SCORE (0–20) ────────────────────────────────
  // Whale activity = high short-term volatility risk
  // Also penalize if volume is very low (easy to manipulate)
  let whaleScore = 0
  if (isWhaleActive) {
    whaleScore += 15
  }
  if (volume24hUsd < 5_000 && liquidityUsd < 50_000) {
    whaleScore += 5 // low volume + low liq = manipulation risk
  }
  whaleScore = Math.min(20, Math.round(whaleScore))

  // ── TOTAL ────────────────────────────────────────────────
  const total = Math.min(
    100,
    spreadScore + liquidityScore + ageScore + whaleScore
  )

  const label =
    total >= 75 ? "HIGH" : total >= 50 ? "MED" : total >= 25 ? "LOW" : "SAFE"

  const explanation = buildExplanation(
    total,
    spreadPct,
    liquidityUsd,
    tokenAgeMs,
    isWhaleActive
  )

  return {
    score: total,
    label,
    factors: { spreadScore, liquidityScore, ageScore, whaleScore },
    explanation,
  }
}

function buildExplanation(
  score: number,
  spreadPct: number,
  liquidityUsd: number,
  ageMs: number,
  whaleActive: boolean
): string {
  const parts: string[] = []
  if (spreadPct > THRESHOLDS.SPREAD_MED)
    parts.push(`wide spread (${(spreadPct * 100).toFixed(2)}%)`)
  if (liquidityUsd < THRESHOLDS.LIQ_MED)
    parts.push(`low liquidity ($${(liquidityUsd / 1000).toFixed(0)}K)`)
  if (ageMs < THRESHOLDS.AGE_NEW) parts.push("new token (<7 days)")
  if (whaleActive) parts.push("active whale movement")

  if (parts.length === 0) return "No significant risk factors detected."
  return `Risk factors: ${parts.join(", ")}.`
}

/**
 * Quick helper — just returns the score number.
 */
export function quickRiskScore(input: RiskInput): number {
  return calcRiskScore(input).score
}

/**
 * Format token age from ms to readable string.
 * e.g. 90000000 ms → "1d" | "6h" | "3m" | "2y"
 */
export function formatAge(ageMs: number): string {
  const s = ageMs / 1000
  const m = s / 60
  const h = m / 60
  const d = h / 24
  const mo = d / 30
  const y = d / 365

  if (y >= 1) return `${Math.floor(y)}y`
  if (mo >= 1) return `${Math.floor(mo)}m`
  if (d >= 1) return `${Math.floor(d)}d`
  if (h >= 1) return `${Math.floor(h)}h`
  return `${Math.floor(m)}min`
}
