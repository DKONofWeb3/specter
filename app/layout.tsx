// app/layout.tsx
import type { Metadata } from "next"
import "./globals.css"
import { WalletProvider } from "@/lib/wallet-context"
import Topbar     from "@/components/Topbar"
import WhaleAlert from "@/components/WhaleAlert"

export const metadata: Metadata = {
  title:       "SPECTER — Injective Intelligence",
  description: "Real-time token discovery, whale tracking, and risk intelligence for Injective Protocol.",
  openGraph: {
    title:       "SPECTER — Injective Intelligence",
    description: "Live orderbook data, whale detection, and risk scoring for every Injective spot market.",
    type:        "website",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <Topbar />
          <main style={{ position: "relative", zIndex: 1 }}>{children}</main>
          <WhaleAlert />
        </WalletProvider>
      </body>
    </html>
  )
}