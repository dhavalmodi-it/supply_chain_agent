/**
 * StockoutRisk.jsx
 * Displays inventory depletion timeline and reorder recommendations
 * Shows when product will run out at current burn rate
 * 
 * Usage in App.js or dashboard:
 *   import StockoutRisk from "./StockoutRisk";
 *   <StockoutRisk product={p} />
 */

export default function StockoutRisk({ product }) {
  const risk = product?.interpretation?.stockout_risk;
  if (!risk) return null;

  // Color coding based on risk level
  const statusColor = {
    CRITICAL: "var(--red)",
    WARNING: "var(--amber)",
    OK: "var(--green)",
  };

  const statusBgColor = {
    CRITICAL: "rgba(255, 61, 90, 0.1)",
    WARNING: "rgba(255, 176, 32, 0.1)",
    OK: "rgba(0, 224, 138, 0.1)",
  };

  const statusBorder = {
    CRITICAL: "1px solid rgba(255, 61, 90, 0.2)",
    WARNING: "1px solid rgba(255, 176, 32, 0.2)",
    OK: "1px solid rgba(0, 224, 138, 0.2)",
  };

  const statusIcon = {
    CRITICAL: "🚨",
    WARNING: "⚠️",
    OK: "✅",
  };

  return (
    <div
      style={{
        marginTop: 16,
        padding: 14,
        background: statusBgColor[risk.status],
        border: statusBorder[risk.status],
        borderRadius: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>{statusIcon[risk.status]}</span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: statusColor[risk.status],
            textTransform: "uppercase",
            letterSpacing: ".05em",
          }}
        >
          {risk.status}
        </span>
      </div>

      <div style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
          <div>
            <div style={{ color: "var(--t3)", fontSize: 11, marginBottom: 4 }}>Current Stock</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>
              {risk.current_stock} units
            </div>
          </div>
          <div>
            <div style={{ color: "var(--t3)", fontSize: 11, marginBottom: 4 }}>Daily Burn Rate</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>
              {risk.avg_daily_sales} units/day
            </div>
          </div>
        </div>

        <div
          style={{
            background: "var(--bg3)",
            padding: 10,
            borderRadius: 8,
            marginBottom: 10,
          }}
        >
          <div style={{ color: "var(--t3)", fontSize: 11, marginBottom: 6 }}>Days Until Stockout</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: statusColor[risk.status] }}>
            {risk.days_until_stockout} days
          </div>
        </div>

        <div style={{ color: statusColor[risk.status], fontSize: 12, fontWeight: 500 }}>
          {risk.recommendation}
        </div>
      </div>
    </div>
  );
}
