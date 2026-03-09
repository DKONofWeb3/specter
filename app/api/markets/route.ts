// ─────────────────────────────────────────────────────────────
//  SPECTER · app/api/markets/route.ts
//  Returns all active Injective spot markets with prices,
//  volume, liquidity, risk scores, whale flags, etc.
// ─────────────────────────────────────────────────────────────

import { NextResponse } from "next/server"
import {
  fetchAllMarkets,
  fetchOrderbook,
  fetchTrades,
  normalizePrice,
  normalizeQuantity,
  walletFromSubaccount,
  parseSymbol,
  WHALE_THRESHOLD_USD,
} from "@/lib/injective"
import { calcRiskScore, formatAge } from "@/lib/risk"
import type { SpectерToken } from "@/lib/types"

// Cache markets response for 30 seconds to avoid hammering the API
const CACHE_DURATION_MS = 30_000
let cachedResponse: { data: SpectерToken[]; timestamp: number } | null = null

export async function GET() {
  try {
    // ── Serve from cache if fresh ───────────────────────────
    if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_DURATION_MS) {
      return NextResponse.json({
        data: cachedResponse.data,
        timestamp: cachedResponse.timestamp,
        cached: true,
      })
    }

    // ── Fetch all markets ───────────────────────────────────
    const rawMarkets = await fetchAllMarkets()

    // Limit to top 50 most relevant markets to avoid timeout
    // In production you'd paginate this properly
    const markets = rawMarkets.slice(0, 50)

    // ── Enrich each market in parallel ─────────────────────
    const enriched = await Promise.allSettled(
      markets.map(async (market) => {
        const marketId = market.marketId

        // Detect decimals from market data
        const baseDecimals = market.baseToken?.decimals ?? 18
        const quoteDecimals = market.quoteToken?.decimals ?? 6

        // Fetch orderbook + recent trades in parallel
        const [obResult, tradesResult] = await Promise.allSettled([
          fetchOrderbook(marketId),
          fetchTrades(marketId),
        ])

        // ── Parse orderbook ─────────────────────────────────
        let price = 0
        let spreadPct = 0
        let bidDepthUsd = 0
        let askDepthUsd = 0

        if (obResult.status === "fulfilled") {
          const ob = obResult.value
          const topBid = ob.buys?.[0]
          const topAsk = ob.sells?.[0]

          if (topBid && topAsk) {
            const bidPrice = normalizePrice(
              topBid.price,
              baseDecimals,
              quoteDecimals
            )
            const askPrice = normalizePrice(
              topAsk.price,
              baseDecimals,
              quoteDecimals
            )
            const mid = (bidPrice + askPrice) / 2
            price = mid
            spreadPct = mid > 0 ? (askPrice - bidPrice) / mid : 0
          }

          // Calculate depth
          const bids = ob.buys ?? []
          const asks = ob.sells ?? []

          bidDepthUsd = bids.reduce((sum, level) => {
            const p = normalizePrice(level.price, baseDecimals, quoteDecimals)
            const q = normalizeQuantity(level.quantity, baseDecimals)
            return sum + p * q
          }, 0)

          askDepthUsd = asks.reduce((sum, level) => {
            const p = normalizePrice(level.price, baseDecimals, quoteDecimals)
            const q = normalizeQuantity(level.quantity, baseDecimals)
            return sum + p * q
          }, 0)
        }

        const liquidityUsd = bidDepthUsd + askDepthUsd

        // ── Parse trades ─────────────────────────────────────
        let volume24hUsd = 0
        let priceChange24h = 0
        let isWhaleActive = false
        let firstTradePrice = price
        let latestTradePrice = price
        const now = Date.now()
        const oneDayAgo = now - 24 * 60 * 60 * 1000
        const oneHourAgo = now - 60 * 60 * 1000

        if (tradesResult.status === "fulfilled") {
          const trades = tradesResult.value
          const recentTrades = trades.filter(
            (t) => Number(t.executedAt) >= oneDayAgo
          )

          // Volume
          volume24hUsd = recentTrades.reduce((sum, t) => {
            const p = normalizePrice(t.price, baseDecimals, quoteDecimals)
            const q = normalizeQuantity(t.quantity, baseDecimals)
            return sum + p * q
          }, 0)

          // Price change: compare oldest 24h trade vs latest
          if (recentTrades.length >= 2) {
            const sorted = [...recentTrades].sort(
              (a, b) => Number(a.executedAt) - Number(b.executedAt)
            )
            firstTradePrice = normalizePrice(
              sorted[0].price,
              baseDecimals,
              quoteDecimals
            )
            latestTradePrice = normalizePrice(
              sorted[sorted.length - 1].price,
              baseDecimals,
              quoteDecimals
            )
            if (firstTradePrice > 0) {
              priceChange24h =
                ((latestTradePrice - firstTradePrice) / firstTradePrice) * 100
            }
          }

          // Whale detection: any trade > threshold in last 1h
          isWhaleActive = trades
            .filter((t) => Number(t.executedAt) >= oneHourAgo)
            .some((t) => {
              const p = normalizePrice(t.price, baseDecimals, quoteDecimals)
              const q = normalizeQuantity(t.quantity, baseDecimals)
              return p * q >= WHALE_THRESHOLD_USD
            })
        }

        // ── Token age ─────────────────────────────────────────
        // Injective doesn't expose createdAt directly on markets,
        // so we approximate: if no trades older than X, assume it's new
        // A proper implementation uses on-chain block indexing
        const marketCreatedAt = market.marketId
          ? estimateMarketAge(market.marketId)
          : now - 365 * 24 * 60 * 60 * 1000 // default to 1 year if unknown
        const tokenAgeMs = now - marketCreatedAt

        // ── Risk score ────────────────────────────────────────
        const risk = calcRiskScore({
          spreadPct,
          liquidityUsd,
          tokenAgeMs,
          isWhaleActive,
          volume24hUsd,
        })

        // ── Symbols ───────────────────────────────────────────
        const baseSymbol =
          market.baseToken?.symbol ??
          parseSymbol(market.baseDenom, "???")
        const quoteSymbol =
          market.quoteToken?.symbol ??
          parseSymbol(market.quoteDenom, "USDT")

        const isTrending = volume24hUsd > 100_000 && priceChange24h > 5

        const token: SpectерToken = {
          marketId,
          ticker: market.ticker ?? `${baseSymbol}/${quoteSymbol}`,
          baseDenom: market.baseDenom,
          quoteDenom: market.quoteDenom,
          baseSymbol,
          quoteSymbol,
          price,
          priceChange24h: parseFloat(priceChange24h.toFixed(2)),
          volume24h: parseFloat(volume24hUsd.toFixed(2)),
          liquidity: parseFloat(liquidityUsd.toFixed(2)),
          marketStatus: market.marketStatus,
          riskScore: risk.score,
          riskLabel: risk.label,
          isNew: tokenAgeMs < 7 * 24 * 60 * 60 * 1000,
          isWhaleActive,
          isTrending,
          makerFee: market.makerFeeRate ?? "0",
          takerFee: market.takerFeeRate ?? "0",
        }

        return token
      })
    )

    // ── Collect successful results ──────────────────────────
    const tokens: SpectерToken[] = enriched
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<SpectерToken>).value)
      .filter((t) => t.price > 0) // discard markets with no activity

    // Sort by 24h volume desc
    tokens.sort((a, b) => b.volume24h - a.volume24h)

    // ── Cache + respond ─────────────────────────────────────
    cachedResponse = { data: tokens, timestamp: Date.now() }

    return NextResponse.json({
      data: tokens,
      timestamp: Date.now(),
      cached: false,
    })
  } catch (err: any) {
    console.error("[/api/markets] error:", err)
    return NextResponse.json(
      { error: "Failed to fetch markets", detail: err?.message ?? "" },
      { status: 500 }
    )
  }
}

