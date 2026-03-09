// ─────────────────────────────────────────────────────────────
//  SPECTER · lib/types.ts
//  All shared TypeScript types across the app
// ─────────────────────────────────────────────────────────────

export interface SpectерToken {
  marketId: string
  ticker: string          // e.g. "INJ/USDT"
  baseDenom: string       // e.g. "inj"
  quoteDenom: string      // e.g. "peggy0xdAC17F..."
  baseSymbol: string      // e.g. "INJ"
  quoteSymbol: string     // e.g. "USDT"
  price: number
  priceChange24h: number  // percentage
  volume24h: number       // in USD
  liquidity: number       // in USD (best bid × best ask depth)
  marketStatus: string    // "active" | "paused" | "demolished"
  // calculated fields
  riskScore: number       // 0–100
  riskLabel: "SAFE" | "LOW" | "MED" | "HIGH"
  isNew: boolean          // listed within last 7 days
  isWhaleActive: boolean  // whale tx in last 1h
  isTrending: boolean     // volume spike > 200% vs 24h avg
  makerFee: string
  takerFee: string
}

export interface OrderbookLevel {
  price: number
  quantity: number
  totalUsd: number
}

export interface Orderbook {
  marketId: string
  ticker: string
  asks: OrderbookLevel[]
  bids: OrderbookLevel[]
  spread: number          // absolute
  spreadPct: number       // percentage
  midPrice: number
  bidDepthUsd: number     // total USD value of bids
  askDepthUsd: number     // total USD value of asks
  depthRatioBid: number   // 0–100 (% of total depth that is bids)
}

export interface Trade {
  tradeId: string
  marketId: string
  ticker: string
  price: number
  quantity: number
  valueUsd: number
  side: "buy" | "sell"
  executedAt: number      // unix ms
  subaccountId: string    // trader subaccount (use as wallet proxy)
  walletAddress: string   // derived from subaccountId
  isWhale: boolean        // valueUsd > WHALE_THRESHOLD
  tradeType: "limit" | "market"
}

export interface WhaleTx {
  tradeId: string
  marketId: string
  ticker: string
  walletAddress: string
  side: "buy" | "sell"
  valueUsd: number
  price: number
  quantity: number
  executedAt: number
  riskScore: number       // risk score of the token at time of trade
}

export interface TraderStats {
  walletAddress: string
  tradeCount: number
  totalVolumeUsd: number
  totalBuys: number
  totalSells: number
  winRate: number         // % of profitable closes (approx)
  estimatedPnlUsd: number // rough: sell volume - buy volume
  topToken: string        // ticker they trade most
  lastActive: number      // unix ms
}

export interface RiskBreakdown {
  score: number
  label: "SAFE" | "LOW" | "MED" | "HIGH"
  factors: {
    spreadScore: number       // 0–25: wide spread = risky
    liquidityScore: number    // 0–30: low liquidity = risky
    ageScore: number          // 0–25: new token = risky
    whaleScore: number        // 0–20: whale activity = risky
  }
  explanation: string
}

export interface ApiResponse<T> {
  data: T
  timestamp: number
  cached?: boolean
}

export interface ApiError {
  error: string
  code: number
}
