// ─────────────────────────────────────────────────────────────
//  SPECTER · lib/injective.ts
//  Core Injective SDK client + all raw data fetching functions
// ─────────────────────────────────────────────────────────────

import {
  IndexerGrpcSpotApi,
  IndexerGrpcDerivativesApi,
} from "@injectivelabs/sdk-ts"
import { getNetworkEndpoints, Network } from "@injectivelabs/networks"

// ── CLIENT SETUP ─────────────────────────────────────────────
const NETWORK = Network.Mainnet
const endpoints = getNetworkEndpoints(NETWORK)

export const spotApi = new IndexerGrpcSpotApi(endpoints.indexer)
export const derivApi = new IndexerGrpcDerivativesApi(endpoints.indexer)

// ── WHALE THRESHOLD ───────────────────────────────────────────
export const WHALE_THRESHOLD_USD = 10_000

// ── MARKETS ──────────────────────────────────────────────────

/**
 * Fetch ALL active spot markets from Injective mainnet.
 */
export async function fetchAllMarkets() {
  try {
    const markets = await spotApi.fetchMarkets()
    return markets.filter((m) => m.marketStatus === "active")
  } catch (err) {
    console.error("[injective] fetchAllMarkets error:", err)
    throw err
  }
}

/**
 * Fetch a single spot market by its marketId.
 */
export async function fetchMarket(marketId: string) {
  try {
    return await spotApi.fetchMarket(marketId)
  } catch (err) {
    console.error(`[injective] fetchMarket error for ${marketId}:`, err)
    throw err
  }
}

// ── ORDERBOOK ────────────────────────────────────────────────

/**
 * Fetch live orderbook (bids + asks) for a market.
 * Uses V2 API. Returns normalized { buys, sells } shape.
 */
export async function fetchOrderbook(marketId: string) {
  try {
    const result = await spotApi.fetchOrderbookV2(marketId) as any
    // V2 wraps response: { orderbook: { buys, sells } }
    return result?.orderbook ?? result
  } catch (err) {
    console.error(`[injective] fetchOrderbook error for ${marketId}:`, err)
    throw err
  }
}

// ── TRADES ───────────────────────────────────────────────────

/**
 * Fetch recent trades for a specific market.
 * Returns up to 100 latest trades.
 */
export async function fetchTrades(marketId: string) {
  try {
    const result = await spotApi.fetchTrades({ marketId }) as any
    return result.trades ?? result ?? []
  } catch (err) {
    console.error(`[injective] fetchTrades error for ${marketId}:`, err)
    throw err
  }
}

/**
 * Fetch trades across MULTIPLE markets at once.
 * Used to build the whale feed.
 */
export async function fetchTradesMultiMarket(marketIds: string[]) {
  try {
    const result = await spotApi.fetchTrades({ marketIds }) as any
    return result.trades ?? result ?? []
  } catch (err) {
    console.error("[injective] fetchTradesMultiMarket error:", err)
    // Fallback: fetch top 10 markets individually
    const results = await Promise.allSettled(
      marketIds.slice(0, 10).map((id) => fetchTrades(id))
    )
    return results
      .filter((r) => r.status === "fulfilled")
      .flatMap((r) => (r as PromiseFulfilledResult<any[]>).value)
  }
}

// ── MARKET SUMMARY ────────────────────────────────────────────

/**
 * Fetch market + orderbook + trades in one call.
 */
export async function fetchMarketSummary(marketId: string) {
  try {
    const [market, orderbook, trades] = await Promise.all([
      fetchMarket(marketId),
      fetchOrderbook(marketId),
      fetchTrades(marketId),
    ])
    return { market, orderbook, trades }
  } catch (err) {
    console.error(`[injective] fetchMarketSummary error for ${marketId}:`, err)
    throw err
  }
}

// ── UTILS ─────────────────────────────────────────────────────

/**
 * Extract wallet address from an Injective subaccountId.
 * Injective uses EVM hex addresses (0x...) since EVM mainnet launch.
 * Subaccount ID = wallet (42 chars) + nonce suffix.
 */
export function walletFromSubaccount(subaccountId: string): string {
  if (!subaccountId || subaccountId.length < 42) return "unknown"
  return subaccountId.slice(0, 42)
}

/**
 * Convert raw Injective price (string, base units) to float.
 * Injective prices carry an 18-decimal offset adjusted for
 * the difference between base and quote token decimals.
 */
export function normalizePrice(
  rawPrice: string,
  baseDecimals: number = 18,
  quoteDecimals: number = 6
): number {
  if (!rawPrice || rawPrice === "0") return 0
  // The Injective IndexerGrpc SDK partially normalizes prices already.
  // Dividing by 10^(baseDecimals - quoteDecimals) gives correct results
  // for USDT-quoted pairs (INJ/USDT: 18-6=12 works, ATOM/USDT: 6-6=0 works).
  // For same-decimal pairs like NINJA/INJ (both 18), divisor=1 leaves raw
  // chain values which are absurdly large — the sanity cap handles those.
  const decimalDiff = baseDecimals - quoteDecimals
  const divisor = Math.pow(10, decimalDiff)
  const price = parseFloat(rawPrice) / divisor
  // Sanity cap: no realistic spot token trades above $10M/unit.
  // If still absurd, apply full 18-decimal correction.
  if (price > 10_000_000) {
    return parseFloat(rawPrice) / Math.pow(10, 18)
  }
  return price
}

/**
 * Convert raw Injective quantity to float.
 */
export function normalizeQuantity(
  rawQty: string,
  baseDecimals: number = 18
): number {
  if (!rawQty || rawQty === "0") return 0
  return parseFloat(rawQty) / Math.pow(10, baseDecimals)
}

/**
 * Parse human-readable symbol from a denom string.
 * e.g. "factory/inj1.../DOJO" → "DOJO"
 * e.g. "inj" → "INJ"
 */
export function parseSymbol(denom: string, fallback: string = "???"): string {
  if (!denom) return fallback
  if (denom === "inj") return "INJ"
  if (denom.startsWith("factory/")) {
    const parts = denom.split("/")
    return parts[parts.length - 1].toUpperCase()
  }
  if (denom.startsWith("ibc/")) return fallback
  if (denom.startsWith("peggy")) return fallback
  return denom.toUpperCase()
}
