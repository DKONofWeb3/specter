// app/api/traders/route.ts
import { NextResponse } from "next/server"
import {
  fetchAllMarkets,
  fetchTrades,
  normalizePrice,
  normalizeQuantity,
  walletFromSubaccount,
} from "@/lib/injective"
import type { TraderStats } from "@/lib/types"

const CACHE_MS       = 60_000
const MARKETS_TO_SCAN = 15
let cache: { data: TraderStats[]; timestamp: number } | null = null

export async function GET() {
  try {
    if (cache && Date.now() - cache.timestamp < CACHE_MS) {
      return NextResponse.json({ data: cache.data, timestamp: cache.timestamp, cached: true })
    }

    const allMarkets = await fetchAllMarkets()
    const topMarkets = allMarkets.slice(0, MARKETS_TO_SCAN)

    type WalletAgg = {
      tradeCount: number
      totalVolumeUsd: number
      totalBuyUsd: number
      totalSellUsd: number
      buyCount: number
      sellCount: number
      tokenCounts: Map<string, number>
      lastActive: number
    }
    const walletMap = new Map<string, WalletAgg>()

    const allTradeResults = await Promise.allSettled(
      topMarkets.map(async (market) => {
        const baseDecimals  = market.baseToken?.decimals ?? 18
        const quoteDecimals = market.quoteToken?.decimals ?? 6
        const ticker        = market.ticker ?? market.marketId
        const rawTrades     = await fetchTrades(market.marketId)
        return rawTrades.map((t) => ({
          wallet:      walletFromSubaccount(t.subaccountId ?? ""),
          side:        t.tradeDirection === "buy" ? "buy" : "sell",
          valueUsd:    normalizePrice(t.price, baseDecimals, quoteDecimals) * normalizeQuantity(t.quantity, baseDecimals),
          ticker,
          executedAt:  Number(t.executedAt),
        }))
      })
    )

    for (const result of allTradeResults) {
      if (result.status !== "fulfilled") continue
      for (const trade of result.value) {
        const { wallet, side, valueUsd, ticker, executedAt } = trade
        if (!wallet || wallet === "unknown") continue
        if (!walletMap.has(wallet)) {
          walletMap.set(wallet, {
            tradeCount: 0, totalVolumeUsd: 0,
            totalBuyUsd: 0, totalSellUsd: 0,
            buyCount: 0, sellCount: 0,
            tokenCounts: new Map(), lastActive: 0,
          })
        }
        const s = walletMap.get(wallet)!
        s.tradeCount++
        s.totalVolumeUsd += valueUsd
        if (side === "buy") { s.totalBuyUsd += valueUsd; s.buyCount++ }
        else                { s.totalSellUsd += valueUsd; s.sellCount++ }
        s.tokenCounts.set(ticker, (s.tokenCounts.get(ticker) ?? 0) + 1)
        if (executedAt > s.lastActive) s.lastActive = executedAt
      }
    }

    const traders: TraderStats[] = []
    for (const [wallet, s] of walletMap.entries()) {
      if (s.tradeCount < 3) continue
      let topToken = "N/A", topCount = 0
      for (const [ticker, count] of s.tokenCounts.entries()) {
        if (count > topCount) { topToken = ticker.split("/")[0]; topCount = count }
      }
      traders.push({
        walletAddress:   wallet,
        tradeCount:      s.tradeCount,
        totalVolumeUsd:  parseFloat(s.totalVolumeUsd.toFixed(2)),
        totalBuys:       s.buyCount,
        totalSells:      s.sellCount,
        winRate:         Math.min(100, Math.round((s.sellCount / s.tradeCount) * 100)),
        estimatedPnlUsd: parseFloat((s.totalSellUsd - s.totalBuyUsd).toFixed(2)),
        topToken,
        lastActive:      s.lastActive,
      })
    }

    traders.sort((a, b) => b.estimatedPnlUsd - a.estimatedPnlUsd)
    const data = traders.slice(0, 50)
    cache = { data, timestamp: Date.now() }

    return NextResponse.json({ data, timestamp: Date.now(), total: data.length, cached: false })
  } catch (err: any) {
    console.error("[/api/traders] error:", err)
    return NextResponse.json({ error: "Failed to build trader leaderboard", detail: err?.message ?? "" }, { status: 500 })
  }
}