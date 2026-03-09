// components/FilterBar.tsx
"use client"

export type FilterType = "all" | "new" | "whale" | "hot" | "risk"

interface Props {
  filter: FilterType
  search: string
  onFilter: (f: FilterType) => void
  onSearch: (q: string) => void
}

const FILTERS: { key: FilterType; label: string }[] = [
  { key: "all",   label: "All" },
  { key: "new",   label: "New" },
  { key: "whale", label: "Whale" },
  { key: "hot",   label: "Trending" },
  { key: "risk",  label: "High Risk" },
]

export default function FilterBar({ filter, search, onFilter, onSearch }: Props) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap",
      padding: "7px 14px", flexShrink: 0,
      background: "var(--s1)", borderBottom: "1px solid var(--b1)",
    }}>
      <span style={{ fontSize: 9, color: "var(--t3)", letterSpacing: ".16em", fontFamily: "var(--mono)", flexShrink: 0 }}>
        FILTER
      </span>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => onFilter(f.key)}
            className={`chip ${filter === f.key ? "active" : ""}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginLeft: "auto" }}>
        <span style={{
          position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
          color: "var(--t3)", fontSize: 14, pointerEvents: "none",
        }}>⌕</span>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search token…"
          style={{
            background: "var(--s2)", border: "1px solid var(--b2)",
            borderRadius: 8, padding: "6px 12px 6px 28px",
            color: "var(--t1)", fontSize: 11, fontFamily: "var(--mono)",
            outline: "none", width: 190,
          }}
        />
      </div>
    </div>
  )
}
