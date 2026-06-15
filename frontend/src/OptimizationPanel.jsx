/**
 * OptimizationPanel.jsx — NEW component
 * Inventory optimization: EOQ, safety stock, ABC, logistics actions.
 * Add as a new tab in App.js.
 *
 * Usage in App.js:
 *   import OptimizationPanel from "./OptimizationPanel";
 *   { key:"optimize", icon:"📦", label:"Optimize" }
 *   {activeTab === "optimize" && <OptimizationPanel />}
 */
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";

const PRIORITY_STYLE = {
  critical: { cls: "badge-red",    color: "var(--red)",    border: "rgba(255,61,90,.3)"   },
  high:     { cls: "badge-amber",  color: "var(--amber)",  border: "rgba(255,176,32,.3)"  },
  medium:   { cls: "badge-purple", color: "var(--purple)", border: "rgba(155,114,255,.3)" },
  low:      { cls: "badge-green",  color: "var(--green)",  border: "rgba(0,224,138,.3)"   },
};

const ABC_COLOR = { A: "var(--red)", B: "var(--amber)", C: "var(--green)" };
const ABC_DESC  = {
  A: "Top 20% SKUs — 80% of revenue. Maximum attention.",
  B: "Mid-tier SKUs — monitor closely.",
  C: "Low-value SKUs — minimal inventory.",
};

const LOGISTICS_ICON = {
  emergency: "🚨",
  reorder:   "📦",
  overstock: "🏭",
};

function MetricRow({ label, value, color }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "6px 0", borderBottom: "1px solid var(--b0)", fontSize: 12
    }}>
      <span style={{ color: "var(--t2)" }}>{label}</span>
      <span style={{ fontFamily: "var(--mono)", fontWeight: 500, color: color || "var(--t1)" }}>{value}</span>
    </div>
  );
}

