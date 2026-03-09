// app/api/chart/[marketId]/route.ts
import { NextResponse } from "next/server"
import { fetchTrades, fetchMarket, normalizePrice } from "@/lib/injective"

const CHRONOS_BASE = "https://k8s.mainnet.exchange.grpc-web.injective.network"
const cache = new Map<string, { data: any[]; ts: number }>()
const CACHE_TTL = 60_000

export async function GET(
  req: Request,
  { params }: { params: Promise<{ marketId: string }> }
) {
  try {
    const { searchParams } = new URL(req.url)
    const resolution = searchParams.get("resolution") ?? "60"
    const limit      = parseInt(searchParams.get("limit") ?? "200")
    const ticker     = searchParams.get("ticker") ?? ""
    const { marketId } = await params          // ← Next.js 15: must await

    if (!ticker) {
      return NextResponse.json({ error: "ticker param required" }, { status: 400 })
    }

    const cacheKey = `${marketId}:${resolution}`
    const cached   = cache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json({ data: cached.data, cached: true })
    }

    const now        = Math.floor(Date.now() / 1000)
    const resMap: Record<string, string> = {
      "1": "1", "5": "5", "15": "15", "30": "30", "60": "60", "240": "240", "D": "D",
    }
    const res        = resMap[resolution] ?? "60"
    const resSeconds = res === "D" ? 86400 : parseInt(res) * 60
    const from       = now - resSeconds * limit

    // ── Try Chronos first ───────────────────────────────────
    try {
      const url  = `${CHRONOS_BASE}/api/chronos/v1/history?symbol=${encodeURIComponent(ticker)}&resolution=${res}&from=${from}&to=${now}`
      const resp = await fetch(url, { signal: AbortSignal.timeout(6000) })
      if (resp.ok) {
        const raw = await resp.json()
        if (raw.s === "ok" && raw.t?.length > 0) {
          const candles = raw.t.map((time: number, i: number) => ({
            time: time, open: raw.o[i], high: raw.h[i],
            low: raw.l[i], close: raw.c[i], value: raw.v[i],
          }))
          cache.set(cacheKey, { data: candles, ts: Date.now() })
          return NextResponse.json({ data: candles, cached: false, source: "chronos" })
        }
      }
    } catch {
      // Chronos unavailable — fall through to trade-based fallback
    }

    // ── Fallback: build OHLCV from raw trades ───────────────
    // Fetch market decimals + recent trades
    const [market, rawTrades] = await Promise.all([
      fetchMarket(marketId),
      fetchTrades(marketId),
    ])
    const baseDecimals  = market.baseToken?.decimals  ?? 18
    const quoteDecimals = market.quoteToken?.decimals ?? 6

    if (!rawTrades.length) {
      return NextResponse.json({ data: [], cached: false, source: "none" })
    }

    // Bucket trades into candles by resolution
    const bucketMs = resSeconds * 1000
    const buckets  = new Map<number, { o: number; h: number; l: number; c: number; v: number }>()

    for (const t of rawTrades as any[] {
      const ts    = Number(t.executedAt)
      const price = normalizePrice(t.price, baseDecimals, quoteDecimals)
      if (price <= 0) continue
      const qty   = parseFloat(t.quantity) / Math.pow(10, baseDecimals)
      const bucket = Math.floor(ts / bucketMs) * bucketMs

      if (!buckets.has(bucket)) {
        buckets.set(bucket, { o: price, h: price, l: price, c: price, v: qty })
      } else {
        const b = buckets.get(bucket)!
        b.h = Math.max(b.h, price)
        b.l = Math.min(b.l, price)
        b.c = price
        b.v += qty
      }
    }

    const candles = Array.from(buckets.entries())
      .sort(([a], [b]) => a - b)
      .map(([ts, b]: [number, any]) => ({
        time:  Math.floor(ts / 1000),
        open:  b.o, high: b.h, low: b.l, close: b.c, value: b.v,
      }))

    cache.set(cacheKey, { data: candles, ts: Date.now() })
    return NextResponse.json({ data: candles, cached: false, source: "trades" })

  } catch (err: any) {
    console.error("[/api/chart] error:", err?.message)
    return NextResponse.json({ data: [], error: err?.message ?? "Chart unavailable" })
  }
}