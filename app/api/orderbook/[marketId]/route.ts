// ─────────────────────────────────────────────────────────────
//  SPECTER · app/api/orderbook/[marketId]/route.ts
//  Returns live bids + asks for a specific market,
//  plus spread, depth ratio, and mid price.
// ─────────────────────────────────────────────────────────────

import { NextResponse } from "next/server"
import {
  fetchOrderbook,
  fetchMarket,
  normalizePrice,
  normalizeQuantity,
} from "@/lib/injective"
import type { Orderbook, OrderbookLevel } from "@/lib/types"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ marketId: string }> }
) {
  const { marketId } = await params

  if (!marketId) {
    return NextResponse.json({ error: "marketId is required" }, { status: 400 })
  }

  try {
    const [rawMarket, rawOrderbook] = await Promise.all([
      fetchMarket(marketId),
      fetchOrderbook(marketId),
    ])

    const baseDecimals = rawMarket.baseToken?.decimals ?? 18
    const quoteDecimals = rawMarket.quoteToken?.decimals ?? 6
    const ticker = rawMarket.ticker ?? marketId

    // fetchOrderbook already unwraps the V2 response to { buys, sells }
    const ob = rawOrderbook as any

    // ── Parse asks (sells) ────────────────────────────────────
    const asks: OrderbookLevel[] = (ob.sells ?? [])
      .slice(0, 20)
      .map((level: any) => {
        const price = normalizePrice(level.price, baseDecimals, quoteDecimals)
        const quantity = normalizeQuantity(level.quantity, baseDecimals)
        return {
          price,
          quantity,
          totalUsd: parseFloat((price * quantity).toFixed(2)),
        }
      })
      .filter((l: OrderbookLevel) => l.price > 0 && l.quantity > 0)
      .sort((a: OrderbookLevel, b: OrderbookLevel) => a.price - b.price)

    // ── Parse bids (buys) ─────────────────────────────────────
    const bids: OrderbookLevel[] = (ob.buys ?? [])
      .slice(0, 20)
      .map((level: any) => {
        const price = normalizePrice(level.price, baseDecimals, quoteDecimals)
        const quantity = normalizeQuantity(level.quantity, baseDecimals)
        return {
          price,
          quantity,
          totalUsd: parseFloat((price * quantity).toFixed(2)),
        }
      })
      .filter((l: OrderbookLevel) => l.price > 0 && l.quantity > 0)
      .sort((a: OrderbookLevel, b: OrderbookLevel) => b.price - a.price)

    // ── Spread + mid ──────────────────────────────────────────
    const topBidPrice = bids[0]?.price ?? 0
    const topAskPrice = asks[0]?.price ?? 0
    const midPrice =
      topBidPrice && topAskPrice ? (topBidPrice + topAskPrice) / 2 : 0
    const spread = topAskPrice - topBidPrice
    const spreadPct = midPrice > 0 ? (spread / midPrice) * 100 : 0

    // ── Depth ratio ───────────────────────────────────────────
    const bidDepthUsd = bids.reduce((s, l) => s + l.totalUsd, 0)
    const askDepthUsd = asks.reduce((s, l) => s + l.totalUsd, 0)
    const totalDepth = bidDepthUsd + askDepthUsd
    const depthRatioBid =
      totalDepth > 0 ? (bidDepthUsd / totalDepth) * 100 : 50

    const orderbook: Orderbook = {
      marketId,
      ticker,
      asks,
      bids,
      spread: parseFloat(spread.toFixed(6)),
      spreadPct: parseFloat(spreadPct.toFixed(4)),
      midPrice: parseFloat(midPrice.toFixed(6)),
      bidDepthUsd: parseFloat(bidDepthUsd.toFixed(2)),
      askDepthUsd: parseFloat(askDepthUsd.toFixed(2)),
      depthRatioBid: parseFloat(depthRatioBid.toFixed(1)),
    }

    return NextResponse.json({ data: orderbook, timestamp: Date.now() })
  } catch (err: any) {
    console.error(`[/api/orderbook/${marketId}] error:`, err)
    return NextResponse.json(
      { error: "Failed to fetch orderbook", detail: err?.message ?? "" },
      { status: 500 }
    )
  }
}
