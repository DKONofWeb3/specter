// lib/wallet-context.tsx
"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

interface WalletCtx {
  address:   string
  walletType: "keplr" | "metamask" | null
  connected: boolean
  setWallet: (address: string, type: "keplr" | "metamask") => void
  disconnect: () => void
}

const Ctx = createContext<WalletCtx>({
  address: "", walletType: null, connected: false,
  setWallet: () => {}, disconnect: () => {},
})

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address,    setAddress]    = useState("")
  const [walletType, setWalletType] = useState<"keplr" | "metamask" | null>(null)

  // Restore from sessionStorage on mount
  useEffect(() => {
    const saved     = sessionStorage.getItem("specter_wallet")
    const savedType = sessionStorage.getItem("specter_wallet_type") as "keplr" | "metamask" | null
    if (saved) { setAddress(saved); setWalletType(savedType) }
  }, [])

  function setWallet(addr: string, type: "keplr" | "metamask") {
    setAddress(addr)
    setWalletType(type)
    sessionStorage.setItem("specter_wallet",      addr)
    sessionStorage.setItem("specter_wallet_type", type)
  }

  function disconnect() {
    setAddress("")
    setWalletType(null)
    sessionStorage.removeItem("specter_wallet")
    sessionStorage.removeItem("specter_wallet_type")
  }

  return (
    <Ctx.Provider value={{ address, walletType, connected: !!address, setWallet, disconnect }}>
      {children}
    </Ctx.Provider>
  )
}

export function useWallet() { return useContext(Ctx) }