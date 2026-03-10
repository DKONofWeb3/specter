// components/StatsBar.tsx
"use client"

import type { SpectерToken } from "@/lib/types"
import { fUsd, fPrice } from "@/lib/format"

export default function StatsBar({ tokens }: { tokens: SpectерToken[] }) {
  const totalVol    = tokens.reduce((s, t) => s + t.volume24h, 0)
  const whaleCount  = tokens.filter((t) => t.isWhaleActive).length
  const highRisk    = tokens.filter((t) => t.riskScore >= 75).length
  const injToken    = tokens.find((t) => t.baseSymbol === "INJ")
  const newCount    = tokens.filter((t) => t.isNew).length

  const stats = [
    { label: "24H VOLUME",     val: fUsd(totalVol),             sub: "across all markets",  subc: "var(--t3)" },
    { label: "TOKENS TRACKED", val: tokens.length.toString(),   sub: `${newCount} new today`,  subc: "var(--bl)" },
    { label: "WHALE ALERTS",   val: whaleCount.toString(),      sub: "active last hour",    subc: whaleCount > 0 ? "var(--y)" : "var(--t3)" },
    { label: "HIGH RISK",      val: highRisk.toString(),        sub: "flagged tokens",      subc: highRisk > 0 ? "var(--r)" : "var(--t3)" },
    {
      label: "INJ PRICE",
      val: injToken ? fPrice(injToken.price) : "—",
      sub: injToken
        ? `${injToken.priceChange24h >= 0 ? "+" : ""}${injToken.priceChange24h.toFixed(2)}% (24h)`
        : "loading",
      subc: injToken
        ? injToken.priceChange24h >= 0 ? "var(--g)" : "var(--r)"
        : "var(--t3)",
    },
  ]

  return (
    <div style={{
      display: "flex", flexShrink: 0,
      background: "var(--s1)", borderBottom: "1px solid var(--b1)",
      overflowX: "auto",
    }}>
      {stats.map((s, i) => (
        <div key={i} style={{
          flex: 1, minWidth: 120,
          padding: "9px 18px",
          borderRight: i < stats.length - 1 ? "1px solid var(--b1)" : "none",
        }}>
          <div style={{ fontSize: 9, color: "var(--t3)", letterSpacing: ".15em", fontFamily: "var(--mono)" }}>
            {s.label}
          </div>
          {tokens.length === 0 ? (
            <div className="skeleton" style={{ width: 72, height: 16, margin: "4px 0 3px" }} />
          ) : (
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)", margin: "2px 0 1px" }}>
              {s.val}
            </div>
          )}
          <div style={{ fontSize: 10, color: s.subc }}>{s.sub}</div>
        </div>
      ))}
    </div>
  )
}
