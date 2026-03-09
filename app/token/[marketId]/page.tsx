// app/token/[marketId]/page.tsx
"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import type { SpectерToken, TraderStats } from "@/lib/types"
import { fPrice, fUsd, fWallet, fTimeAgo, riskColor } from "@/lib/format"
import Orderbook  from "@/components/Orderbook"
import TradesFeed from "@/components/TradesFeed"

// Chart loads client-only (lightweight-charts touches DOM)
const PriceChart = dynamic(() => import("@/components/PriceChart"), {
  ssr: false,
  loading: () => (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100%", color: "var(--t3)", fontSize: 11, fontFamily: "var(--mono)",
    }}>
      Loading chart…
    </div>
  ),
})

type Tab = "chart" | "orderbook" | "trades" | "traders"

function tokenColor(sym: string): string {
  const c = ["#0B5CFF","#3a7fff","#00c27a","#38bdf8","#f03e5e","#f5b731","#fb923c","#a78bfa","#10b981","#6366f1"]
  let h = 0; for (let i = 0; i < sym.length; i++) h = sym.charCodeAt(i) + ((h << 5) - h)
  return c[Math.abs(h) % c.length]
}

export default function TokenPage() {
  const params   = useParams()
  const router   = useRouter()
  const marketId = decodeURIComponent(params.marketId as string)

  const [token,   setToken]   = useState<SpectерToken | null>(null)
  const [traders, setTraders] = useState<TraderStats[]>([])
  const [tab,     setTab]     = useState<Tab>("chart")
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const fetchToken = useCallback(async () => {
    try {
      const res  = await fetch("/api/markets")
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const found = (json.data as SpectерToken[])?.find((t) => t.marketId === marketId)
      if (found) { setToken(found); setError(null) }
      else setError("Market not found")
    } catch (e: any) {
      setError(e.message ?? "Failed to load market")
    } finally { setLoading(false) }
  }, [marketId])

  const fetchTraders = useCallback(async () => {
    try {
      const res  = await fetch("/api/traders")
      const json = await res.json()
      setTraders((json.data as TraderStats[])?.slice(0, 30) ?? [])
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => {
    fetchToken(); fetchTraders()
    const id = setInterval(fetchToken, 30_000)
    return () => clearInterval(id)
  }, [fetchToken, fetchTraders])

  // ── Loading ─────────────────────────────────────────────────
  if (loading) return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div className="skeleton" style={{ width: 38, height: 38, borderRadius: 9 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div className="skeleton" style={{ width: 120, height: 18 }} />
          <div className="skeleton" style={{ width: 80, height: 12 }} />
        </div>
      </div>
      <div className="skeleton" style={{ width: 200, height: 38 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 64 }} />)}
      </div>
      <div className="skeleton" style={{ height: 420, borderRadius: 8 }} />
    </div>
  )

  // ── Error ───────────────────────────────────────────────────
  if (error || !token) return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      height: "calc(100vh - 52px)", gap: 12,
    }}>
      <div style={{ fontSize: 13, color: "var(--r)" }}>{error ?? "Token not found"}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn-ghost" onClick={() => { setError(null); setLoading(true); fetchToken() }}>
          Retry
        </button>
        <button className="btn-primary" onClick={() => router.push("/")}>
          Back to Discover
        </button>
      </div>
    </div>
  )

  const up  = token.priceChange24h >= 0
  const rc  = riskColor(token.riskScore)
  const rlbl = token.riskScore >= 75 ? "HIGH" : token.riskScore >= 50 ? "MED" : token.riskScore >= 25 ? "LOW" : "SAFE"
  const col  = tokenColor(token.baseSymbol)

  const TABS: { key: Tab; label: string }[] = [
    { key: "chart",     label: "Chart" },
    { key: "orderbook", label: "Orderbook" },
    { key: "trades",    label: "Trades" },
    { key: "traders",   label: "Traders" },
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 52px)", overflow: "hidden" }}>

      {/* ── TOP STRIP: identity + price + stats ─────────────── */}
      <div style={{
        padding: "12px 20px", borderBottom: "1px solid var(--b1)",
        background: "var(--s1)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>

          {/* Left: token identity */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => router.push("/")} className="btn-ghost" style={{ fontSize: 11 }}>
              Back
            </button>
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: `${col}20`, color: col, border: `1.5px solid ${col}40`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 800,
            }}>
              {token.baseSymbol[0]}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{token.baseSymbol}</span>
                <span style={{ fontSize: 12, color: "var(--t3)", fontFamily: "var(--mono)" }}>/ {token.quoteSymbol}</span>
                {token.isNew         && <span className="bdg bdg-new">NEW</span>}
                {token.isWhaleActive && <span className="bdg bdg-whale">WHALE</span>}
                {token.isTrending    && <span className="bdg bdg-hot">HOT</span>}
              </div>
              <div style={{ fontSize: 10, color: "var(--t3)", fontFamily: "var(--mono)", marginTop: 2 }}>
                {token.pair} · Injective Spot
              </div>
            </div>
          </div>

          {/* Right: price */}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--mono)", color: up ? "var(--g)" : "var(--r)" }}>
              {fPrice(token.price)}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--mono)", color: up ? "var(--g)" : "var(--r)", marginTop: 1 }}>
              {up ? "+" : ""}{token.priceChange24h.toFixed(2)}% (24h)
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 0, marginTop: 12, overflowX: "auto" }}>
          {[
            { l: "24H VOLUME",  v: fUsd(token.volume24h),  vc: "var(--t1)" },
            { l: "LIQUIDITY",   v: fUsd(token.liquidity),   vc: "var(--t1)" },
            { l: "MAKER FEE",   v: (parseFloat(token.makerFee) * 100).toFixed(3) + "%", vc: "var(--t2)" },
            { l: "TAKER FEE",   v: (parseFloat(token.takerFee) * 100).toFixed(3) + "%", vc: "var(--t2)" },
            { l: "RISK SCORE",  v: `${token.riskScore}/100`, vc: rc },
            { l: "WHALE",       v: token.isWhaleActive ? "Detected" : "None", vc: token.isWhaleActive ? "var(--y)" : "var(--t3)" },
          ].map((s, i, arr) => (
            <div key={i} style={{
              padding: "7px 16px",
              borderRight: i < arr.length - 1 ? "1px solid var(--b1)" : "none",
              minWidth: 100, flexShrink: 0,
            }}>
              <div style={{ fontSize: 9, color: "var(--t3)", letterSpacing: ".14em", fontFamily: "var(--mono)", marginBottom: 3 }}>
                {s.l}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: s.vc, fontFamily: "var(--mono)" }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── BODY: left col (chart+tabs) + right col (risk+market) ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Left: main content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Tab bar */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--b1)", flexShrink: 0, background: "var(--s1)" }}>
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: "10px 20px",
                fontSize: 11, fontWeight: 500, letterSpacing: ".05em",
                color: tab === t.key ? "#fff" : "var(--t3)",
                background: "none", border: "none",
                borderBottom: `2px solid ${tab === t.key ? "var(--inj)" : "transparent"}`,
                cursor: "pointer", transition: "all .12s", fontFamily: "var(--font)",
              }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {tab === "chart" && (
              <div style={{ height: "100%", minHeight: 400, display: "flex", flexDirection: "column" }}>
                <PriceChart
                  marketId={marketId}
                  ticker={token.ticker}
                  price={token.price}
                  change24h={token.priceChange24h}
                />
              </div>
            )}
            {tab === "orderbook" && (
              <div style={{ height: "100%", overflowY: "auto" }}>
                <Orderbook marketId={marketId} ticker={token.ticker} />
              </div>
            )}
            {tab === "trades" && (
              <div style={{ height: "100%", overflowY: "auto" }}>
                <TradesFeed marketId={marketId} />
              </div>
            )}
            {tab === "traders" && (
              <div style={{ height: "100%", overflowY: "auto" }}>
                <TradersPanel traders={traders} />
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar: risk breakdown + market info */}
        <div className="token-sidebar" style={{
          width: 260, flexShrink: 0,
          borderLeft: "1px solid var(--b1)",
          display: "flex", flexDirection: "column",
          background: "var(--s1)", overflowY: "auto",
        }}>
          {/* Risk card */}
          <div style={{ padding: "14px 14px 12px", borderBottom: "1px solid var(--b1)" }}>
            <div style={{ fontSize: 9, color: "var(--t3)", letterSpacing: ".14em", fontFamily: "var(--mono)", marginBottom: 8 }}>
              RISK INTELLIGENCE
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: rc, fontFamily: "var(--mono)" }}>
                {token.riskScore}
                <span style={{ fontSize: 14, opacity: 0.4, fontWeight: 400 }}>/100</span>
              </div>
              <span className={`bdg bdg-${rlbl.toLowerCase()}`} style={{ fontSize: 10, padding: "3px 8px" }}>
                {rlbl} RISK
              </span>
            </div>

            {/* Risk factors */}
            {[
              { l: "SPREAD",    v: Math.min(100, Math.round(token.riskScore * 0.28)) },
              { l: "LIQUIDITY", v: Math.min(100, Math.round(token.riskScore * 0.32)) },
              { l: "TOKEN AGE", v: Math.min(100, Math.round(token.riskScore * 0.24)) },
              { l: "WHALE",     v: token.isWhaleActive ? 65 : 8 },
            ].map((f, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 9, color: "var(--t3)", letterSpacing: ".1em", fontFamily: "var(--mono)" }}>{f.l}</span>
                  <span style={{ fontSize: 9, color: riskColor(f.v), fontFamily: "var(--mono)", fontWeight: 600 }}>{f.v}</span>
                </div>
                <div style={{ height: 3, background: "rgba(255,255,255,.07)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{
                    width: `${f.v}%`, height: "100%",
                    background: riskColor(f.v), borderRadius: 3,
                    transition: "width .6s ease",
                  }} />
                </div>
              </div>
            ))}

            <div style={{
              marginTop: 12, padding: "8px 10px",
              background: "var(--s3)", borderRadius: 6, border: "1px solid var(--b1)",
              fontSize: 10, color: "var(--t3)", lineHeight: 1.6,
            }}>
              {rlbl === "SAFE"  && "Low spread, good liquidity, established market. Suitable for normal trading."}
              {rlbl === "LOW"   && "Minor risk factors present. Review liquidity before large positions."}
              {rlbl === "MED"   && "Moderate risk. Elevated spread or low liquidity detected. Trade carefully."}
              {rlbl === "HIGH"  && "High risk detected. Thin liquidity, wide spread, or heavy whale activity. Exercise extreme caution."}
            </div>
          </div>

          {/* Market info */}
          <div style={{ padding: "14px" }}>
            <div style={{ fontSize: 9, color: "var(--t3)", letterSpacing: ".14em", fontFamily: "var(--mono)", marginBottom: 10 }}>
              MARKET INFO
            </div>
            {[
              { l: "STATUS",     v: token.marketStatus.toUpperCase(), vc: "var(--g)" },
              { l: "BASE",       v: token.baseSymbol,   vc: "var(--t1)" },
              { l: "QUOTE",      v: token.quoteSymbol,  vc: "var(--t1)" },
              { l: "MAKER FEE",  v: (parseFloat(token.makerFee) * 100).toFixed(3) + "%", vc: "var(--t2)" },
              { l: "TAKER FEE",  v: (parseFloat(token.takerFee) * 100).toFixed(3) + "%", vc: "var(--t2)" },
            ].map((s, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,.03)",
              }}>
                <span style={{ fontSize: 10, color: "var(--t3)", fontFamily: "var(--mono)" }}>{s.l}</span>
                <span style={{ fontSize: 11, color: s.vc, fontFamily: "var(--mono)", fontWeight: 500 }}>{s.v}</span>
              </div>
            ))}

            {/* Market ID */}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 9, color: "var(--t3)", letterSpacing: ".1em", fontFamily: "var(--mono)", marginBottom: 4 }}>
                MARKET ID
              </div>
              <div style={{
                fontSize: 10, color: "var(--t3)", fontFamily: "var(--mono)",
                wordBreak: "break-all", lineHeight: 1.5,
                background: "var(--s2)", borderRadius: 5, padding: "6px 8px",
                border: "1px solid var(--b1)",
              }}>
                {marketId}
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(marketId)}
                className="btn-ghost"
                style={{ fontSize: 9, padding: "3px 10px", marginTop: 6, width: "100%" }}
              >
                Copy Market ID
              </button>
            </div>

            {/* Injective Explorer link */}
            <a
              href={`https://explorer.injective.network/spot/${marketId}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block", marginTop: 8,
                textAlign: "center", padding: "7px",
                background: "var(--inj-dim)", border: "1px solid var(--inj-bdr)",
                borderRadius: 6, color: "var(--inj-light)",
                fontSize: 10, textDecoration: "none", fontFamily: "var(--mono)",
                letterSpacing: ".05em", transition: "opacity .12s",
              }}
            >
              View on Explorer
            </a>
          </div>
        </div>
      </div>

      {/* Mobile: hide sidebar */}
      <style>{`
        @media (max-width: 768px) {
          .token-sidebar { display: none !important; }
        }
      `}</style>
    </div>
  )
}

// ── TRADERS PANEL ─────────────────────────────────────────────
function TradersPanel({ traders }: { traders: TraderStats[] }) {
  if (!traders.length) return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--t3)", fontSize: 12 }}>
      No trader data available yet
    </div>
  )
  return (
    <div>
      <div style={{
        display: "grid", gridTemplateColumns: "28px 1fr 80px 56px 56px",
        padding: "8px 16px", fontSize: 9, color: "var(--t3)",
        letterSpacing: ".12em", borderBottom: "1px solid var(--b1)", fontFamily: "var(--mono)",
      }}>
        <span>#</span><span>WALLET</span>
        <span style={{ textAlign: "right" }}>PNL</span>
        <span style={{ textAlign: "right" }}>TRADES</span>
        <span style={{ textAlign: "right" }}>WIN %</span>
      </div>
      {traders.map((t, i) => (
        <div key={t.walletAddress} style={{
          display: "grid", gridTemplateColumns: "28px 1fr 80px 56px 56px",
          padding: "9px 16px",
          borderBottom: "1px solid rgba(255,255,255,.022)",
          alignItems: "center",
        }}>
          <span style={{ fontSize: 11, color: "var(--t3)", fontFamily: "var(--mono)" }}>{i + 1}</span>
          <div>
            <div style={{ fontSize: 12, color: "var(--t1)", fontFamily: "var(--mono)" }}>
              {fWallet(t.walletAddress)}
            </div>
            <div style={{ fontSize: 9, color: "var(--t3)", marginTop: 1, fontFamily: "var(--mono)" }}>
              {t.topToken}
            </div>
          </div>
          <div style={{
            textAlign: "right", fontSize: 12, fontWeight: 700, fontFamily: "var(--mono)",
            color: t.estimatedPnlUsd >= 0 ? "var(--g)" : "var(--r)",
          }}>
            {t.estimatedPnlUsd >= 0 ? "+" : ""}{fUsd(Math.abs(t.estimatedPnlUsd))}
          </div>
          <div style={{ textAlign: "right", fontSize: 11, color: "var(--t2)", fontFamily: "var(--mono)" }}>
            {t.tradeCount}
          </div>
          <div style={{
            textAlign: "right", fontSize: 11, fontFamily: "var(--mono)",
            color: t.winRate >= 60 ? "var(--g)" : t.winRate >= 40 ? "var(--y)" : "var(--r)",
          }}>
            {t.winRate}%
          </div>
        </div>
      ))}
    </div>
  )
}