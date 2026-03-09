// components/TradesFeed.tsx
"use client"

import { useEffect, useState, useCallback } from "react"
import type { Trade } from "@/lib/types"
import { fPrice, fUsd, fWallet, fTimeAgo } from "@/lib/format"

export default function TradesFeed({ marketId }: { marketId: string }) {
  const [trades, setTrades]   = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)

  const fetch_ = useCallback(async () => {
    try {
      const res  = await fetch(`/api/trades/${encodeURIComponent(marketId)}`)
      const json = await res.json()
      if (json.data) setTrades(json.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [marketId])

  useEffect(() => {
    fetch_()
    const id = setInterval(fetch_, 8000)
    return () => clearInterval(id)
  }, [fetch_])

  if (loading) return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 5 }}>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 38, borderRadius: 5 }} />
      ))}
    </div>
  )

  if (trades.length === 0) return (
    <div style={{ padding: 24, textAlign: "center", color: "var(--t3)", fontSize: 12 }}>
      No recent trades
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{
        display: "grid", gridTemplateColumns: "48px 1fr 76px 66px 52px",
        padding: "6px 12px",
        fontSize: 9, color: "var(--t3)", letterSpacing: ".12em",
        borderBottom: "1px solid var(--b1)", fontFamily: "var(--mono)",
      }}>
        <span>SIDE</span>
        <span>WALLET</span>
        <span style={{ textAlign: "right" }}>PRICE</span>
        <span style={{ textAlign: "right" }}>VALUE</span>
        <span style={{ textAlign: "right" }}>TIME</span>
      </div>

      {trades.slice(0, 50).map((t) => (
        <div key={t.tradeId} style={{
          display: "grid", gridTemplateColumns: "48px 1fr 76px 66px 52px",
          padding: "6px 12px",
          borderBottom: "1px solid rgba(255,255,255,.022)",
          alignItems: "center",
          background: t.isWhale ? "rgba(245,183,49,.03)" : "transparent",
          transition: "background .08s",
        }}>
          <div>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 3,
              letterSpacing: ".05em", fontFamily: "var(--mono)", display: "inline-block",
              background: t.side === "buy" ? "rgba(0,194,122,.15)" : "rgba(240,62,94,.15)",
              color: t.side === "buy" ? "var(--g)" : "var(--r)",
            }}>
              {t.side.toUpperCase()}
            </span>
          </div>

          <div>
            <div style={{
              fontSize: 11, color: t.isWhale ? "var(--y)" : "var(--t2)",
              fontFamily: "var(--mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {fWallet(t.walletAddress)}
            </div>
            {t.isWhale && (
              <div style={{ fontSize: 8, color: "var(--y)", fontFamily: "var(--mono)", letterSpacing: ".06em" }}>
                WHALE TX
              </div>
            )}
          </div>

          <div style={{
            fontSize: 12, fontWeight: 600, textAlign: "right", fontFamily: "var(--mono)",
            color: t.side === "buy" ? "var(--g)" : "var(--r)",
          }}>
            {fPrice(t.price)}
          </div>

          <div style={{
            fontSize: 11, textAlign: "right", fontFamily: "var(--mono)",
            color: t.isWhale ? "var(--y)" : "var(--t2)",
            fontWeight: t.isWhale ? 700 : 400,
          }}>
            {fUsd(t.valueUsd)}
          </div>

          <div style={{ fontSize: 10, textAlign: "right", color: "var(--t3)", fontFamily: "var(--mono)" }}>
            {fTimeAgo(t.executedAt)}
          </div>
        </div>
      ))}
    </div>
  )
}
