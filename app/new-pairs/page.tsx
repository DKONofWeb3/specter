// app/new-pairs/page.tsx
"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { fPrice, fUsd, riskColor } from "@/lib/format"
import type { NewPair } from "@/app/api/new-pairs/route"

function timeAgo(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 60)                      return `${s}s ago`
  if (s < 3600)                    return `${Math.floor(s / 60)}m ago`
  if (s < 86400)                   return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function tokenColor(sym: string): string {
  const c = ["#0B5CFF","#3a7fff","#00c27a","#38bdf8","#f03e5e","#f5b731","#fb923c","#a78bfa","#10b981","#6366f1"]
  let h = 0; for (let i = 0; i < sym.length; i++) h = sym.charCodeAt(i) + ((h << 5) - h)
  return c[Math.abs(h) % c.length]
}

type SortKey = "listing" | "change" | "volume" | "risk"

export default function NewPairsPage() {
  const router  = useRouter()
  const [pairs,   setPairs]   = useState<NewPair[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [sort,    setSort]    = useState<SortKey>("listing")
  const [lastUpd, setLastUpd] = useState<Date | null>(null)

  const fetchPairs = useCallback(async () => {
    try {
      const res  = await fetch("/api/new-pairs")
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setPairs(json.data ?? [])
      setLastUpd(new Date())
      setError(null)
    } catch (e: any) {
      setError(e.message ?? "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPairs()
    const id = setInterval(fetchPairs, 120_000) // refresh every 2 min
    return () => clearInterval(id)
  }, [fetchPairs])

  const sorted = [...pairs].sort((a, b) => {
    if (sort === "listing") return b.listingTimestamp - a.listingTimestamp
    if (sort === "change")  return b.priceChangeTotal - a.priceChangeTotal
    if (sort === "volume")  return b.volume24h - a.volume24h
    return b.riskScore - a.riskScore
  })

  const SORT_OPTS: { key: SortKey; label: string }[] = [
    { key: "listing", label: "Newest First" },
    { key: "change",  label: "Biggest Gain" },
    { key: "volume",  label: "Most Volume" },
    { key: "risk",    label: "Highest Risk" },
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 52px)", overflow: "hidden" }}>

      {/* ── HEADER ───────────────────────────────────────────── */}
      <div style={{
        padding: "14px 20px", borderBottom: "1px solid var(--b1)",
        background: "var(--s1)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                background: "var(--g)", boxShadow: "0 0 8px var(--g)",
                animation: "pulse 2s ease-in-out infinite",
              }} />
              <span style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>New Pairs</span>
              {!loading && (
                <span style={{
                  fontSize: 11, color: "var(--g)", fontFamily: "var(--mono)",
                  background: "rgba(0,194,122,.1)", border: "1px solid rgba(0,194,122,.2)",
                  borderRadius: 20, padding: "2px 10px",
                }}>
                  {pairs.length} listed
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4, lineHeight: 1.5 }}>
              Spot markets recently launched on Injective — detected from first on-chain trade.
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {lastUpd && (
              <span style={{ fontSize: 10, color: "var(--t3)", fontFamily: "var(--mono)" }}>
                Updated {lastUpd.toLocaleTimeString()}
              </span>
            )}
            <button onClick={fetchPairs} className="btn-ghost" style={{ fontSize: 10, padding: "4px 12px" }}>
              Refresh
            </button>
          </div>
        </div>

        {/* Sort chips */}
        <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: "var(--t3)", alignSelf: "center", marginRight: 4 }}>SORT</span>
          {SORT_OPTS.map((o) => (
            <button key={o.key} onClick={() => setSort(o.key)} style={{
              padding: "4px 12px", borderRadius: 20, fontSize: 11,
              background: sort === o.key ? "var(--inj-dim)" : "var(--s2)",
              border:     sort === o.key ? "1px solid var(--inj-bdr)" : "1px solid var(--b1)",
              color:      sort === o.key ? "#7aabff" : "var(--t2)",
              cursor: "pointer", transition: "all .12s", fontFamily: "var(--font)",
            }}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── BODY ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto" }}>

        {/* Column headers */}
        {!loading && !error && sorted.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "2fr 120px 110px 110px 100px 80px 80px",
            padding: "7px 20px", fontSize: 9, color: "var(--t3)",
            letterSpacing: ".14em", borderBottom: "1px solid var(--b1)",
            fontFamily: "var(--mono)", position: "sticky", top: 0,
            background: "var(--bg)", zIndex: 2,
          }}>
            <span>PAIR</span>
            <span style={{ textAlign: "right" }}>CURRENT PRICE</span>
            <span style={{ textAlign: "right" }}>SINCE LISTING</span>
            <span style={{ textAlign: "right" }}>24H CHANGE</span>
            <span style={{ textAlign: "right" }}>24H VOLUME</span>
            <span style={{ textAlign: "right" }}>RISK</span>
            <span style={{ textAlign: "right" }}>LISTED</span>
          </div>
        )}

        {loading && (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="skeleton" style={{ height: 64, borderRadius: 8 }} />
            ))}
          </div>
        )}

        {error && (
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: "60px 20px", gap: 10,
          }}>
            <div style={{ fontSize: 13, color: "var(--r)" }}>{error}</div>
            <button onClick={fetchPairs} className="btn-ghost" style={{ fontSize: 11 }}>Retry</button>
          </div>
        )}

        {!loading && !error && sorted.length === 0 && (
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: "80px 20px", gap: 8, color: "var(--t3)",
          }}>
            <div style={{ fontSize: 13 }}>No new pairs found in the last 30 days.</div>
            <div style={{ fontSize: 11 }}>All active Injective spot markets appear to be established.</div>
          </div>
        )}

        {sorted.map((pair, i) => {
          const col     = tokenColor(pair.baseSymbol)
          const gainPos = pair.priceChangeTotal >= 0
          const dayPos  = pair.priceChange24h  >= 0
          const rc      = riskColor(pair.riskScore)
          const rlbl    = pair.riskLabel

          return (
            <div
              key={pair.marketId}
              onClick={() => router.push(`/token/${encodeURIComponent(pair.marketId)}`)}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 120px 110px 110px 100px 80px 80px",
                padding: "12px 20px",
                borderBottom: "1px solid rgba(255,255,255,.028)",
                cursor: "pointer", transition: "background .08s", alignItems: "center",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(11,92,255,.04)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              {/* Token identity */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {/* Rank */}
                <span style={{ fontSize: 11, color: "var(--t3)", fontFamily: "var(--mono)", width: 20, flexShrink: 0 }}>
                  {i + 1}
                </span>

                {/* Avatar */}
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: `${col}20`, color: col, border: `1.5px solid ${col}35`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 15, fontWeight: 800,
                }}>
                  {pair.baseSymbol[0]}
                </div>

                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{pair.baseSymbol}</span>
                    <span style={{ fontSize: 11, color: "var(--t3)", fontFamily: "var(--mono)" }}>/ {pair.quoteSymbol}</span>
                    {pair.isWhaleActive && (
                      <span className="bdg bdg-whale">WHALE</span>
                    )}
                    {/* NEW badge — extra emphasis here */}
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 3,
                      letterSpacing: ".08em", fontFamily: "var(--mono)",
                      background: "rgba(0,194,122,.15)", color: "var(--g)",
                      border: "1px solid rgba(0,194,122,.25)",
                    }}>NEW</span>
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 3, alignItems: "center" }}>
                    <span style={{ fontSize: 10, color: "var(--t3)", fontFamily: "var(--mono)" }}>
                      Listed at {fPrice(pair.listingPrice)}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--t3)" }}>·</span>
                    <span style={{ fontSize: 10, color: "var(--t3)", fontFamily: "var(--mono)" }}>
                      {pair.tradeCount} trades
                    </span>
                  </div>
                </div>
              </div>

              {/* Current price */}
              <div style={{ textAlign: "right", fontSize: 13, fontWeight: 600, fontFamily: "var(--mono)", color: "var(--t1)" }}>
                {fPrice(pair.price)}
              </div>

              {/* Since listing change */}
              <div style={{
                textAlign: "right", fontSize: 13, fontWeight: 700, fontFamily: "var(--mono)",
                color: gainPos ? "var(--g)" : "var(--r)",
              }}>
                {gainPos ? "+" : ""}{pair.priceChangeTotal.toFixed(2)}%
              </div>

              {/* 24h change */}
              <div style={{
                textAlign: "right", fontSize: 12, fontWeight: 600, fontFamily: "var(--mono)",
                color: dayPos ? "var(--g)" : "var(--r)",
              }}>
                {dayPos ? "+" : ""}{pair.priceChange24h.toFixed(2)}%
              </div>

              {/* Volume */}
              <div style={{ textAlign: "right", fontSize: 12, fontFamily: "var(--mono)", color: "var(--t2)" }}>
                {fUsd(pair.volume24h)}
              </div>

              {/* Risk */}
              <div style={{ textAlign: "right", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: rc, fontFamily: "var(--mono)" }}>
                  {pair.riskScore}
                </span>
                <span className={`bdg bdg-${rlbl.toLowerCase()}`} style={{ fontSize: 8 }}>{rlbl}</span>
              </div>

              {/* Listed time */}
              <div style={{
                textAlign: "right", fontSize: 11, color: "var(--t3)", fontFamily: "var(--mono)",
              }}>
                {timeAgo(pair.listingTimestamp)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Status bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "4px 20px", flexShrink: 0,
        background: "var(--s1)", borderTop: "1px solid var(--b1)",
        fontSize: 10, color: "var(--t3)", fontFamily: "var(--mono)",
      }}>
        <span>Detecting markets with first trade in last 30 days · Injective Mainnet</span>
        <span>Auto-refresh 2min</span>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: .4; }
        }
      `}</style>
    </div>
  )
}