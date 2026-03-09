// components/WhaleAlert.tsx
"use client"

import { useEffect, useState, useRef } from "react"
import { fUsd, fWallet } from "@/lib/format"
import type { WhaleTx } from "@/lib/types"

export default function WhaleAlert() {
  const [alerts,  setAlerts]  = useState<(WhaleTx & { id: string })[]>([])
  const seenRef   = useRef<Set<string>>(new Set())
  const firstPoll = useRef(true)

  useEffect(() => {
    async function poll() {
      try {
        const res  = await fetch("/api/whales")
        const json = await res.json()
        const txs  = (json.data as WhaleTx[]) ?? []

        // Skip alerting on the very first load — just seed "seen" set
        if (firstPoll.current) {
          txs.forEach((t) => seenRef.current.add(t.tradeId))
          firstPoll.current = false
          return
        }

        const newTxs = txs.filter((t) => !seenRef.current.has(t.tradeId))
        newTxs.forEach((t) => seenRef.current.add(t.tradeId))

        if (newTxs.length > 0) {
          const withId = newTxs.slice(0, 3).map((t) => ({
            ...t,
            id: `${t.tradeId}-${Date.now()}`,
          }))
          setAlerts((prev) => [...withId, ...prev].slice(0, 5))

          // Auto-dismiss each after 7s
          withId.forEach((a) => {
            setTimeout(() => dismiss(a.id), 7000)
          })
        }
      } catch (e) { /* silent */ }
    }

    poll()
    const id = setInterval(poll, 20_000)
    return () => clearInterval(id)
  }, [])

  function dismiss(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }

  if (!alerts.length) return null

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 20,
      display: "flex", flexDirection: "column", gap: 8,
      zIndex: 1000, pointerEvents: "none",
    }}>
      {alerts.map((a) => (
        <div key={a.id} style={{
          background: "var(--s2)",
          border: `1px solid ${a.side === "buy" ? "rgba(0,194,122,.25)" : "rgba(240,62,94,.25)"}`,
          borderLeft: `3px solid ${a.side === "buy" ? "var(--g)" : "var(--r)"}`,
          borderRadius: 8, padding: "10px 14px",
          display: "flex", alignItems: "center", gap: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,.4)",
          pointerEvents: "all", cursor: "default",
          animation: "slideIn .2s ease",
          maxWidth: 300,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6, flexShrink: 0,
            background: a.side === "buy" ? "rgba(0,194,122,.12)" : "rgba(240,62,94,.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13,
          }}>
            {a.side === "buy" ? "▲" : "▼"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#fff", display: "flex", gap: 5, alignItems: "center" }}>
              <span style={{ color: a.side === "buy" ? "var(--g)" : "var(--r)" }}>
                Whale {a.side.toUpperCase()}
              </span>
              <span style={{ color: "var(--y)", fontFamily: "var(--mono)" }}>{a.ticker}</span>
            </div>
            <div style={{ fontSize: 10, color: "var(--t3)", fontFamily: "var(--mono)", marginTop: 2 }}>
              {fWallet(a.walletAddress)} · {fUsd(a.valueUsd)}
            </div>
          </div>
          <button
            onClick={() => dismiss(a.id)}
            style={{
              background: "none", border: "none", color: "var(--t3)",
              cursor: "pointer", padding: "0 2px", fontSize: 14,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