/**
 * Rough heuristic to estimate when a market was created.
 * Injective market IDs are deterministic hashes — we can't
 * reverse engineer a timestamp from them directly.
 *
 * In a full implementation, you'd query the chain's gov proposals
 * or use the Injective Explorer API.
 *
 * For now, we give well-known markets a long age and default others
 * to "recent" so risk scores are conservative (safer = better UX).
 */
function estimateMarketAge(marketId: string): number {
  const now = Date.now()
  const ONE_YEAR = 365 * 24 * 60 * 60 * 1000
  const ONE_MONTH = 30 * 24 * 60 * 60 * 1000
  const ONE_WEEK = 7 * 24 * 60 * 60 * 1000

  // Known long-standing Injective markets (INJ/USDT, BTC/USDT, etc.)
  const KNOWN_OLD_MARKETS = [
    "0x0611780ba69656949525013d947713300f56c37f44c394", // INJ/USDT spot
    "0x4ca0f92fc28be0c9761326016b5a1a2177dd6375558365", // BTC/USDT-30 perp
  ]

  if (KNOWN_OLD_MARKETS.some((id) => marketId.startsWith(id.slice(0, 20)))) {
    return now - ONE_YEAR * 2
  }

  // Default: assume moderately recent (1 month)
  return now - ONE_MONTH
}
