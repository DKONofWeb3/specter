// app/api/portfolio/[address]/route.ts
import { NextResponse } from "next/server"
import {
  ChainGrpcBankApi,
  IndexerGrpcAccountApi,
  IndexerGrpcSpotApi,
} from "@injectivelabs/sdk-ts"
import { getNetworkEndpoints, Network } from "@injectivelabs/networks"
import { normalizePrice, normalizeQuantity, fetchAllMarkets } from "@/lib/injective"

const endpoints  = getNetworkEndpoints(Network.Mainnet)
const bankApi    = new ChainGrpcBankApi(endpoints.grpc)
const accountApi = new IndexerGrpcAccountApi(endpoints.indexer)
const spotApi    = new IndexerGrpcSpotApi(endpoints.indexer)

const CACHE_MS   = 30_000
const cache      = new Map<string, { data: any; ts: number }>()

// Known token denoms → human metadata
const KNOWN_DENOMS: Record<string, { symbol: string; decimals: number; usdPrice?: number }> = {
  "inj":                                                     { symbol: "INJ",  decimals: 18 },
  "peggy0xdAC17F958D2ee523a2206206994597C13D831ec7":        { symbol: "USDT", decimals: 6,  usdPrice: 1 },
  "ibc/B448C0CA358B958301D328CCDC5D5AD642FC30A6D3AE106FF721DB315F3DDE5C": { symbol: "USDC", decimals: 6,  usdPrice: 1 },
}

