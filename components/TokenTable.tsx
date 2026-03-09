// components/TokenTable.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { SpectерToken } from "@/lib/types"
import { fPrice, fUsd, riskColor } from "@/lib/format"
import type { FilterType } from "./FilterBar"

type SortKey = "price" | "priceChange24h" | "volume24h" | "liquidity" | "riskScore"
type SortDir = "asc" | "desc"

interface Props {
  tokens: SpectерToken[]
  filter: FilterType
  search: string
  loading: boolean
  selected: string
  onSelect: (marketId: string) => void
}

function tokenColor(sym: string): string {
  const colors = ["#0B5CFF","#3a7fff","#00c27a","#38bdf8","#f03e5e","#f5b731","#fb923c","#a78bfa","#10b981","#6366f1"]
  let hash = 0
  for (let i = 0; i < sym.length; i++) hash = sym.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function SparkSVG({ pct }: { pct: number }) {
  const up  = pct >= 0
  const col = up ? "#00c27a" : "#f03e5e"
  const W = 68, H = 26, steps = 16
  const pts: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const noise  = (Math.random() - 0.5) * H * 0.28
    const trend  = up ? -(i / steps) * H * 0.42 : (i / steps) * H * 0.42
    const base   = up ? H * 0.68 : H * 0.3
    const y      = Math.max(2, Math.min(H - 2, base + trend + noise))
    pts.push([i / steps * W, y])
  }
  let line = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) {
    const cx = pts[i-1][0] + (pts[i][0] - pts[i-1][0]) * 0.5
    line += ` C${cx},${pts[i-1][1]} ${cx},${pts[i][1]} ${pts[i][0]},${pts[i][1]}`
  }
  const last = pts[pts.length - 1]
  const area = line + ` L${last[0]},${H} L0,${H} Z`
  const gid  = `sg${Math.random().toString(36).slice(2, 8)}`
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={col} stopOpacity={0.28} />
          <stop offset="100%" stopColor={col} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={col} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const COLS: { key: SortKey | null; label: string }[] = [
  { key: null,            label: "# TOKEN" },
  { key: "price",         label: "PRICE" },
  { key: "priceChange24h",label: "24H %" },
  { key: "volume24h",     label: "VOLUME" },
  { key: "liquidity",     label: "LIQUIDITY" },
  { key: "riskScore",     label: "RISK" },
  { key: null,            label: "7D CHART" },
]

export default function TokenTable({ tokens, filter, search, loading, selected, onSelect }: Props) {
  const router = useRouter()
  const [sk, setSk] = useState<SortKey>("volume24h")
  const [sd, setSd] = useState<SortDir>("desc")

  function handleSort(key: SortKey) {
    if (sk === key) setSd((d) => d === "desc" ? "asc" : "desc")
    else { setSk(key); setSd("desc") }
  }

  const filtered = tokens.filter((t) => {
    const fok = filter === "all" ? true : filter === "new" ? t.isNew : filter === "whale" ? t.isWhaleActive : filter === "hot" ? t.isTrending : t.riskScore >= 75
    const sok = !search || t.baseSymbol.toLowerCase().includes(search.toLowerCase()) || t.ticker.toLowerCase().includes(search.toLowerCase())
    return fok && sok
  })

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sk] as number, bv = b[sk] as number
    return sd === "desc" ? bv - av : av - bv
  })

  if (loading) return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 50, borderRadius: 6 }} />
      ))}
    </div>
  )

  if (sorted.length === 0) return (
    <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--t3)", fontSize: 12 }}>
      No tokens match your filter.
    </div>
  )

  return (
    <table className="specter-table">
      <thead>
        <tr>
          {COLS.map((col, i) => (
            <th
              key={i}
              className={col.key && sk === col.key ? "sorted" : ""}
              onClick={() => col.key && handleSort(col.key)}
              style={{ cursor: col.key ? "pointer" : "default" }}
            >
              {col.label}
              {col.key && sk === col.key && (
                <span style={{ marginLeft: 4 }}>{sd === "desc" ? "↓" : "↑"}</span>
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((t, i) => {
          const up  = t.priceChange24h >= 0
          const rc  = riskColor(t.riskScore)
          const col = tokenColor(t.baseSymbol)
          const sel = t.marketId === selected
          return (
            <tr
              key={t.marketId}
              className={sel ? "active" : ""}
              onClick={() => {
                onSelect(t.marketId)
                // on mobile, navigate to full token page
                if (window.innerWidth < 1024) router.push(`/token/${encodeURIComponent(t.marketId)}`)
              }}
            >
              <td>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ fontSize: 10, color: "var(--t3)", minWidth: 14, fontFamily: "var(--mono)" }}>{i + 1}</span>
                  <div style={{
                    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                    background: `${col}20`, color: col, border: `1px solid ${col}35`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 800,
                  }}>
                    {t.baseSymbol[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", display: "flex", alignItems: "center", gap: 4 }}>
                      {t.baseSymbol}
                      {t.isNew        && <span className="bdg bdg-new">NEW</span>}
                      {t.isWhaleActive && <span className="bdg bdg-whale">WHALE</span>}
                      {t.isTrending   && <span className="bdg bdg-hot">HOT</span>}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 1, fontFamily: "var(--mono)" }}>{t.ticker}</div>
                  </div>
                </div>
              </td>
              <td style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", fontFamily: "var(--mono)" }}>
                {fPrice(t.price)}
              </td>
              <td style={{ fontSize: 12, fontWeight: 600, color: up ? "var(--g)" : "var(--r)", fontFamily: "var(--mono)" }}>
                {up ? "+" : ""}{(t.priceChange24h ?? 0).toFixed(2)}%
              </td>
              <td style={{ fontSize: 12, color: "var(--t2)", fontFamily: "var(--mono)" }}>{fUsd(t.volume24h)}</td>
              <td style={{ fontSize: 12, color: "var(--t2)", fontFamily: "var(--mono)" }}>{fUsd(t.liquidity)}</td>
              <td>
                <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                  <div className="risk-track">
                    <div className="risk-fill" style={{ width: `${t.riskScore}%`, background: rc }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: rc, minWidth: 18, textAlign: "right", fontFamily: "var(--mono)" }}>
                    {t.riskScore}
                  </span>
                </div>
              </td>
              <td style={{ textAlign: "right" }}><SparkSVG pct={t.priceChange24h} /></td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}