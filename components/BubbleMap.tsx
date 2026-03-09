// components/BubbleMap.tsx
"use client"

import { useEffect, useRef } from "react"
import type { SpectерToken } from "@/lib/types"

interface Props {
  tokens: SpectерToken[]
  selected: string
  onSelect: (marketId: string) => void
}

function bubbleColor(pct: number): string {
  if (pct >= 15) return "#00c27a"
  if (pct >= 5)  return "#22c55e"
  if (pct >= 0)  return "#4ade80"
  if (pct >= -5) return "#fb923c"
  return "#f03e5e"
}

export default function BubbleMap({ tokens, selected, onSelect }: Props) {
  const svgRef  = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!tokens.length || !svgRef.current || !wrapRef.current) return

    import("d3").then((d3) => {
      const W = wrapRef.current!.clientWidth  || 320
      const H = wrapRef.current!.clientHeight || 400

      const svg = d3.select(svgRef.current!)
      svg.selectAll("*").remove()
      svg.attr("viewBox", `0 0 ${W} ${H}`)

      const maxVol = Math.max(...tokens.map((t) => t.volume24h))
      const minVol = Math.min(...tokens.map((t) => t.volume24h))

      const nodes = tokens.map((t) => ({
        ...t,
        r: 24 + ((t.volume24h - minVol) / (maxVol - minVol || 1)) * 52,
        x: W / 2 + (Math.random() - 0.5) * W * 0.6,
        y: H / 2 + (Math.random() - 0.5) * H * 0.6,
      }))

      const sim = d3.forceSimulation(nodes as any)
        .force("charge",    d3.forceManyBody().strength(4))
        .force("center",    d3.forceCenter(W / 2, H / 2))
        .force("collision", d3.forceCollide().radius((d: any) => d.r + 3))
        .force("x",         d3.forceX(W / 2).strength(0.04))
        .force("y",         d3.forceY(H / 2).strength(0.04))

      const defs = svg.append("defs")

      const g = svg.selectAll(".bubble")
        .data(nodes)
        .enter()
        .append("g")
        .attr("class", "bubble")
        .style("cursor", "pointer")
        .on("click", (_, d: any) => onSelect(d.marketId))

      // Glow filter per bubble
      nodes.forEach((n, i) => {
        const col = bubbleColor(n.priceChange24h)
        const fid = `glow${i}`
        const filter = defs.append("filter").attr("id", fid)
        filter.append("feGaussianBlur").attr("in", "SourceGraphic").attr("stdDeviation", "3").attr("result", "blur")
        filter.append("feColorMatrix").attr("in", "blur").attr("values", "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7").attr("result", "glow")
        const merge = filter.append("feMerge")
        merge.append("feMergeNode").attr("in", "glow")
        merge.append("feMergeNode").attr("in", "SourceGraphic")
      })

      // Outer glow ring
      g.append("circle")
        .attr("r",  (d: any) => d.r + 3)
        .attr("fill", "none")
        .attr("stroke", (d: any) => bubbleColor(d.priceChange24h) + "28")
        .attr("stroke-width", 6)

      // Main circle
      g.append("circle")
        .attr("r", (d: any) => d.r)
        .attr("fill", (d: any) => {
          const col = bubbleColor(d.priceChange24h)
          return col + "28"
        })
        .attr("stroke", (d: any) => {
          const col = bubbleColor(d.priceChange24h)
          return d.marketId === selected ? col + "ff" : col + "60"
        })
        .attr("stroke-width", (d: any) => d.marketId === selected ? 2.5 : 1.2)
        .attr("filter", (d: any, i: number) => `url(#glow${i})`)

      // Hover
      g.on("mouseover", function(_, d: any) {
        d3.select(this).select("circle:nth-child(2)")
          .attr("fill", bubbleColor(d.priceChange24h) + "44")
      }).on("mouseout", function(_, d: any) {
        d3.select(this).select("circle:nth-child(2)")
          .attr("fill", bubbleColor(d.priceChange24h) + "28")
      })

      // Symbol
      g.filter((d: any) => d.r >= 32)
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dy", (d: any) => d.r >= 42 ? "-0.15em" : "0.35em")
        .attr("fill", "#fff")
        .attr("font-family", "Geist, sans-serif")
        .attr("font-weight", "700")
        .attr("font-size", (d: any) => Math.min(d.r * 0.38, 16))
        .text((d: any) => d.baseSymbol)

      // % change
      g.filter((d: any) => d.r >= 42)
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dy",  (d: any) => `${d.r * 0.22}px`)
        .attr("fill", (d: any) => bubbleColor(d.priceChange24h))
        .attr("font-family", "Geist Mono, monospace")
        .attr("font-weight", "500")
        .attr("font-size", (d: any) => Math.min(d.r * 0.2, 11))
        .text((d: any) => `${d.priceChange24h >= 0 ? "+" : ""}${d.priceChange24h.toFixed(2)}%`)

      sim.on("tick", () => {
        g.attr("transform", (d: any) => {
          d.x = Math.max(d.r + 6, Math.min(W - d.r - 6, d.x))
          d.y = Math.max(d.r + 6, Math.min(H - d.r - 6, d.y))
          return `translate(${d.x},${d.y})`
        })
      })

      setTimeout(() => sim.stop(), 4000)
    })
  }, [tokens, selected, onSelect])

  return (
    <div ref={wrapRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      {tokens.length === 0 ? (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          height: "100%", color: "var(--t3)", fontSize: 12,
        }}>
          Loading bubble map…
        </div>
      ) : (
        <svg ref={svgRef} style={{ width: "100%", height: "100%", display: "block" }} />
      )}

      {/* Legend */}
      <div style={{
        position: "absolute", bottom: 10, left: 10,
        display: "flex", gap: 10, fontSize: 9, color: "var(--t3)", fontFamily: "var(--mono)",
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--g)", display: "inline-block" }} />
          Pumping
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--r)", display: "inline-block" }} />
          Dumping
        </span>
        <span>Size = volume</span>
      </div>
    </div>
  )
}
