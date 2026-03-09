// components/PriceChart.tsx
"use client"

import { useEffect, useRef, useState, useCallback } from "react"

interface Candle {
  time:  number
  open:  number
  high:  number
  low:   number
  close: number
  value: number
}

interface Props {
  marketId:  string
  ticker:    string
  price:     number
  change24h: number
}

const RESOLUTIONS = [
  { label: "1m",  value: "1" },
  { label: "5m",  value: "5" },
  { label: "15m", value: "15" },
  { label: "1h",  value: "60" },
  { label: "4h",  value: "240" },
  { label: "1D",  value: "D" },
]

export default function PriceChart({ marketId, ticker, price, change24h }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef     = useRef<any>(null)

  const [resolution, setResolution] = useState("60")
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [candles,    setCandles]    = useState<Candle[]>([])
  const [hovered,    setHovered]    = useState<Candle | null>(null)

  const fetchCandles = useCallback(async (res: string) => {
    setLoading(true)
    setError(null)
    try {
      const url  = `/api/chart/${encodeURIComponent(marketId)}?resolution=${res}&ticker=${encodeURIComponent(ticker)}&limit=200`
      const resp = await fetch(url)
      const json = await resp.json()
      if (json.data?.length > 0) {
        setCandles(json.data)
      } else {
        setError("No chart data available for this market yet.")
        setCandles([])
      }
    } catch {
      setError("Chart data unavailable.")
      setCandles([])
    } finally {
      setLoading(false)
    }
  }, [marketId, ticker])

  useEffect(() => { fetchCandles(resolution) }, [resolution, fetchCandles])

  useEffect(() => {
    if (loading || !candles.length || !containerRef.current) return

    // Destroy previous instance
    if (chartRef.current) {
      try { chartRef.current.remove() } catch { /* ignore */ }
      chartRef.current = null
    }

    const el = containerRef.current
    const w  = el.offsetWidth  || 800
    const h  = el.offsetHeight > 80 ? el.offsetHeight : 420

    import("lightweight-charts").then((lc) => {
      if (!containerRef.current) return

      // ── Build chart ────────────────────────────────────────
      // lightweight-charts v5: createChart signature unchanged,
      // but series are added via chart.addSeries(SeriesType, options)
      // v4 still uses chart.addCandlestickSeries(options)
      // We detect the API version at runtime.
      const chart = lc.createChart(el, {
        width:  w,
        height: h,
        layout: {
          background:  { type: (lc as any).ColorType?.Solid ?? "solid", color: "transparent" },
          textColor:   "#8892b8",
          fontFamily:  "Geist Mono, monospace",
          fontSize:    11,
        },
        grid: {
          vertLines: { color: "rgba(255,255,255,.04)" },
          horzLines: { color: "rgba(255,255,255,.04)" },
        },
        crosshair: {
          mode:     (lc as any).CrosshairMode?.Normal ?? 1,
          vertLine: { color: "rgba(11,92,255,.5)", width: 1, style: 0 },
          horzLine: { color: "rgba(11,92,255,.5)", width: 1, style: 0 },
        },
        rightPriceScale: { borderColor: "rgba(255,255,255,.06)", textColor: "#8892b8" },
        timeScale: {
          borderColor:    "rgba(255,255,255,.06)",
          textColor:      "#8892b8",
          timeVisible:    true,
          secondsVisible: false,
        },
        handleScroll: { mouseWheel: true, pressedMouseMove: true },
        handleScale:  { mouseWheel: true, pinch: true },
      })

      const candleOpts = {
        upColor:         "#00c27a",
        downColor:       "#f03e5e",
        borderUpColor:   "#00c27a",
        borderDownColor: "#f03e5e",
        wickUpColor:     "#00c27a",
        wickDownColor:   "#f03e5e",
        priceLineColor:  change24h >= 0 ? "#00c27a" : "#f03e5e",
        priceLineWidth:  1,
        priceFormat:     { type: "price", precision: priceDecimals(price), minMove: minMove(price) },
      }

      // ── API version detection ──────────────────────────────
      // v5: CandlestickSeries exported as a class; chart.addSeries(CandlestickSeries, opts)
      // v4: chart.addCandlestickSeries(opts)
      let candleSeries: any
      if ((lc as any).CandlestickSeries) {
        // v5
        candleSeries = chart.addSeries((lc as any).CandlestickSeries, candleOpts)
      } else {
        // v4
        candleSeries = (chart as any).addCandlestickSeries(candleOpts)
      }

      // Volume histogram
      let volSeries: any
      const volOpts = {
        color:        "rgba(11,92,255,.25)",
        priceFormat:  { type: "volume" },
        priceScaleId: "volume",
      }
      if ((lc as any).HistogramSeries) {
        volSeries = chart.addSeries((lc as any).HistogramSeries, volOpts)
      } else {
        volSeries = (chart as any).addHistogramSeries(volOpts)
      }

      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.85, bottom: 0 },
      })

      // ── Set data ───────────────────────────────────────────
      candleSeries.setData(candles)
      volSeries.setData(candles.map((c) => ({
        time:  c.time,
        value: c.value,
        color: c.close >= c.open ? "rgba(0,194,122,.2)" : "rgba(240,62,94,.2)",
      })))

      chart.timeScale().fitContent()

      // Stablecoin / flat-price fix — pad the scale so candles are visible
      const prices = candles.map((c) => c.close).filter(Boolean)
      if (prices.length > 1) {
        const minP  = Math.min(...prices)
        const maxP  = Math.max(...prices)
        const range = maxP - minP
        if (range < maxP * 0.005 && maxP > 0) {
          const pad = maxP * 0.003
          candleSeries.applyOptions({
            autoscaleInfoProvider: () => ({
              priceRange: { minValue: minP - pad, maxValue: maxP + pad },
            }),
          })
        }
      }

      // Crosshair tooltip
      chart.subscribeCrosshairMove((param: any) => {
        if (param.seriesData?.size) {
          const d = param.seriesData.get(candleSeries)
          if (d) setHovered(d as Candle)
        } else {
          setHovered(null)
        }
      })

      // Resize observer
      const ro = new ResizeObserver(() => {
        if (!containerRef.current) return
        const nh = containerRef.current.offsetHeight
        chart.applyOptions({
          width:  containerRef.current.offsetWidth || 800,
          height: nh > 80 ? nh : 420,
        })
      })
      ro.observe(el)

      chartRef.current = chart

      return () => { ro.disconnect() }
    })

    return () => {
      if (chartRef.current) {
        try { chartRef.current.remove() } catch { /* ignore */ }
        chartRef.current = null
      }
    }
  }, [candles, loading]) // eslint-disable-line

  const display = hovered ?? (candles.length ? candles[candles.length - 1] : null)
  const isUp    = display ? display.close >= display.open : change24h >= 0

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>

      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "6px 14px", borderBottom: "1px solid var(--b1)", flexShrink: 0,
      }}>
        {/* OHLC readout */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", fontFamily: "var(--mono)", fontSize: 10 }}>
          {display ? (
            <>
              <span style={{ color: "var(--t3)" }}>O</span>
              <span style={{ color: isUp ? "var(--g)" : "var(--r)" }}>{fmt(display.open, price)}</span>
              <span style={{ color: "var(--t3)" }}>H</span>
              <span style={{ color: "var(--g)" }}>{fmt(display.high, price)}</span>
              <span style={{ color: "var(--t3)" }}>L</span>
              <span style={{ color: "var(--r)" }}>{fmt(display.low, price)}</span>
              <span style={{ color: "var(--t3)" }}>C</span>
              <span style={{ color: isUp ? "var(--g)" : "var(--r)", fontWeight: 600 }}>{fmt(display.close, price)}</span>
            </>
          ) : (
            <span style={{ color: "var(--t3)" }}>{ticker}</span>
          )}
        </div>

        {/* Resolution switcher */}
        <div style={{ display: "flex", gap: 2 }}>
          {RESOLUTIONS.map((r) => (
            <button
              key={r.value}
              onClick={() => setResolution(r.value)}
              style={{
                background:   resolution === r.value ? "var(--inj-dim)" : "none",
                border:       resolution === r.value ? "1px solid var(--inj-bdr)" : "1px solid transparent",
                color:        resolution === r.value ? "#7aabff" : "var(--t3)",
                borderRadius: 5, padding: "2px 7px",
                fontSize: 10, cursor: "pointer",
                fontFamily: "var(--mono)", transition: "all .1s",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart body */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        {loading && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 5, display: "flex",
            alignItems: "center", justifyContent: "center", background: "var(--bg)",
          }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                border: "2px solid var(--inj)", borderTopColor: "transparent",
                animation: "spin .7s linear infinite",
              }} />
              <span style={{ fontSize: 11, color: "var(--t3)", fontFamily: "var(--mono)" }}>Loading chart…</span>
            </div>
          </div>
        )}

        {!loading && error && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 5, display: "flex",
            flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <div style={{ fontSize: 11, color: "var(--t3)", textAlign: "center", maxWidth: 260, lineHeight: 1.6 }}>
              {error}
            </div>
            <button onClick={() => fetchCandles(resolution)} className="btn-ghost"
              style={{ fontSize: 10, padding: "4px 12px", marginTop: 4 }}>
              Retry
            </button>
          </div>
        )}

        <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: 380 }} />
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function priceDecimals(p: number) {
  if (p >= 1000) return 2
  if (p >= 1)    return 4
  if (p >= 0.01) return 6
  return 8
}
function minMove(p: number) {
  if (p >= 1000) return 0.01
  if (p >= 1)    return 0.0001
  if (p >= 0.01) return 0.000001
  return 0.00000001
}
function fmt(val: number, ref: number) {
  return val.toFixed(priceDecimals(ref))
}