/** Convert inj1... bech32 to 0x hex (drop the checksum padding) */
function injAddressToSubaccount(address: string): string {
  // For EVM addresses (0x...) — straight padding
  if (address.startsWith("0x")) {
    return address.toLowerCase().replace("0x", "0x") + "000000000000000000000000"
  }
  // For bech32 inj1... addresses, use the SDK utility
  // The subaccountId convention: last 24 hex chars are the nonce (000...0 = default)
  // We'll try the raw address directly — the indexer accepts the inj1 address too
  return address + "000000000000000000000000"
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params
    if (!address || address.length < 10) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 })
    }

    const cached = cache.get(address)
    if (cached && Date.now() - cached.ts < CACHE_MS) {
      return NextResponse.json({ data: cached.data, cached: true })
    }

    // ── 1. Token balances from chain ─────────────────────────
    let balances: { denom: string; amount: string }[] = []
    try {
      const result = await bankApi.fetchBalances(address)
      balances = (result.balances ?? []) as { denom: string; amount: string }[]
    } catch (e) {
      console.warn("[portfolio] bankApi failed:", (e as any)?.message)
    }

    // Enrich balances with symbols + USD estimates
    // Fetch live markets once for price lookup
    const markets = await fetchAllMarkets()
    const priceMap = new Map<string, number>() // denom → USD price (rough)

    // Build price map from orderbook mid-prices already computed in /api/markets
    // We skip re-fetching — use known stables + INJ approximation
    const enrichedBalances = balances
      .map((b: any) => {
        const known    = KNOWN_DENOMS[b.denom]
        const decimals = known?.decimals ?? 18
        const symbol   = known?.symbol ?? b.denom.split("/").pop()?.toUpperCase() ?? "???"
        const amount   = parseFloat(b.amount) / Math.pow(10, decimals)
        return { denom: b.denom, symbol, amount, decimals, raw: b.amount }
      })
      .filter((b) => b.amount > 0)
      .sort((a, b) => {
        // INJ first, then stables, then rest
        if (a.symbol === "INJ") return -1
        if (b.symbol === "INJ") return 1
        if (a.symbol === "USDT" || a.symbol === "USDC") return -1
        if (b.symbol === "USDT" || b.symbol === "USDC") return 1
        return b.amount - a.amount
      })

    // ── 2. Recent trade history for this wallet ───────────────
    // Subaccount ID = address padded with 24 zeros (default subaccount)
    const subaccountId = address.startsWith("0x")
      ? address.toLowerCase() + "000000000000000000000000"
      : address + "000000000000000000000000"

    let recentTrades: any[] = []
    try {
      const result = await spotApi.fetchTrades({ subaccountId, limit: 50 })
      recentTrades = (result as any).trades ?? result ?? []
    } catch (e) {
      console.warn("[portfolio] fetchTrades failed:", (e as any)?.message)
    }

    // Enrich trades with human-readable values
    const tradeHistory = recentTrades.slice(0, 30).map((t: any) => {
      // Find market metadata
      const market       = markets.find((m) => m.marketId === t.marketId)
      const baseDecimals  = market?.baseToken?.decimals  ?? 18
      const quoteDecimals = market?.quoteToken?.decimals ?? 6
      const ticker        = market?.ticker ?? t.marketId?.slice(0, 12) + "…"
      const price         = normalizePrice(t.price, baseDecimals, quoteDecimals)
      const quantity      = normalizeQuantity(t.quantity, baseDecimals)
      return {
        tradeId:    t.tradeId ?? `${t.executedAt}-${t.marketId}`,
        marketId:   t.marketId,
        ticker,
        side:       t.tradeDirection === "buy" ? "buy" : "sell",
        price:      parseFloat(price.toFixed(6)),
        quantity:   parseFloat(quantity.toFixed(4)),
        valueUsd:   parseFloat((price * quantity).toFixed(2)),
        executedAt: Number(t.executedAt),
      }
    }).sort((a: any, b: any) => b.executedAt - a.executedAt)

    // ── 3. Open orders ────────────────────────────────────────
    let openOrders: any[] = []
    try {
      const result = await spotApi.fetchOrders({ subaccountId, orderSide: undefined } as any)
      const raw    = (result as any).orders ?? result ?? []
      openOrders   = raw.slice(0, 20).map((o: any) => {
        const market        = markets.find((m) => m.marketId === o.marketId)
        const baseDecimals  = market?.baseToken?.decimals  ?? 18
        const quoteDecimals = market?.quoteToken?.decimals ?? 6
        const ticker        = market?.ticker ?? o.marketId?.slice(0, 12) + "…"
        const price         = normalizePrice(o.price, baseDecimals, quoteDecimals)
        const quantity      = normalizeQuantity(o.quantity, baseDecimals)
        return {
          orderId:  o.orderHash ?? o.cid ?? "—",
          marketId: o.marketId,
          ticker,
          side:     o.orderSide === "buy" ? "buy" : "sell",
          price:    parseFloat(price.toFixed(6)),
          quantity: parseFloat(quantity.toFixed(4)),
          valueUsd: parseFloat((price * quantity).toFixed(2)),
          state:    o.state ?? "booked",
        }
      })
    } catch (e) {
      console.warn("[portfolio] fetchOrders failed:", (e as any)?.message)
    }

    // ── 4. Estimated PnL from recent trades ───────────────────
    let totalBuyUsd  = 0
    let totalSellUsd = 0
    for (const t of tradeHistory) {
      if (t.side === "buy")  totalBuyUsd  += t.valueUsd
      else                   totalSellUsd += t.valueUsd
    }
    const estimatedPnl = parseFloat((totalSellUsd - totalBuyUsd).toFixed(2))

    const data = {
      address,
      balances:     enrichedBalances,
      openOrders,
      tradeHistory,
      stats: {
        totalTrades:    tradeHistory.length,
        totalVolumeUsd: parseFloat((totalBuyUsd + totalSellUsd).toFixed(2)),
        estimatedPnl,
        openOrderCount: openOrders.length,
      },
    }

    cache.set(address, { data, ts: Date.now() })
    return NextResponse.json({ data, cached: false })

  } catch (err: any) {
    console.error("[/api/portfolio] error:", err?.message)
    return NextResponse.json(
      { error: "Failed to fetch portfolio", detail: err?.message ?? "" },
      { status: 500 }
    )
  }
}