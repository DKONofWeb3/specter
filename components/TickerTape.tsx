// components/TickerTape.tsx
"use client"

import type { SpectерToken } from "@/lib/types"
import { fPrice } from "@/lib/format"

export default function TickerTape({ tokens }: { tokens: SpectерToken[] }) {
  if (tokens.length === 0) {
    return (
      <div style={{
        height: 28, background: "var(--s1)",
        borderBottom: "1px solid var(--b1)",
        display: "flex", alignItems: "center", padding: "0 16px",
      }}>
        <div className="skeleton" style={{ width: "50%", height: 8 }} />
      </div>
    )
  }

  const items = [...tokens, ...tokens, ...tokens]

  return (
    <div style={{
      height: 28, overflow: "hidden", flexShrink: 0,
      background: "var(--s1)", borderBottom: "1px solid var(--b1)",
      position: "relative",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, bottom: 0, width: 60, zIndex: 2,
        background: "linear-gradient(to right, var(--s1), transparent)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", top: 0, right: 0, bottom: 0, width: 60, zIndex: 2,
        background: "linear-gradient(to left, var(--s1), transparent)",
        pointerEvents: "none",
      }} />
      <div style={{
        display: "flex", alignItems: "center", height: "100%",
        whiteSpace: "nowrap",
        animation: "ticker 60s linear infinite",
      }}>
        {items.map((t, i) => {
          const up = t.priceChange24h >= 0
          return (
            <div key={`${t.marketId}-${i}`} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "0 18px", borderRight: "1px solid var(--b1)",
              fontFamily: "var(--mono)", fontSize: 11,
            }}>
              <span style={{ color: "var(--t3)" }}>{t.ticker}</span>
              <span style={{ color: "var(--t1)", fontWeight: 500 }}>{fPrice(t.price)}</span>
              <span style={{ color: up ? "var(--g)" : "var(--r)", fontWeight: 600 }}>
                {up ? "+" : ""}{(t.priceChange24h ?? 0).toFixed(2)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}