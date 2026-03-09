// ─────────────────────────────────────────────────────────────
//  SPECTER · app/api/markets/route.ts
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

const CACHE_DURATION_MS = 30_000
let cachedResponse: { data: SpectерToken[]; timestamp: number } | null = null

export async function GET() {
  try {
    if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_DURATION_MS) {
      return NextResponse.json({
        data: cachedResponse.data,
        timestamp: cachedResponse.timestamp,
        cached: true,
      })
    }

    const rawMarkets = await fetchAllMarkets()
    const markets = rawMarkets.slice(0, 50)

    const enriched = await Promise.allSettled(
      markets.map(async (market) => {
        const marketId = market.marketId
        const baseDecimals = market.baseToken?.decimals ?? 18
        const quoteDecimals = market.quoteToken?.decimals ?? 6

        const [obResult, tradesResult] = await Promise.allSettled([
          fetchOrderbook(marketId),
          fetchTrades(marketId),
        ])

        let price = 0
        let spreadPct = 0
        let bidDepthUsd = 0
        let askDepthUsd = 0

        if (obResult.status === "fulfilled") {
          const ob = obResult.value
          const topBid = ob.buys?.[0]
          const topAsk = ob.sells?.[0]

          if (topBid && topAsk) {
            const bidPrice = normalizePrice(topBid.price, baseDecimals, quoteDecimals)
            const askPrice = normalizePrice(topAsk.price, baseDecimals, quoteDecimals)
            const mid = (bidPrice + askPrice) / 2
            price = mid
            spreadPct = mid > 0 ? (askPrice - bidPrice) / mid : 0
          }

          const bids = ob.buys ?? []
          const asks = ob.sells ?? []

          bidDepthUsd = bids.reduce((sum: number, level: any) => {
            const p = normalizePrice(level.price, baseDecimals, quoteDecimals)
            const q = normalizeQuantity(level.quantity, baseDecimals)
            return sum + p * q
          }, 0)

          askDepthUsd = asks.reduce((sum: number, level: any) => {
            const p = normalizePrice(level.price, baseDecimals, quoteDecimals)
            const q = normalizeQuantity(level.quantity, baseDecimals)
            return sum + p * q
          }, 0)
        }

        const liquidityUsd = bidDepthUsd + askDepthUsd

        let volume24hUsd = 0
        let priceChange24h = 0
        let isWhaleActive = false
        const now = Date.now()
        const oneDayAgo = now - 24 * 60 * 60 * 1000
        const oneHourAgo = now - 60 * 60 * 1000

        if (tradesResult.status === "fulfilled") {
          const trades: any[] = tradesResult.value as any[]
          const recentTrades = trades.filter(
            (t: any) => Number(t.executedAt) >= oneDayAgo
          )

          volume24hUsd = recentTrades.reduce((sum: number, t: any) => {
            const p = normalizePrice(t.price, baseDecimals, quoteDecimals)
            const q = normalizeQuantity(t.quantity, baseDecimals)
            return sum + p * q
          }, 0)

          if (recentTrades.length >= 2) {
            const sorted = [...recentTrades].sort(
              (a: any, b: any) => Number(a.executedAt) - Number(b.executedAt)
            )
            const firstTradePrice = normalizePrice(sorted[0].price, baseDecimals, quoteDecimals)
            const latestTradePrice = normalizePrice(sorted[sorted.length - 1].price, baseDecimals, quoteDecimals)
            if (firstTradePrice > 0) {
              priceChange24h = ((latestTradePrice - firstTradePrice) / firstTradePrice) * 100
            }
          }

          isWhaleActive = trades
            .filter((t: any) => Number(t.executedAt) >= oneHourAgo)
            .some((t: any) => {
              const p = normalizePrice(t.price, baseDecimals, quoteDecimals)
              const q = normalizeQuantity(t.quantity, baseDecimals)
              return p * q >= WHALE_THRESHOLD_USD
            })
        }

        const marketCreatedAt = market.marketId
          ? estimateMarketAge(market.marketId)
          : now - 365 * 24 * 60 * 60 * 1000
        const tokenAgeMs = now - marketCreatedAt

        const risk = calcRiskScore({
          spreadPct,
          liquidityUsd,
          tokenAgeMs,
          isWhaleActive,
          volume24hUsd,
        })

        const baseSymbol = market.baseToken?.symbol ?? parseSymbol(market.baseDenom, "???")
        const quoteSymbol = market.quoteToken?.symbol ?? parseSymbol(market.quoteDenom, "USDT")
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

    const tokens: SpectерToken[] = enriched
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<SpectерToken>).value)
      .filter((t) => t.price > 0)

    tokens.sort((a, b) => b.volume24h - a.volume24h)

    cachedResponse = { data: tokens, timestamp: Date.now() }

    return NextResponse.json({ data: tokens, timestamp: Date.now(), cached: false })
  } catch (err: any) {
    console.error("[/api/markets] error:", err)
    return NextResponse.json(
      { error: "Failed to fetch markets", detail: err?.message ?? "" },
      { status: 500 }
    )
  }
}

function estimateMarketAge(marketId: string): number {
  const now = Date.now()
  const ONE_YEAR = 365 * 24 * 60 * 60 * 1000
  const ONE_MONTH = 30 * 24 * 60 * 60 * 1000

  const KNOWN_OLD_MARKETS = [
    "0x0611780ba69656949525013d947713300f56c37f44c394",
    "0x4ca0f92fc28be0c9761326016b5a1a2177dd6375558365",
  ]

  if (KNOWN_OLD_MARKETS.some((id: string) => marketId.startsWith(id.slice(0, 20)))) {
    return now - ONE_YEAR * 2
  }

  return now - ONE_MONTH
}