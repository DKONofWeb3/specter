// app/traders/page.tsx
"use client"

import { useEffect, useState, useCallback } from "react"
import type { TraderStats } from "@/lib/types"
import { fUsd, fWallet, fTimeAgo } from "@/lib/format"

type SortKey = "estimatedPnlUsd" | "totalVolumeUsd" | "tradeCount" | "winRate"

export default function TradersPage() {
  const [traders,  setTraders]  = useState<TraderStats[]>([])
  const [loading,  setLoading]  = useState(true)
  const [sortKey,  setSortKey]  = useState<SortKey>("estimatedPnlUsd")
  const [lastUpd,  setLastUpd]  = useState<Date | null>(null)

  const fetch_ = useCallback(async () => {
    try {
      const res  = await fetch("/api/traders")
      const json = await res.json()
      if (json.data) { setTraders(json.data); setLastUpd(new Date()) }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetch_()
    const id = setInterval(fetch_, 60_000)
    return () => clearInterval(id)
  }, [fetch_])

  const sorted = [...traders].sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number))

  const totalVol  = traders.reduce((s, t) => s + t.totalVolumeUsd, 0)
  const topPnl    = traders.length ? Math.max(...traders.map(t => t.estimatedPnlUsd)) : 0
  const avgWin    = traders.length ? Math.round(traders.reduce((s, t) => s + t.winRate, 0) / traders.length) : 0

  const SORT_OPTS: { key: SortKey; label: string }[] = [
    { key: "estimatedPnlUsd", label: "Est. PnL" },
    { key: "totalVolumeUsd",  label: "Volume" },
    { key: "tradeCount",      label: "Trades" },
    { key: "winRate",         label: "Win Rate" },
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 52px)" }}>

      {/* Header */}
      <div style={{
        padding: "14px 20px", borderBottom: "1px solid var(--b1)",
        background: "var(--s1)", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10,
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Profitable Traders</div>
          <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>
            Ranked by estimated PnL derived from on-chain Injective trade history
          </div>
        </div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {SORT_OPTS.map((o) => (
            <button
              key={o.key}
              onClick={() => setSortKey(o.key)}
              className={`chip ${sortKey === o.key ? "active" : ""}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      {!loading && traders.length > 0 && (
        <div style={{
          display: "flex", flexShrink: 0,
          background: "var(--s2)", borderBottom: "1px solid var(--b1)",
          overflowX: "auto",
        }}>
          {[
            { label: "TRADERS RANKED", val: traders.length.toString(), col: "var(--t1)" },
            { label: "TOTAL VOLUME",   val: fUsd(totalVol),            col: "var(--inj-light)" },
            { label: "TOP PNL",        val: fUsd(topPnl),              col: "var(--g)" },
            { label: "AVG WIN RATE",   val: avgWin + "%",              col: "var(--t1)" },
          ].map((s, i, arr) => (
            <div key={i} style={{
              flex: 1, minWidth: 120, padding: "10px 18px",
              borderRight: i < arr.length - 1 ? "1px solid var(--b1)" : "none",
            }}>
              <div style={{ fontSize: 9, color: "var(--t3)", letterSpacing: ".15em", fontFamily: "var(--mono)" }}>{s.label}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: s.col, marginTop: 3 }}>{s.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 7 }}>
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 50 }} />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            height: 300, color: "var(--t3)", fontSize: 12,
          }}>
            No trader data available yet
          </div>
        ) : (
          <table className="specter-table">
            <thead>
              <tr>
                <th style={{ textAlign: "left", paddingLeft: 16 }}>#</th>
                <th style={{ textAlign: "left" }}>WALLET</th>
                <th>TOP TOKEN</th>
                <th>EST. PNL</th>
                <th>VOLUME</th>
                <th>TRADES</th>
                <th>WIN RATE</th>
                <th>LAST ACTIVE</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t, i) => {
                const pos = t.estimatedPnlUsd >= 0
                const wrc = t.winRate >= 60 ? "var(--g)" : t.winRate >= 40 ? "var(--y)" : "var(--r)"
                return (
                  <tr key={t.walletAddress}>
                    <td style={{ textAlign: "left", paddingLeft: 16 }}>
                      <span style={{ fontSize: 11, color: "var(--t3)", fontFamily: "var(--mono)" }}>{i + 1}</span>
                    </td>
                    <td style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 12, color: "var(--t1)", fontFamily: "var(--mono)" }}>
                        {fWallet(t.walletAddress)}
                      </div>
                      <div style={{ fontSize: 9, color: "var(--t3)", marginTop: 1, fontFamily: "var(--mono)" }}>
                        {t.totalBuys}B · {t.totalSells}S
                      </div>
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11, color: "var(--inj-light)",
                        background: "var(--inj-dim)", border: "1px solid var(--inj-bdr)",
                        borderRadius: 4, padding: "2px 7px", fontFamily: "var(--mono)",
                      }}>
                        {t.topToken}
                      </span>
                    </td>
                    <td style={{
                      fontWeight: 700, fontFamily: "var(--mono)",
                      color: pos ? "var(--g)" : "var(--r)",
                    }}>
                      {pos ? "+" : "-"}{fUsd(Math.abs(t.estimatedPnlUsd))}
                    </td>
                    <td style={{ color: "var(--t2)", fontFamily: "var(--mono)" }}>{fUsd(t.totalVolumeUsd)}</td>
                    <td style={{ color: "var(--t2)", fontFamily: "var(--mono)" }}>{t.tradeCount}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                        <div style={{ width: 36, height: 3, background: "rgba(255,255,255,.07)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${t.winRate}%`, height: "100%", background: wrc, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: wrc, fontFamily: "var(--mono)" }}>
                          {t.winRate}%
                        </span>
                      </div>
                    </td>
                    <td style={{ color: "var(--t3)", fontFamily: "var(--mono)" }}>
                      {t.lastActive ? fTimeAgo(t.lastActive) : "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
