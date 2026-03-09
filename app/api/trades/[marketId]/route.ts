// ─────────────────────────────────────────────────────────────
//  SPECTER · app/api/trades/[marketId]/route.ts
//  Returns recent trades for a market, with whale flags
//  and wallet addresses derived from subaccount IDs.
// ─────────────────────────────────────────────────────────────

import { NextResponse } from "next/server"
import {
  fetchTrades,
  fetchMarket,
  normalizePrice,
  normalizeQuantity,
  walletFromSubaccount,
  WHALE_THRESHOLD_USD,
} from "@/lib/injective"
import type { Trade } from "@/lib/types"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ marketId: string }> }
) {
  const { marketId } = await params

  if (!marketId) {
    return NextResponse.json({ error: "marketId is required" }, { status: 400 })
  }

  try {
    const [rawMarket, rawTrades] = await Promise.all([
      fetchMarket(marketId),
      fetchTrades(marketId),
    ])

    const baseDecimals = rawMarket.baseToken?.decimals ?? 18
    const quoteDecimals = rawMarket.quoteToken?.decimals ?? 6
    const ticker = rawMarket.ticker ?? marketId

    const trades: Trade[] = rawTrades
      .slice(0, 100) // latest 100 trades
      .map((t: any) => {
        const price = normalizePrice(t.price, baseDecimals, quoteDecimals)
        const quantity = normalizeQuantity(t.quantity, baseDecimals)
        const valueUsd = price * quantity
        const walletAddress = walletFromSubaccount(t.subaccountId ?? "")

        return {
          tradeId: t.tradeId ?? `${t.executedAt}-${t.subaccountId}`,
          marketId,
          ticker,
          price: parseFloat(price.toFixed(6)),
          quantity: parseFloat(quantity.toFixed(4)),
          valueUsd: parseFloat(valueUsd.toFixed(2)),
          side: t.tradeDirection === "buy" ? "buy" : "sell",
          executedAt: Number(t.executedAt),
          subaccountId: t.subaccountId ?? "",
          walletAddress,
          isWhale: valueUsd >= WHALE_THRESHOLD_USD,
          tradeType: t.tradeExecutionType === "market" ? "market" : "limit",
        } satisfies Trade
      })
      // Most recent first
      .sort((a, b) => b.executedAt - a.executedAt)

    return NextResponse.json({
      data: trades,
      timestamp: Date.now(),
      whaleCount: trades.filter((t: any) => t.isWhale).length,
    })
  } catch (err: any) {
    console.error(`[/api/trades/${marketId}] error:`, err)
    return NextResponse.json(
      { error: "Failed to fetch trades", detail: err?.message ?? "" },
      { status: 500 }
    )
  }
}