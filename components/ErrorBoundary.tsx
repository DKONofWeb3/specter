// components/ErrorBoundary.tsx
"use client"

import { Component, type ReactNode } from "react"

interface Props {
  children:  ReactNode
  fallback?: ReactNode
  label?:    string
}

interface State {
  hasError: boolean
  message:  string
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: "" }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error) {
    console.error(`[ErrorBoundary:${this.props.label ?? "component"}]`, error)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "24px 16px", gap: 10,
          color: "var(--t3)", textAlign: "center",
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "rgba(240,62,94,.1)", border: "1px solid rgba(240,62,94,.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, color: "var(--r)",
          }}>
            !
          </div>
          <div style={{ fontSize: 12, color: "var(--t2)" }}>
            {this.props.label ?? "Component"} failed to load
          </div>
          <div style={{ fontSize: 10, color: "var(--t3)", fontFamily: "var(--mono)", maxWidth: 240 }}>
            {this.state.message}
          </div>
          <button
            className="btn-ghost"
            style={{ fontSize: 10, padding: "4px 14px", marginTop: 4 }}
            onClick={() => this.setState({ hasError: false, message: "" })}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
