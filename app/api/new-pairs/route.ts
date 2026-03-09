// app/api/new-pairs/route.ts
import { NextResponse } from "next/server"
import {
  fetchAllMarkets,
  fetchTrades,
  normalizePrice,
  normalizeQuantity,
  WHALE_THRESHOLD_USD,
} from "@/lib/injective"
import { calcRiskScore } from "@/lib/risk"

// Cache for 2 minutes — new listings don't change that fast
const CACHE_MS = 120_000
let cache: { data: NewPair[]; timestamp: number } | null = null

// Markets we know are old — skip the expensive "find first trade" call for these
const KNOWN_OLD_MARKET_PREFIXES = [
  "0x0611780ba69656949525013d947713300f56c37f44c394", // INJ/USDT
  "0x4ca0f92fc28be0c9761326016b5a1a2177dd6375558365", // BTC perp
  "0xa508cb32923323679f29a032c70342c147c17d0145625a", // ETH/USDT
]

// How many days back to look for "new" listings
const NEW_PAIR_DAYS = 30

export interface NewPair {
  marketId:          string
  ticker:            string
  baseSymbol:        string
  quoteSymbol:       string
  price:             number
  priceChangeTotal:  number   // % change from listing price to now
  priceChange24h:    number   // standard 24h change
  volume24h:         number
  listingTimestamp:  number   // unix ms when first trade happened
  listingPrice:      number   // price of first ever trade
  riskScore:         number
  riskLabel:         "SAFE" | "LOW" | "MED" | "HIGH"
  isWhaleActive:     boolean
  makerFee:          string
  takerFee:          string
  tradeCount:        number   // total trades since listing (from our sample)
}

export async function GET() {
  try {
    if (cache && Date.now() - cache.timestamp < CACHE_MS) {
      return NextResponse.json({ data: cache.data, timestamp: cache.timestamp, cached: true })
    }

    const allMarkets = await fetchAllMarkets()
    const now        = Date.now()
    const cutoff     = now - NEW_PAIR_DAYS * 24 * 60 * 60 * 1000
    const oneHourAgo = now - 60 * 60 * 1000
    const oneDayAgo  = now - 24 * 60 * 60 * 1000

    // Filter out known-old markets to save API calls
    const candidates = allMarkets.filter(
      (m) => !KNOWN_OLD_MARKET_PREFIXES.some((p) => m.marketId.startsWith(p.slice(0, 20)))
    )

    const results = await Promise.allSettled(
      candidates.map(async (market): Promise<NewPair | null> => {
        const baseDecimals  = market.baseToken?.decimals  ?? 18
        const quoteDecimals = market.quoteToken?.decimals ?? 6
        const ticker        = market.ticker ?? `${market.baseToken?.symbol}/${market.quoteToken?.symbol}`
        const baseSymbol    = market.baseToken?.symbol  ?? "???"
        const quoteSymbol   = market.quoteToken?.symbol ?? "USDT"

        // Fetch recent trades (up to 100) — gives us current price, volume, whale activity
        // and we look at the oldest trade in this sample as a proxy for listing date
        let trades: any[] = []
        try {
          trades = await fetchTrades(market.marketId)
        } catch {
          return null
        }

        if (!trades.length) return null

        // Sort trades oldest-first
        const sorted = [...trades].sort((a, b) => Number(a.executedAt) - Number(b.executedAt))
        const oldest = sorted[0]
        const newest = sorted[sorted.length - 1]

        const listingTimestamp = Number(oldest.executedAt)

        // Only include markets where the OLDEST trade in our sample is within NEW_PAIR_DAYS
        // This is conservative — if the market has been trading for over 100 trades ago it won't show
        // But it's real data, not a guess
        if (listingTimestamp < cutoff) return null

        // Listing price = price of oldest trade
        const listingPrice = normalizePrice(oldest.price, baseDecimals, quoteDecimals)

        // Current price = price of newest trade
        const currentPrice = normalizePrice(newest.price, baseDecimals, quoteDecimals)

        if (listingPrice <= 0 || currentPrice <= 0) return null

        // Price change since listing
        const priceChangeTotal = ((currentPrice - listingPrice) / listingPrice) * 100

        // 24h price change
        const tradesLast24h = trades.filter((t) => Number(t.executedAt) >= oneDayAgo)
        let priceChange24h  = 0
        if (tradesLast24h.length >= 2) {
          const oldest24h = [...tradesLast24h].sort((a, b) => Number(a.executedAt) - Number(b.executedAt))[0]
          const first24hP  = normalizePrice(oldest24h.price, baseDecimals, quoteDecimals)
          if (first24hP > 0) priceChange24h = ((currentPrice - first24hP) / first24hP) * 100
        }

        // Volume 24h
        let volume24h = 0
        for (const t of tradesLast24h) {
          const p = normalizePrice(t.price, baseDecimals, quoteDecimals)
          const q = normalizeQuantity(t.quantity, baseDecimals)
          volume24h += p * q
        }

        // Whale detection
        const isWhaleActive = trades
          .filter((t) => Number(t.executedAt) >= oneHourAgo)
          .some((t) => {
            const p = normalizePrice(t.price, baseDecimals, quoteDecimals)
            const q = normalizeQuantity(t.quantity, baseDecimals)
            return p * q >= WHALE_THRESHOLD_USD
          })

        // Risk score
        const ageMs = now - listingTimestamp
        const risk  = calcRiskScore({
          spreadPct:    5,          // new markets get conservative spread score
          liquidityUsd: volume24h * 0.1,
          tokenAgeMs:   ageMs,
          isWhaleActive,
          volume24hUsd: volume24h,
        })

        return {
          marketId:         market.marketId,
          ticker,
          baseSymbol,
          quoteSymbol,
          price:            parseFloat(currentPrice.toFixed(8)),
          priceChangeTotal: parseFloat(priceChangeTotal.toFixed(2)),
          priceChange24h:   parseFloat(priceChange24h.toFixed(2)),
          volume24h:        parseFloat(volume24h.toFixed(2)),
          listingTimestamp,
          listingPrice:     parseFloat(listingPrice.toFixed(8)),
          riskScore:        risk.score,
          riskLabel:        risk.label,
          isWhaleActive,
          makerFee:         market.makerFeeRate ?? "0",
          takerFee:         market.takerFeeRate ?? "0",
          tradeCount:       trades.length,
        }
      })
    )

    const newPairs: NewPair[] = results
      .filter((r) => r.status === "fulfilled" && r.value !== null)
      .map((r)    => (r as PromiseFulfilledResult<NewPair>).value!)
      // Sort newest listing first
      .sort((a, b) => b.listingTimestamp - a.listingTimestamp)

    cache = { data: newPairs, timestamp: now }
    return NextResponse.json({ data: newPairs, total: newPairs.length, timestamp: now, cached: false })

  } catch (err: any) {
    console.error("[/api/new-pairs] error:", err?.message)
    return NextResponse.json(
      { error: "Failed to fetch new pairs", detail: err?.message ?? "" },
      { status: 500 }
    )
  }
}