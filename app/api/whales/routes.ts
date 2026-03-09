// app/api/whales/route.ts
import { NextResponse } from "next/server"
import {
  fetchAllMarkets,
  fetchTrades,
  normalizePrice,
  normalizeQuantity,
  walletFromSubaccount,
  WHALE_THRESHOLD_USD,
} from "@/lib/injective"
import type { WhaleTx } from "@/lib/types"

const CACHE_MS = 20_000
let cache: { data: WhaleTx[]; timestamp: number } | null = null
const MARKETS_TO_SCAN = 20

export async function GET() {
  try {
    if (cache && Date.now() - cache.timestamp < CACHE_MS) {
      return NextResponse.json({ data: cache.data, timestamp: cache.timestamp, cached: true })
    }

    const allMarkets = await fetchAllMarkets()
    const topMarkets = allMarkets.slice(0, MARKETS_TO_SCAN)

    const tradeResults = await Promise.allSettled(
      topMarkets.map(async (market) => {
        const baseDecimals  = market.baseToken?.decimals ?? 18
        const quoteDecimals = market.quoteToken?.decimals ?? 6
        const ticker        = market.ticker ?? market.marketId
        const rawTrades     = await fetchTrades(market.marketId)
        const oneHourAgo    = Date.now() - 60 * 60 * 1000

        const result: WhaleTx[] = []
        for (const t of rawTrades) {
          if (Number(t.executedAt) < oneHourAgo) continue
          const price     = normalizePrice(t.price, baseDecimals, quoteDecimals)
          const quantity  = normalizeQuantity(t.quantity, baseDecimals)
          const valueUsd  = price * quantity
          if (valueUsd < WHALE_THRESHOLD_USD) continue
          result.push({
            tradeId:       t.tradeId ?? `${market.marketId}-${t.executedAt}`,
            marketId:      market.marketId,
            ticker,
            walletAddress: walletFromSubaccount(t.subaccountId ?? ""),
            side:          t.tradeDirection === "buy" ? "buy" : "sell",
            valueUsd:      parseFloat(valueUsd.toFixed(2)),
            price:         parseFloat(price.toFixed(6)),
            quantity:      parseFloat(quantity.toFixed(4)),
            executedAt:    Number(t.executedAt),
            riskScore:     0,
          })
        }
        return result
      })
    )

    const whaleTxs: WhaleTx[] = []
    for (const r of tradeResults) {
      if (r.status === "fulfilled") whaleTxs.push(...r.value)
    }
    whaleTxs.sort((a, b) => b.valueUsd - a.valueUsd)

    const data = whaleTxs.slice(0, 100)
    cache = { data, timestamp: Date.now() }

    return NextResponse.json({ data, timestamp: Date.now(), total: data.length, cached: false })
  } catch (err: any) {
    console.error("[/api/whales] error:", err)
    return NextResponse.json({ error: "Failed to fetch whale data", detail: err?.message ?? "" }, { status: 500 })
  }
}