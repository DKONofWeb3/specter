// app/portfolio/page.tsx
"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useWallet } from "@/lib/wallet-context"
import { fPrice, fUsd, fTimeAgo } from "@/lib/format"

interface Balance {
  denom:    string
  symbol:   string
  amount:   number
  decimals: number
}
interface Order {
  orderId:  string
  marketId: string
  ticker:   string
  side:     "buy" | "sell"
  price:    number
  quantity: number
  valueUsd: number
  state:    string
}
interface Trade {
  tradeId:    string
  marketId:   string
  ticker:     string
  side:       "buy" | "sell"
  price:      number
  quantity:   number
  valueUsd:   number
  executedAt: number
}
interface Stats {
  totalTrades:    number
  totalVolumeUsd: number
  estimatedPnl:   number
  openOrderCount: number
}

function tokenColor(sym: string): string {
  const c = ["#0B5CFF","#3a7fff","#00c27a","#38bdf8","#f03e5e","#f5b731","#fb923c","#a78bfa","#10b981","#6366f1"]
  let h = 0; for (let i = 0; i < sym.length; i++) h = sym.charCodeAt(i) + ((h << 5) - h)
  return c[Math.abs(h) % c.length]
}

type Tab = "history" | "orders"

export default function PortfolioPage() {
  const router = useRouter()
  const { address, connected } = useWallet()

  const [balances,  setBalances]  = useState<Balance[]>([])
  const [orders,    setOrders]    = useState<Order[]>([])
  const [trades,    setTrades]    = useState<Trade[]>([])
  const [stats,     setStats]     = useState<Stats | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [tab,       setTab]       = useState<Tab>("history")
  const [lastUpd,   setLastUpd]   = useState<Date | null>(null)

  const fetchPortfolio = useCallback(async () => {
    if (!address) return
    try {
      const res  = await fetch(`/api/portfolio/${encodeURIComponent(address)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      const d = json.data
      setBalances(d.balances ?? [])
      setOrders(d.openOrders ?? [])
      setTrades(d.tradeHistory ?? [])
      setStats(d.stats ?? null)
      setLastUpd(new Date())
      setError(null)
    } catch (e: any) {
      setError(e.message ?? "Failed to load portfolio")
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    if (!connected) { router.push("/"); return }
    fetchPortfolio()
    const id = setInterval(fetchPortfolio, 30_000)
    return () => clearInterval(id)
  }, [connected, fetchPortfolio, router])

  if (!connected) return null

  const pnlPos = (stats?.estimatedPnl ?? 0) >= 0

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 52px)", overflow: "hidden" }}>

      {/* ── HEADER ──────────────────────────────────────────── */}
      <div style={{
        padding: "14px 20px", borderBottom: "1px solid var(--b1)",
        background: "var(--s1)", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10,
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Portfolio</div>
          <div style={{ fontSize: 10, color: "var(--t3)", fontFamily: "var(--mono)", marginTop: 2 }}>
            {address}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {lastUpd && (
            <span style={{ fontSize: 10, color: "var(--t3)", fontFamily: "var(--mono)" }}>
              Updated {lastUpd.toLocaleTimeString()}
            </span>
          )}
          <button onClick={fetchPortfolio} className="btn-ghost" style={{ fontSize: 10, padding: "4px 12px" }}>
            Refresh
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {loading ? <PortfolioSkeleton /> : error ? (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 10,
          }}>
            <div style={{ fontSize: 13, color: "var(--r)", textAlign: "center", maxWidth: 320, lineHeight: 1.6 }}>
              {error}
            </div>
            <div style={{ fontSize: 11, color: "var(--t3)", textAlign: "center", maxWidth: 320, lineHeight: 1.6 }}>
              This usually happens when the wallet has no activity on Injective yet, or uses a subaccount format the indexer does not recognise.
            </div>
            <button onClick={fetchPortfolio} className="btn-ghost" style={{ fontSize: 11, marginTop: 6 }}>
              Try again
            </button>
          </div>
        ) : (
          <div style={{ flex: 1, overflow: "auto" }}>

            {/* ── STATS ROW ─────────────────────────────────── */}
            {stats && (
              <div style={{ display: "flex", borderBottom: "1px solid var(--b1)", background: "var(--s2)", overflowX: "auto", flexShrink: 0 }}>
                {[
                  { l: "EST. PNL (RECENT)",  v: (pnlPos ? "+" : "") + fUsd(Math.abs(stats.estimatedPnl)), vc: pnlPos ? "var(--g)" : "var(--r)" },
                  { l: "TOTAL VOLUME",        v: fUsd(stats.totalVolumeUsd),  vc: "var(--t1)" },
                  { l: "TRADES (INDEXED)",    v: stats.totalTrades.toString(), vc: "var(--t1)" },
                  { l: "OPEN ORDERS",         v: stats.openOrderCount.toString(), vc: stats.openOrderCount > 0 ? "var(--y)" : "var(--t3)" },
                ].map((s, i, arr) => (
                  <div key={i} style={{
                    flex: 1, minWidth: 120, padding: "10px 18px",
                    borderRight: i < arr.length - 1 ? "1px solid var(--b1)" : "none",
                  }}>
                    <div style={{ fontSize: 9, color: "var(--t3)", letterSpacing: ".15em", fontFamily: "var(--mono)", marginBottom: 3 }}>{s.l}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: s.vc }}>{s.v}</div>
                  </div>
                ))}
              </div>
            )}

            {/* ── BODY: balances left, activity right ───────── */}
            <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>

              {/* LEFT: Holdings ─────────────────────────────── */}
              <div style={{
                width: 280, flexShrink: 0,
                borderRight: "1px solid var(--b1)",
                display: "flex", flexDirection: "column",
                background: "var(--s1)",
              }}>
                <div style={{
                  padding: "10px 14px", borderBottom: "1px solid var(--b1)",
                  fontSize: 9, color: "var(--t3)", letterSpacing: ".15em", fontFamily: "var(--mono)", flexShrink: 0,
                }}>
                  HOLDINGS
                </div>

                <div style={{ overflowY: "auto", flex: 1 }}>
                  {balances.length === 0 ? (
                    <div style={{ padding: "32px 14px", textAlign: "center", color: "var(--t3)", fontSize: 12 }}>
                      No token balances found on this address.
                    </div>
                  ) : balances.map((b, i) => {
                    const col = tokenColor(b.symbol)
                    return (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,.025)",
                        transition: "background .08s", cursor: "default",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.025)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <div style={{
                          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                          background: `${col}20`, color: col, border: `1px solid ${col}30`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 13, fontWeight: 800,
                        }}>
                          {b.symbol[0]}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{b.symbol}</div>
                          <div style={{ fontSize: 10, color: "var(--t3)", fontFamily: "var(--mono)", marginTop: 1,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {b.denom.length > 30 ? b.denom.slice(0, 14) + "…" + b.denom.slice(-8) : b.denom}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", fontFamily: "var(--mono)" }}>
                            {b.amount < 0.0001 ? b.amount.toExponential(2) : b.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Explorer link */}
                <div style={{ padding: "10px 14px", borderTop: "1px solid var(--b1)", flexShrink: 0 }}>
                  <a
                    href={`https://explorer.injective.network/account/${address}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{
                      display: "block", textAlign: "center", padding: "7px",
                      background: "var(--inj-dim)", border: "1px solid var(--inj-bdr)",
                      borderRadius: 6, color: "var(--inj-light)",
                      fontSize: 10, textDecoration: "none", fontFamily: "var(--mono)", letterSpacing: ".05em",
                    }}
                  >
                    View on Explorer
                  </a>
                </div>
              </div>

              {/* RIGHT: Trade history / Open orders ─────────── */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

                {/* Tab bar */}
                <div style={{ display: "flex", borderBottom: "1px solid var(--b1)", flexShrink: 0, background: "var(--s1)" }}>
                  {([
                    { key: "history", label: `Trade History (${trades.length})` },
                    { key: "orders",  label: `Open Orders (${orders.length})` },
                  ] as { key: Tab; label: string }[]).map((t) => (
                    <button key={t.key} onClick={() => setTab(t.key)} style={{
                      padding: "10px 20px", fontSize: 11, fontWeight: 500, letterSpacing: ".04em",
                      color: tab === t.key ? "#fff" : "var(--t3)",
                      background: "none", border: "none",
                      borderBottom: `2px solid ${tab === t.key ? "var(--inj)" : "transparent"}`,
                      cursor: "pointer", transition: "all .12s", fontFamily: "var(--font)",
                    }}>{t.label}</button>
                  ))}
                </div>

                <div style={{ flex: 1, overflowY: "auto" }}>
                  {tab === "history" && (
                    trades.length === 0 ? (
                      <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--t3)", fontSize: 12 }}>
                        No recent trade history found for this address on the Injective indexer.
                      </div>
                    ) : (
                      <>
                        <div style={{
                          display: "grid", gridTemplateColumns: "80px 1fr 90px 80px 80px 70px",
                          padding: "7px 16px", fontSize: 9, color: "var(--t3)",
                          letterSpacing: ".12em", borderBottom: "1px solid var(--b1)", fontFamily: "var(--mono)",
                          position: "sticky", top: 0, background: "var(--bg)", zIndex: 2,
                        }}>
                          <span>SIDE</span><span>MARKET</span>
                          <span style={{ textAlign: "right" }}>PRICE</span>
                          <span style={{ textAlign: "right" }}>QTY</span>
                          <span style={{ textAlign: "right" }}>VALUE</span>
                          <span style={{ textAlign: "right" }}>TIME</span>
                        </div>
                        {trades.map((t) => {
                          const buy = t.side === "buy"
                          return (
                            <div key={t.tradeId} style={{
                              display: "grid", gridTemplateColumns: "80px 1fr 90px 80px 80px 70px",
                              padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,.022)",
                              alignItems: "center",
                            }}>
                              <span style={{
                                fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 3,
                                letterSpacing: ".05em", fontFamily: "var(--mono)", display: "inline-block",
                                background: buy ? "rgba(0,194,122,.15)" : "rgba(240,62,94,.15)",
                                color: buy ? "var(--g)" : "var(--r)",
                              }}>{t.side.toUpperCase()}</span>
                              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {t.ticker}
                              </div>
                              <div style={{ textAlign: "right", fontSize: 12, fontWeight: 600, color: buy ? "var(--g)" : "var(--r)", fontFamily: "var(--mono)" }}>
                                {fPrice(t.price)}
                              </div>
                              <div style={{ textAlign: "right", fontSize: 11, color: "var(--t2)", fontFamily: "var(--mono)" }}>
                                {t.quantity.toFixed(3)}
                              </div>
                              <div style={{ textAlign: "right", fontSize: 11, color: "var(--t2)", fontFamily: "var(--mono)" }}>
                                {fUsd(t.valueUsd)}
                              </div>
                              <div style={{ textAlign: "right", fontSize: 10, color: "var(--t3)", fontFamily: "var(--mono)" }}>
                                {fTimeAgo(t.executedAt)}
                              </div>
                            </div>
                          )
                        })}
                      </>
                    )
                  )}

                  {tab === "orders" && (
                    orders.length === 0 ? (
                      <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--t3)", fontSize: 12 }}>
                        No open orders found.
                      </div>
                    ) : (
                      <>
                        <div style={{
                          display: "grid", gridTemplateColumns: "80px 1fr 90px 80px 80px 80px",
                          padding: "7px 16px", fontSize: 9, color: "var(--t3)",
                          letterSpacing: ".12em", borderBottom: "1px solid var(--b1)", fontFamily: "var(--mono)",
                          position: "sticky", top: 0, background: "var(--bg)", zIndex: 2,
                        }}>
                          <span>SIDE</span><span>MARKET</span>
                          <span style={{ textAlign: "right" }}>PRICE</span>
                          <span style={{ textAlign: "right" }}>QTY</span>
                          <span style={{ textAlign: "right" }}>VALUE</span>
                          <span style={{ textAlign: "right" }}>STATUS</span>
                        </div>
                        {orders.map((o) => {
                          const buy = o.side === "buy"
                          return (
                            <div key={o.orderId} style={{
                              display: "grid", gridTemplateColumns: "80px 1fr 90px 80px 80px 80px",
                              padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,.022)",
                              alignItems: "center",
                            }}>
                              <span style={{
                                fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 3,
                                letterSpacing: ".05em", fontFamily: "var(--mono)", display: "inline-block",
                                background: buy ? "rgba(0,194,122,.15)" : "rgba(240,62,94,.15)",
                                color: buy ? "var(--g)" : "var(--r)",
                              }}>{o.side.toUpperCase()}</span>
                              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {o.ticker}
                              </div>
                              <div style={{ textAlign: "right", fontSize: 12, fontWeight: 600, fontFamily: "var(--mono)", color: "var(--t1)" }}>
                                {fPrice(o.price)}
                              </div>
                              <div style={{ textAlign: "right", fontSize: 11, color: "var(--t2)", fontFamily: "var(--mono)" }}>
                                {o.quantity.toFixed(3)}
                              </div>
                              <div style={{ textAlign: "right", fontSize: 11, color: "var(--t2)", fontFamily: "var(--mono)" }}>
                                {fUsd(o.valueUsd)}
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <span style={{
                                  fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 3,
                                  background: "rgba(245,183,49,.1)", color: "var(--y)",
                                  border: "1px solid rgba(245,183,49,.2)", fontFamily: "var(--mono)",
                                }}>
                                  {o.state.toUpperCase()}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile: stack columns */}
      <style>{`
        @media (max-width: 768px) {
          .portfolio-body { flex-direction: column !important; }
          .portfolio-holdings { width: 100% !important; border-right: none !important; border-bottom: 1px solid var(--b1); max-height: 280px; }
        }
      `}</style>
    </div>
  )
}

function PortfolioSkeleton() {
  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 60 }} />)}
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 52 }} />)}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          {[1,2,3,4,5,6,7].map(i => <div key={i} className="skeleton" style={{ height: 40 }} />)}
        </div>
      </div>
    </div>
  )
}
