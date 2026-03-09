// app/whales/page.tsx
"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import type { WhaleTx } from "@/lib/types"
import { fPrice, fUsd, fWallet, fTimeAgo } from "@/lib/format"

export default function WhalesPage() {
  const [whales,  setWhales]  = useState<WhaleTx[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpd, setLastUpd] = useState<Date | null>(null)
  const router = useRouter()

  const fetch_ = useCallback(async () => {
    try {
      const res  = await fetch("/api/whales")
      const json = await res.json()
      if (json.data) { setWhales(json.data); setLastUpd(new Date()) }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetch_()
    const id = setInterval(fetch_, 20_000)
    return () => clearInterval(id)
  }, [fetch_])

  const totalVol    = whales.reduce((s, w) => s + w.valueUsd, 0)
  const biggestTx   = whales.length ? Math.max(...whales.map(w => w.valueUsd)) : 0
  const uniqueWallets = new Set(whales.map(w => w.walletAddress)).size

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 52px)" }}>

      {/* Header */}
      <div style={{
        padding: "14px 20px", borderBottom: "1px solid var(--b1)",
        background: "var(--s1)", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10,
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Whale Tracker</div>
          <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>
            Transactions &gt;$10K across all Injective spot markets · auto-refresh 20s
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div className="live-dot" />
          <span style={{ fontSize: 10, color: "var(--t3)", fontFamily: "var(--mono)", letterSpacing: ".07em" }}>LIVE</span>
          {lastUpd && (
            <span style={{ fontSize: 10, color: "var(--t3)", fontFamily: "var(--mono)" }}>
              · {lastUpd.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Summary stats */}
      {!loading && whales.length > 0 && (
        <div style={{
          display: "flex", flexShrink: 0,
          background: "var(--s2)", borderBottom: "1px solid var(--b1)",
          overflowX: "auto",
        }}>
          {[
            { label: "TOTAL TXS",      val: whales.length.toString(),  col: "var(--t1)" },
            { label: "TOTAL VOLUME",   val: fUsd(totalVol),            col: "var(--y)" },
            { label: "BIGGEST TX",     val: fUsd(biggestTx),           col: "var(--y)" },
            { label: "UNIQUE WALLETS", val: uniqueWallets.toString(),   col: "var(--t1)" },
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
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 50 }} />
            ))}
          </div>
        ) : whales.length === 0 ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            height: 300, color: "var(--t3)", fontSize: 12,
          }}>
            No whale transactions found in the last hour
          </div>
        ) : (
          <table className="specter-table">
            <thead>
              <tr>
                <th style={{ textAlign: "left", paddingLeft: 16 }}>MARKET</th>
                <th style={{ textAlign: "left" }}>WALLET</th>
                <th>SIDE</th>
                <th>PRICE</th>
                <th>VALUE</th>
                <th>QTY</th>
                <th>TIME</th>
              </tr>
            </thead>
            <tbody>
              {whales.map((w, i) => {
                const buy = w.side === "buy"
                return (
                  <tr key={`${w.tradeId}-${i}`}
                    onClick={() => router.push(`/token/${encodeURIComponent(w.marketId)}`)}
                  >
                    <td style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{w.ticker}</div>
                    </td>
                    <td style={{ textAlign: "left" }}>
                      <span style={{ fontSize: 11, color: "var(--y)", fontFamily: "var(--mono)" }}>
                        {fWallet(w.walletAddress)}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 3,
                        letterSpacing: ".05em", fontFamily: "var(--mono)",
                        background: buy ? "rgba(0,194,122,.15)" : "rgba(240,62,94,.15)",
                        color: buy ? "var(--g)" : "var(--r)",
                      }}>
                        {w.side.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, fontFamily: "var(--mono)" }}>{fPrice(w.price)}</td>
                    <td style={{ color: "var(--y)", fontWeight: 700, fontFamily: "var(--mono)" }}>{fUsd(w.valueUsd)}</td>
                    <td style={{ color: "var(--t2)", fontFamily: "var(--mono)" }}>{w.quantity.toFixed(2)}</td>
                    <td style={{ color: "var(--t3)", fontFamily: "var(--mono)" }}>{fTimeAgo(w.executedAt)}</td>
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
