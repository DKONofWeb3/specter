// components/Topbar.tsx
"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useWallet } from "@/lib/wallet-context"

const BASE_NAV = [
  { label: "Discover",   href: "/" },
  { label: "New Pairs",  href: "/new-pairs" },
  { label: "Whales",     href: "/whales" },
  { label: "Traders",    href: "/traders" },
]

function shortAddr(a: string) {
  if (!a) return ""
  return a.startsWith("inj") ? a.slice(0, 8) + "…" + a.slice(-4) : a.slice(0, 6) + "…" + a.slice(-4)
}

export default function Topbar() {
  const pathname  = usePathname()
  const router    = useRouter()
  const { address, connected, setWallet, disconnect } = useWallet()
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [walletMenu,  setWalletMenu]  = useState(false)
  const [connecting,  setConnecting]  = useState(false)
  const [error,       setError]       = useState("")
  const dropRef = useRef<HTMLDivElement>(null)

  const NAV = connected
    ? [...BASE_NAV, { label: "Portfolio", href: "/portfolio" }]
    : BASE_NAV

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setWalletMenu(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  async function connectKeplr() {
    setError("")
    const keplr = (window as any).keplr
    if (!keplr) { setError("Keplr extension not installed. Visit keplr.app to install it."); return }
    try {
      setConnecting(true)
      await keplr.enable("injective-1")
      const signer   = keplr.getOfflineSigner("injective-1")
      const accounts = await signer.getAccounts()
      const addr     = accounts[0]?.address ?? ""
      setWallet(addr, "keplr")
      setWalletMenu(false)
    } catch (e: any) {
      setError(e?.message ?? "Keplr connection failed")
    } finally { setConnecting(false) }
  }

  async function connectMetaMask() {
    setError("")
    const eth = (window as any).ethereum
    if (!eth) { setError("MetaMask not installed."); return }
    try {
      setConnecting(true)
      const accounts = await eth.request({ method: "eth_requestAccounts" })
      setWallet(accounts[0] ?? "", "metamask")
      setWalletMenu(false)
    } catch (e: any) {
      setError(e?.message ?? "MetaMask failed")
    } finally { setConnecting(false) }
  }

  function handleDisconnect() {
    disconnect()
    setWalletMenu(false)
    if (pathname === "/portfolio") router.push("/")
  }

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 200, height: 52,
      display: "flex", alignItems: "center", padding: "0 16px",
      background: "rgba(8,10,15,.94)",
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      borderBottom: "1px solid var(--b1)", flexShrink: 0,
    }}>

      {/* Logo */}
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", marginRight: 28, flexShrink: 0 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 7, background: "var(--inj)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 20px var(--inj-glow)",
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="3" fill="white"/>
            <circle cx="8" cy="8" r="6.5" stroke="white" strokeWidth="1.2" strokeDasharray="3 2"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: ".1em" }}>SPECTER</div>
          <div style={{ fontSize: 8, color: "var(--t3)", letterSpacing: ".2em", marginTop: -2 }}>INJECTIVE INTELLIGENCE</div>
        </div>
      </Link>

      {/* Desktop nav */}
      <nav className="hide-mobile" style={{ display: "flex", gap: 2 }}>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} style={{
            fontSize: 12, fontWeight: 500, textDecoration: "none",
            color: pathname === n.href ? "#fff" : "var(--t3)",
            padding: "5px 13px", borderRadius: 6, letterSpacing: ".03em",
            background: pathname === n.href ? "var(--inj-dim)" : "transparent",
            border: pathname === n.href ? "1px solid var(--inj-bdr)" : "1px solid transparent",
            transition: "all .12s",
            ...(n.label === "Portfolio" ? {
              background: pathname === "/portfolio" ? "var(--inj-dim)" : "rgba(11,92,255,.06)",
              border: `1px solid ${pathname === "/portfolio" ? "var(--inj-bdr)" : "rgba(11,92,255,.15)"}`,
              color: "#7aabff",
            } : {}),
          }}>{n.label}</Link>
        ))}
      </nav>

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
        <div className="hide-mobile" style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "var(--s2)", border: "1px solid var(--b1)",
          borderRadius: 20, padding: "4px 11px",
          fontSize: 10, color: "var(--t3)", letterSpacing: ".07em", fontFamily: "var(--mono)",
        }}>
          <div className="live-dot" />
          MAINNET · LIVE
        </div>

        {/* Wallet */}
        <div ref={dropRef} style={{ position: "relative" }}>
          {connected ? (
            <button onClick={() => setWalletMenu(!walletMenu)} style={{
              display: "flex", alignItems: "center", gap: 7,
              background: "var(--inj-dim)", border: "1px solid var(--inj-bdr)",
              borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: "var(--font)",
            }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--g)", boxShadow: "0 0 6px var(--g)" }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: "#7aabff", fontFamily: "var(--mono)" }}>
                {shortAddr(address)}
              </span>
              <span style={{ fontSize: 10, color: "var(--t3)" }}>▾</span>
            </button>
          ) : (
            <button
              onClick={() => setWalletMenu(!walletMenu)}
              disabled={connecting}
              className="btn-primary"
              style={{ opacity: connecting ? 0.7 : 1 }}
            >
              {connecting ? "Connecting…" : "Connect Wallet"}
            </button>
          )}

          {/* Dropdown */}
          {walletMenu && (
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", right: 0,
              background: "var(--s2)", border: "1px solid var(--b2)",
              borderRadius: 10, padding: "6px", width: 248, zIndex: 500,
              boxShadow: "0 12px 40px rgba(0,0,0,.55)",
            }}>
              {connected ? (
                <>
                  <div style={{ padding: "8px 10px 10px" }}>
                    <div style={{ fontSize: 9, color: "var(--t3)", letterSpacing: ".12em", fontFamily: "var(--mono)", marginBottom: 5 }}>
                      CONNECTED WALLET
                    </div>
                    <div style={{ fontSize: 11, color: "var(--t1)", fontFamily: "var(--mono)", wordBreak: "break-all", lineHeight: 1.6 }}>
                      {address}
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <button
                        onClick={() => { navigator.clipboard.writeText(address); setWalletMenu(false) }}
                        className="btn-ghost"
                        style={{ flex: 1, fontSize: 10, padding: "4px 0" }}
                      >
                        Copy
                      </button>
                      <Link
                        href="/portfolio"
                        onClick={() => setWalletMenu(false)}
                        style={{
                          flex: 1, fontSize: 10, padding: "4px 0", textAlign: "center",
                          background: "var(--inj-dim)", border: "1px solid var(--inj-bdr)",
                          borderRadius: 6, color: "var(--inj-light)", textDecoration: "none",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        Portfolio
                      </Link>
                    </div>
                  </div>
                  <div style={{ borderTop: "1px solid var(--b1)", paddingTop: 6 }}>
                    <button onClick={handleDisconnect} style={{
                      width: "100%", padding: "8px 10px", borderRadius: 7,
                      background: "rgba(240,62,94,.08)", border: "1px solid rgba(240,62,94,.15)",
                      color: "var(--r)", fontSize: 11, cursor: "pointer", fontFamily: "var(--font)", fontWeight: 500,
                    }}>
                      Disconnect
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ padding: "6px 10px 8px", fontSize: 10, color: "var(--t3)" }}>
                    Select wallet
                  </div>
                  {[
                    { label: "Keplr", sub: "Native Injective (inj1…)", grad: "135deg,#5263d0,#2e44c8", initial: "K", fn: connectKeplr },
                    { label: "MetaMask", sub: "EVM address (0x…)", grad: "135deg,#f6851b,#e2761b", initial: "M", fn: connectMetaMask },
                  ].map((w) => (
                    <button key={w.label} onClick={w.fn} style={{
                      width: "100%", padding: "9px 10px", borderRadius: 7, marginBottom: 5,
                      background: "transparent", border: "1px solid var(--b2)",
                      color: "var(--t1)", fontSize: 12, fontWeight: 500,
                      cursor: "pointer", fontFamily: "var(--font)",
                      display: "flex", alignItems: "center", gap: 10, transition: "background .1s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--s3)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                        background: `linear-gradient(${w.grad})`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 800, color: "#fff",
                      }}>{w.initial}</div>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{w.label}</div>
                        <div style={{ fontSize: 10, color: "var(--t3)" }}>{w.sub}</div>
                      </div>
                    </button>
                  ))}
                  {error && (
                    <div style={{
                      marginTop: 4, padding: "7px 10px", borderRadius: 6,
                      background: "rgba(240,62,94,.08)", fontSize: 10, color: "var(--r)", lineHeight: 1.5,
                    }}>
                      {error}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Hamburger */}
        <button onClick={() => setMenuOpen(!menuOpen)} className="show-mobile" style={{
          background: "none", border: "1px solid var(--b2)", borderRadius: 7,
          padding: "6px 8px", cursor: "pointer", display: "none", flexDirection: "column", gap: 4,
        }}>
          {[0,1,2].map(i => <span key={i} style={{ width: 18, height: 2, background: "var(--t2)", display: "block", borderRadius: 2 }} />)}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{
          position: "absolute", top: 52, left: 0, right: 0,
          background: "var(--s1)", borderBottom: "1px solid var(--b1)",
          padding: "8px 16px 12px", zIndex: 300,
        }}>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setMenuOpen(false)} style={{
              display: "block", padding: "10px 0", textDecoration: "none",
              fontSize: 13, fontWeight: 500,
              color: pathname === n.href ? "var(--inj-light)" : "var(--t2)",
              borderBottom: "1px solid var(--b1)",
            }}>{n.label}</Link>
          ))}
        </div>
      )}
    </header>
  )
}