// components/Orderbook.tsx
"use client"

import { useEffect, useState, useCallback } from "react"
import type { Orderbook as OBType } from "@/lib/types"
import { fPrice, fUsd } from "@/lib/format"

export default function Orderbook({ marketId, ticker }: { marketId: string; ticker: string }) {
  const [ob, setOb]         = useState<OBType | null>(null)
  const [loading, setLoading] = useState(true)

  const fetch_ = useCallback(async () => {
    try {
      const res  = await fetch(`/api/orderbook/${encodeURIComponent(marketId)}`)
      const json = await res.json()
      if (json.data) setOb(json.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [marketId])

  useEffect(() => {
    fetch_()
    const id = setInterval(fetch_, 5000)
    return () => clearInterval(id)
  }, [fetch_])

  if (loading) return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 5 }}>
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 20, borderRadius: 3 }} />
      ))}
    </div>
  )

  if (!ob) return (
    <div style={{ padding: 24, textAlign: "center", color: "var(--t3)", fontSize: 12 }}>
      No orderbook data
    </div>
  )

  const maxSize = Math.max(...ob.asks.map((l) => l.totalUsd), ...ob.bids.map((l) => l.totalUsd), 1)

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Column headers */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
        padding: "6px 12px",
        fontSize: 9, color: "var(--t3)", letterSpacing: ".12em",
        borderBottom: "1px solid var(--b1)", fontFamily: "var(--mono)",
        flexShrink: 0,
      }}>
        <span>PRICE</span>
        <span style={{ textAlign: "center" }}>SIZE</span>
        <span style={{ textAlign: "right" }}>TOTAL</span>
      </div>

      {/* Asks */}
      <div style={{ overflowY: "auto", flex: 1 }}>
        {ob.asks.slice(0, 10).slice().reverse().map((level, i) => (
          <div key={i} className="ob-row">
            <div className="ob-bg" style={{ width: `${(level.totalUsd / maxSize) * 58}%`, background: "var(--r)" }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--r)", zIndex: 1, fontFamily: "var(--mono)" }}>
              {fPrice(level.price)}
            </span>
            <span style={{ fontSize: 11, color: "var(--t2)", textAlign: "center", zIndex: 1, fontFamily: "var(--mono)" }}>
              {level.quantity.toFixed(2)}
            </span>
            <span style={{ fontSize: 11, color: "var(--t3)", textAlign: "right", zIndex: 1, fontFamily: "var(--mono)" }}>
              {fUsd(level.totalUsd)}
            </span>
          </div>
        ))}
      </div>

      {/* Spread */}
      <div style={{
        padding: "6px 12px",
        background: "var(--s3)", borderTop: "1px solid var(--b1)", borderBottom: "1px solid var(--b1)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 9, color: "var(--t3)", letterSpacing: ".1em", fontFamily: "var(--mono)" }}>SPREAD</span>
        <span style={{ fontSize: 12, color: "var(--y)", fontWeight: 600, fontFamily: "var(--mono)" }}>
          {fPrice(ob.spread)} · {ob.spreadPct.toFixed(3)}%
        </span>
        <span style={{ fontSize: 11, color: "var(--t2)", fontFamily: "var(--mono)" }}>{fPrice(ob.midPrice)}</span>
      </div>

      {/* Bids */}
      <div style={{ overflowY: "auto", flex: 1 }}>
        {ob.bids.slice(0, 10).map((level, i) => (
          <div key={i} className="ob-row">
            <div className="ob-bg" style={{ width: `${(level.totalUsd / maxSize) * 58}%`, background: "var(--g)" }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--g)", zIndex: 1, fontFamily: "var(--mono)" }}>
              {fPrice(level.price)}
            </span>
            <span style={{ fontSize: 11, color: "var(--t2)", textAlign: "center", zIndex: 1, fontFamily: "var(--mono)" }}>
              {level.quantity.toFixed(2)}
            </span>
            <span style={{ fontSize: 11, color: "var(--t3)", textAlign: "right", zIndex: 1, fontFamily: "var(--mono)" }}>
              {fUsd(level.totalUsd)}
            </span>
          </div>
        ))}
      </div>

      {/* Depth */}
      <div style={{ padding: "10px 12px", borderTop: "1px solid var(--b1)", flexShrink: 0 }}>
        <div style={{ fontSize: 9, color: "var(--t3)", letterSpacing: ".13em", fontFamily: "var(--mono)", marginBottom: 6 }}>
          DEPTH RATIO
        </div>
        <div style={{ height: 5, borderRadius: 4, overflow: "hidden", display: "flex" }}>
          <div style={{ width: `${ob.depthRatioBid}%`, background: "linear-gradient(to right, var(--g), rgba(0,194,122,.35))" }} />
          <div style={{ flex: 1, background: "linear-gradient(to left, var(--r), rgba(240,62,94,.35))" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 10, fontFamily: "var(--mono)" }}>
          <span style={{ color: "var(--g)" }}>BID {ob.depthRatioBid.toFixed(0)}%</span>
          <span style={{ color: "var(--r)" }}>ASK {(100 - ob.depthRatioBid).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  )
}
