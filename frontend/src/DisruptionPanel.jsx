/**
 * DisruptionPanel.jsx — NEW component
 * Shows active disruption alerts with severity, impact and actions.
 * Add to App.js as a new sidebar tab.
 *
 * Usage in App.js:
 *   import DisruptionPanel from "./DisruptionPanel";
 *   { key:"disruptions", icon:"⚠️", label:"Disruptions" }
 *   {activeTab === "disruptions" && <DisruptionPanel />}
 */
import { useEffect, useState } from "react";

const SEV_STYLE = {
  critical: { bg:"rgba(255,61,90,.08)",  border:"rgba(255,61,90,.25)",  badge:"badge-red",    dot:"#ff3d5a" },
  high:     { bg:"rgba(255,176,32,.08)", border:"rgba(255,176,32,.25)", badge:"badge-amber",  dot:"#ffb020" },
  medium:   { bg:"rgba(56,120,255,.08)", border:"rgba(56,120,255,.25)", badge:"badge-blue",   dot:"#3878ff" },
};

function AlertCard({ alert }) {
  const [open, setOpen] = useState(false);
  const s = SEV_STYLE[alert.severity] || SEV_STYLE.medium;

  return (
    <div style={{
      background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: 12, overflow: "hidden", marginBottom: 10
    }}>
      <div onClick={() => setOpen(!open)} style={{
        padding: "14px 18px", cursor: "pointer",
        display: "flex", alignItems: "flex-start", gap: 12
      }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>{alert.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{alert.title}</span>
            <span className={`badge ${s.badge}`}>{alert.severity}</span>
            <span style={{ fontSize: 11, color: "var(--t3)" }}>{alert.product_name} · {alert.category}</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.6 }}>{alert.description}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#ff3d5a", fontFamily: "var(--mono)" }}>
            -${(alert.financial_impact / 1000).toFixed(0)}K
          </div>
          <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
            {alert.lead_time_days}d lead time
          </div>
          <div style={{ fontSize: 10, color: "var(--t3)" }}>
            {alert.supply_pct}% supply avail.
          </div>
        </div>
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${s.border}`, padding: "12px 18px" }}>
          <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".05em" }}>
            Recommended actions
          </div>
          {alert.actions.map((action, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              marginBottom: 6, fontSize: 12, color: "var(--t1)"
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                background: s.border, display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 10, fontWeight: 700
              }}>{i + 1}</span>
              {action}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RiskRow({ item }) {
  const statusStyle = {
    critical: { color: "var(--red)",    cls: "badge-red"    },
    low:      { color: "var(--amber)",  cls: "badge-amber"  },
    overstock:{ color: "var(--purple)", cls: "badge-purple" },
    healthy:  { color: "var(--green)",  cls: "badge-green"  },
  };
  const st = statusStyle[item.status] || statusStyle.healthy;

  return (
    <tr style={{ borderBottom: "1px solid var(--b0)" }}
      onMouseEnter={e => e.currentTarget.style.background = "var(--bg3)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      <td style={{ padding: "10px 12px", fontWeight: 500 }}>{item.product_name}</td>
      <td style={{ padding: "10px 12px", color: "var(--t2)", fontSize: 12 }}>{item.category}</td>
      <td style={{ padding: "10px 12px", fontFamily: "var(--mono)" }}>{item.current_stock}</td>
      <td style={{ padding: "10px 12px", fontFamily: "var(--mono)", color: item.days_of_cover < 7 ? "var(--red)" : "var(--t1)" }}>
        {item.days_of_cover}d
      </td>
      <td style={{ padding: "10px 12px", fontFamily: "var(--mono)" }}>{item.lead_time_days}d</td>
      <td style={{ padding: "10px 12px", fontFamily: "var(--mono)", color: "var(--cyan)" }}>
        {item.reorder_qty > 0 ? `+${item.reorder_qty}` : "—"}
      </td>
      <td style={{ padding: "10px 12px" }}>
        <span className={`badge ${st.cls}`}>{item.status}</span>
      </td>
    </tr>
  );
}

export default function DisruptionPanel() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:8000/disruptions")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ color: "var(--t3)", padding: 40, textAlign: "center" }}>
      <div className="pulse" style={{ margin: "0 auto 12px" }} />
      Scanning supply chain signals…
    </div>
  );

  if (!data || data.error) return (
    <div style={{ color: "var(--red)", padding: 20 }}>
      Failed to load disruption data. Make sure backend is running.
    </div>
  );

  const { alerts, inventory_risk, summary } = data;

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Disruption Detection</h1>
        <p style={{ fontSize: 12, color: "var(--t3)" }}>
          Real-time supply chain risk monitoring · AI anomaly detection
        </p>
      </div>

      {/* Summary KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Critical alerts",     value: summary.by_severity.critical, color: "var(--red)"    },
          { label: "High alerts",         value: summary.by_severity.high,     color: "var(--amber)"  },
          { label: "Medium alerts",       value: summary.by_severity.medium,   color: "var(--blue)"   },
          { label: "Est. financial risk", value: `$${(summary.total_financial_impact / 1000).toFixed(0)}K`, color: "var(--purple)" },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>
              {s.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: "var(--mono)" }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Alert cards */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>
          Active alerts — click to expand actions
        </div>
        {alerts.length === 0 ? (
          <div style={{ color: "var(--green)", fontSize: 13, padding: "12px 0" }}>
            ✓ No active disruptions detected
          </div>
        ) : (
          alerts.map(a => <AlertCard key={a.id} alert={a} />)
        )}
      </div>

      {/* Inventory risk table */}
      <div className="card">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>
          Inventory risk by product
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--b1)" }}>
                {["Product","Category","Stock","Days cover","Lead time","Reorder qty","Status"].map(h => (
                  <th key={h} style={{
                    padding: "8px 12px", textAlign: "left",
                    color: "var(--t3)", fontWeight: 500, fontSize: 11,
                    textTransform: "uppercase", letterSpacing: ".04em"
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inventory_risk.map(item => <RiskRow key={item.product} item={item} />)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
