// app/page.tsx
"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import type { SpectерToken, TraderStats } from "@/lib/types"
import { fPrice, fUsd, fWallet, fTimeAgo, riskColor } from "@/lib/format"
import TickerTape from "@/components/TickerTape"
import StatsBar   from "@/components/StatsBar"
import FilterBar  from "@/components/FilterBar"
import type { FilterType } from "@/components/FilterBar"
import TokenTable from "@/components/TokenTable"
import BubbleMap  from "@/components/BubbleMap"
import Orderbook  from "@/components/Orderbook"
import TradesFeed from "@/components/TradesFeed"

type RightTab = "orderbook" | "trades" | "traders" | "bubbles"

function tokenColor(sym: string): string {
  const c = ["#0B5CFF","#3a7fff","#00c27a","#38bdf8","#f03e5e","#f5b731","#fb923c","#a78bfa","#10b981","#6366f1"]
  let h = 0; for (let i = 0; i < sym.length; i++) h = sym.charCodeAt(i) + ((h << 5) - h)
  return c[Math.abs(h) % c.length]
}

export default function DiscoverPage() {
  const router  = useRouter()
  const [tokens,   setTokens]   = useState<SpectерToken[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [filter,   setFilter]   = useState<FilterType>("all")
  const [search,   setSearch]   = useState("")
  const [selected, setSelected] = useState<string>("")
  const [tab,      setTab]      = useState<RightTab>("orderbook")
  const [traders,  setTraders]  = useState<TraderStats[]>([])
  const [lastUpd,  setLastUpd]  = useState<Date | null>(null)

  const fetchMarkets = useCallback(async () => {
    try {
      const res  = await fetch("/api/markets")
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.data) {
        setTokens(json.data)
        setLastUpd(new Date())
        setError(null)
        if (!selected && json.data.length > 0) setSelected(json.data[0].marketId)
      }
    } catch (err: any) {
      setError(err.message ?? "Failed to load")
    } finally { setLoading(false) }
  }, [selected])

  const fetchTraders = useCallback(async () => {
    try {
      const res  = await fetch("/api/traders")
      const json = await res.json()
      setTraders((json.data as TraderStats[])?.slice(0, 20) ?? [])
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => {
    fetchMarkets(); fetchTraders()
    const id = setInterval(() => { fetchMarkets(); fetchTraders() }, 30_000)
    return () => clearInterval(id)
  }, []) // eslint-disable-line

  const token = tokens.find((t) => t.marketId === selected)

  const visibleTokens = tokens.filter((t) => {
    const fok = filter === "all" ? true : filter === "new" ? t.isNew : filter === "whale" ? t.isWhaleActive : filter === "hot" ? t.isTrending : t.riskScore >= 75
    const sok = !search || t.baseSymbol.toLowerCase().includes(search.toLowerCase()) || t.ticker.toLowerCase().includes(search.toLowerCase())
    return fok && sok
  })

  function handleSelect(marketId: string) {
    // Desktop: open in right panel. Mobile: navigate to full page
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      router.push(`/token/${encodeURIComponent(marketId)}`)
    } else {
      setSelected(marketId)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 52px)" }}>
      <TickerTape tokens={tokens} />
      <StatsBar   tokens={tokens} />
      <FilterBar  filter={filter} search={search} onFilter={setFilter} onSearch={setSearch} />

      {error && (
        <div style={{
          background: "rgba(240,62,94,.08)", border: "1px solid rgba(240,62,94,.18)",
          padding: "7px 16px", fontSize: 12, color: "var(--r)",
          display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0,
        }}>
          <span>{error}</span>
          <button onClick={fetchMarkets} className="btn-ghost" style={{ fontSize: 10, padding: "3px 10px" }}>Retry</button>
        </div>
      )}

      {/* ── MAIN BODY ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* LEFT: Token table */}
        <div style={{ flex: 1, overflowY: "auto", borderRight: "1px solid var(--b1)" }}>
          <TokenTable
            tokens={tokens}
            filter={filter}
            search={search}
            loading={loading}
            selected={selected}
            onSelect={handleSelect}
          />
        </div>

        {/* RIGHT: Detail panel — hidden on mobile */}
        <div className="right-panel" style={{
          width: 360, flexShrink: 0,
          display: "flex", flexDirection: "column",
          background: "var(--s1)", overflow: "hidden",
          borderLeft: "1px solid var(--b1)",
        }}>
          {token ? (
            <>
              {/* Token hero */}
              <div style={{
                padding: "14px 14px 12px",
                borderBottom: "1px solid var(--b1)", flexShrink: 0,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    {(() => {
                      const col = tokenColor(token.baseSymbol)
                      return (
                        <div style={{
                          width: 36, height: 36, borderRadius: 9,
                          background: `${col}20`, color: col, border: `1.5px solid ${col}40`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 14, fontWeight: 800, flexShrink: 0,
                        }}>{token.baseSymbol[0]}</div>
                      )
                    })()}
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: 5 }}>
                        {token.baseSymbol}
                        {token.isNew         && <span className="bdg bdg-new">NEW</span>}
                        {token.isWhaleActive && <span className="bdg bdg-whale">WHALE</span>}
                        {token.isTrending    && <span className="bdg bdg-hot">HOT</span>}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--t3)", fontFamily: "var(--mono)", marginTop: 1 }}>{token.ticker}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/token/${encodeURIComponent(selected)}`)}
                    className="btn-ghost"
                    style={{ fontSize: 9, padding: "3px 9px" }}
                  >
                    Full page
                  </button>
                </div>

                {/* Price */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{
                    fontSize: 22, fontWeight: 700, fontFamily: "var(--mono)",
                    color: token.priceChange24h >= 0 ? "var(--g)" : "var(--r)",
                  }}>
                    {fPrice(token.price)}
                  </div>
                  <div style={{
                    fontSize: 12, fontWeight: 600, fontFamily: "var(--mono)",
                    color: token.priceChange24h >= 0 ? "var(--g)" : "var(--r)", marginTop: 2,
                  }}>
                    {token.priceChange24h >= 0 ? "+" : ""}{token.priceChange24h.toFixed(2)}% (24h)
                  </div>
                </div>

                {/* Mini stats */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {[
                    { l: "24H VOLUME",  v: fUsd(token.volume24h) },
                    { l: "LIQUIDITY",   v: fUsd(token.liquidity) },
                    {
                      l: "RISK",
                      v: <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: riskColor(token.riskScore) }}>{token.riskScore}</span>
                          <span className={`bdg bdg-${(token.riskScore >= 75 ? "high" : token.riskScore >= 50 ? "med" : token.riskScore >= 25 ? "low" : "safe")}`}>
                            {token.riskScore >= 75 ? "HIGH" : token.riskScore >= 50 ? "MED" : token.riskScore >= 25 ? "LOW" : "SAFE"}
                          </span>
                        </span>,
                    },
                    { l: "WHALE",  v: token.isWhaleActive ? "Detected" : "None",
                      vc: token.isWhaleActive ? "var(--y)" : "var(--t3)" },
                  ].map((s, i) => (
                    <div key={i} style={{
                      background: "var(--s2)", border: "1px solid var(--b1)",
                      borderRadius: 7, padding: "7px 10px",
                    }}>
                      <div style={{ fontSize: 9, color: "var(--t3)", letterSpacing: ".13em", fontFamily: "var(--mono)", marginBottom: 3 }}>{s.l}</div>
                      {typeof s.v === "string"
                        ? <div style={{ fontSize: 13, fontWeight: 600, color: (s as any).vc ?? "var(--t1)" }}>{s.v}</div>
                        : <div style={{ marginTop: 2 }}>{s.v}</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", borderBottom: "1px solid var(--b1)", flexShrink: 0 }}>
                {([
                  { key: "orderbook", label: "Orderbook" },
                  { key: "trades",    label: "Trades" },
                  { key: "traders",   label: "Traders" },
                  { key: "bubbles",   label: "Bubble Map" },
                ] as { key: RightTab; label: string }[]).map((t) => (
                  <button key={t.key} onClick={() => setTab(t.key)} style={{
                    flex: 1, padding: "9px 0",
                    fontSize: 10, fontWeight: 500, letterSpacing: ".04em",
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
              <div style={{ flex: 1, overflowY: "auto" }}>
                {tab === "orderbook" && <Orderbook marketId={selected} ticker={token.ticker} />}
                {tab === "trades"    && <TradesFeed marketId={selected} />}
                {tab === "traders"   && <TradersPanel traders={traders} />}
                {tab === "bubbles"   && (
                  <div style={{ height: "100%", position: "relative" }}>
                    <BubbleMap tokens={visibleTokens} selected={selected} onSelect={(id) => setSelected(id)} />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--t3)", fontSize: 12,
            }}>
              Select a token to view details
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "4px 14px", flexShrink: 0,
        background: "var(--s1)", borderTop: "1px solid var(--b1)",
        fontSize: 10, color: "var(--t3)", fontFamily: "var(--mono)",
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span className="live-dot" style={{ width: 5, height: 5 }} />
            {loading ? "Loading markets…" : `${tokens.length} markets · Injective Mainnet`}
          </span>
          <span>· Auto-refresh 30s</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {lastUpd && <span>Updated {lastUpd.toLocaleTimeString()}</span>}
          <button onClick={fetchMarkets} style={{
            background: "none", border: "none", color: "var(--inj-light)",
            fontSize: 10, cursor: "pointer", fontFamily: "var(--mono)",
          }}>
            Refresh
          </button>
        </div>
      </div>

      {/* Mobile: hide right panel, clicking navigates to full page */}
      <style>{`
        @media (max-width: 1023px) {
          .right-panel { display: none !important; }
        }
      `}</style>
    </div>
  )
}

// ── TRADERS PANEL ──────────────────────────────────────────────────────────
function TradersPanel({ traders }: { traders: TraderStats[] }) {
  if (!traders.length) return (
    <div style={{ padding: 24, textAlign: "center", color: "var(--t3)", fontSize: 12 }}>
      Loading traders…
    </div>
  )
  return (
    <div>
      <div style={{
        display: "grid", gridTemplateColumns: "22px 1fr 68px 48px",
        padding: "6px 12px", fontSize: 9, color: "var(--t3)",
        letterSpacing: ".12em", borderBottom: "1px solid var(--b1)", fontFamily: "var(--mono)",
      }}>
        <span>#</span><span>WALLET</span>
        <span style={{ textAlign: "right" }}>PNL</span>
        <span style={{ textAlign: "right" }}>TRADES</span>
      </div>
      {traders.map((t, i) => (
        <div key={t.walletAddress} style={{
          display: "grid", gridTemplateColumns: "22px 1fr 68px 48px",
          padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,.022)", alignItems: "center",
        }}>
          <span style={{ fontSize: 10, color: "var(--t3)", fontFamily: "var(--mono)" }}>{i + 1}</span>
          <div>
            <div style={{ fontSize: 11, color: "var(--t1)", fontFamily: "var(--mono)" }}>{fWallet(t.walletAddress)}</div>
            <div style={{ fontSize: 9, color: "var(--t3)", marginTop: 1, fontFamily: "var(--mono)" }}>{t.topToken} · {t.winRate}% win</div>
          </div>
          <div style={{
            textAlign: "right", fontSize: 12, fontWeight: 700, fontFamily: "var(--mono)",
            color: t.estimatedPnlUsd >= 0 ? "var(--g)" : "var(--r)",
          }}>
            {t.estimatedPnlUsd >= 0 ? "+" : ""}{fUsd(Math.abs(t.estimatedPnlUsd))}
          </div>
          <div style={{ textAlign: "right", fontSize: 11, color: "var(--t2)", fontFamily: "var(--mono)" }}>{t.tradeCount}</div>
        </div>
      ))}
    </div>
  )
}