export default function OptimizationPanel() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:8000/optimize")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ color: "var(--t3)", padding: 40, textAlign: "center" }}>
      <div className="pulse" style={{ margin: "0 auto 12px" }} />
      Running EOQ + ABC optimization…
    </div>
  );

  if (!data || data.error) return (
    <div style={{ color: "var(--red)", padding: 20 }}>
      Optimization failed. Check backend.
    </div>
  );

  const { recommendations, logistics_actions, summary } = data;

  const barData = recommendations.map(r => ({
    name:    r.product_name.length > 12 ? r.product_name.slice(0,12)+"…" : r.product_name,
    cover:   r.days_of_cover,
    lead:    r.lead_time_days,
    color:   r.priority === "critical" ? "#ff3d5a" : r.priority === "high" ? "#ffb020" : r.priority === "low" ? "#00e08a" : "#9b72ff",
  }));

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Inventory Optimization</h1>
        <p style={{ fontSize: 12, color: "var(--t3)" }}>
          EOQ · Safety stock · ABC analysis · Logistics recommendations
        </p>
      </div>

      {/* Summary KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total order value",  value: `$${(summary.total_order_value/1000).toFixed(0)}K`,   color: "var(--blue)"   },
          { label: "Potential savings",  value: `$${(summary.potential_savings/1000).toFixed(0)}K`,   color: "var(--green)"  },
          { label: "Critical SKUs",      value: summary.critical_count,                               color: "var(--red)"    },
          { label: "Overstock SKUs",     value: summary.overstock_count,                              color: "var(--amber)"  },
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

      {/* Logistics action banners */}
      {logistics_actions.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {logistics_actions.map((la, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              padding: "12px 16px", borderRadius: 10, marginBottom: 8,
              background: la.type === "emergency" ? "rgba(255,61,90,.08)" : la.type === "reorder" ? "rgba(255,176,32,.08)" : "rgba(155,114,255,.08)",
              border: `1px solid ${la.type === "emergency" ? "rgba(255,61,90,.25)" : la.type === "reorder" ? "rgba(255,176,32,.25)" : "rgba(155,114,255,.25)"}`,
            }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{LOGISTICS_ICON[la.type]}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{la.message}</div>
                <div style={{ fontSize: 11, color: "var(--t3)" }}>
                  Affected: {la.skus.join(", ")}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Days cover vs lead time chart */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
          Stock cover vs lead time
        </div>
        <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 14 }}>
          Bar below dashed line = reorder needed
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={barData} barSize={28}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "#3d5070", fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: "#3d5070", fontSize: 10 }} tickLine={false} axisLine={false} label={{ value: "days", angle: -90, position: "insideLeft", fill: "#3d5070", fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "var(--bg3)", border: "1px solid var(--b2)", borderRadius: 8 }}
              labelStyle={{ color: "var(--t2)" }} itemStyle={{ color: "var(--t1)" }} />
            <Bar dataKey="cover" name="Days of stock" radius={[6,6,0,0]}>
              {barData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recommendation cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
        {recommendations.map(r => {
          const ps = PRIORITY_STYLE[r.priority] || PRIORITY_STYLE.low;
          return (
            <div key={r.product} className="card" style={{
              borderTop: `3px solid ${ps.color}`
            }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{r.product_name}</div>
                  <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>{r.product} · {r.category}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexDirection: "column", alignItems: "flex-end" }}>
                  <span className={`badge ${ps.cls}`}>{r.action_label}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                    background: ABC_COLOR[r.abc_class] + "22", color: ABC_COLOR[r.abc_class]
                  }}>ABC: {r.abc_class}</span>
                </div>
              </div>

              {/* Metrics */}
              <MetricRow label="Current stock"     value={r.current_stock} />
              <MetricRow label="Days of cover"     value={`${r.days_of_cover}d`}  color={r.days_of_cover < r.lead_time_days ? "var(--red)" : "var(--t1)"} />
              <MetricRow label="Reorder point"     value={r.reorder_point} />
              <MetricRow label="EOQ"               value={r.eoq} color="var(--cyan)" />
              <MetricRow label="Safety stock"      value={r.safety_stock} />
              <MetricRow label="Order qty"         value={r.order_qty > 0 ? `+${r.order_qty}` : "—"} color={r.order_qty > 0 ? "var(--amber)" : "var(--green)"} />
              <MetricRow label="Order value"       value={r.order_value > 0 ? `$${r.order_value.toLocaleString()}` : "—"} />
              <MetricRow label="Logistics mode"    value={r.logistics_mode} color="var(--blue)" />

              {/* Action box */}
              <div style={{
                marginTop: 10, padding: "10px 12px", borderRadius: 8,
                background: ps.border, border: `1px solid ${ps.border}`
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: ps.color, marginBottom: 3 }}>
                  {r.speed_requirement}
                </div>
                <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5 }}>
                  {r.service_impact}
                </div>
              </div>

              {/* Cost breakdown */}
              <div style={{ marginTop: 10, fontSize: 11, color: "var(--t3)" }}>
                Annual holding: ${(r.cost_breakdown.annual_holding_cost/1000).toFixed(1)}K ·
                Ordering: ${(r.cost_breakdown.annual_ordering_cost/1000).toFixed(1)}K
              </div>
            </div>
          );
        })}
      </div>

      {/* ABC legend */}
      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>ABC Classification</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          {["A","B","C"].map(cls => (
            <div key={cls} style={{
              padding: "12px 14px", borderRadius: 10,
              background: ABC_COLOR[cls] + "10",
              border: `1px solid ${ABC_COLOR[cls]}33`
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: ABC_COLOR[cls], marginBottom: 4 }}>
                Class {cls} · {summary.abc_distribution[cls]} SKU{summary.abc_distribution[cls] !== 1 ? "s" : ""}
              </div>
              <div style={{ fontSize: 12, color: "var(--t2)" }}>{ABC_DESC[cls]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
