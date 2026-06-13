/**
 * EventBadges.jsx
 * Drop-in component — shows upcoming supply chain events
 * for a selected product in the Forecast tab.
 * 
 * Usage in App.js:
 *   import EventBadges from "./EventBadges";
 *   <EventBadges product={p} />
 */
export default function EventBadges({ product }) {
  const events = product?.interpretation?.events;
  if (!events) return null;

  const items = [
    events.holidays_in_forecast > 0 && {
      icon: "🏖️",
      label: `${events.holidays_in_forecast} holiday${events.holidays_in_forecast > 1 ? "s" : ""} ahead`,
      cls: "badge-amber",
      tip: "Expect demand drop. Safety stock recommended."
    },
    events.black_friday_in_window && {
      icon: "🛒",
      label: "Black Friday in window",
      cls: "badge-red",
      tip: "Expect 2x–2.5x demand spike. Pre-stock now."
    },
    events.bulk_order_days > 0 && {
      icon: "🏢",
      label: `${events.bulk_order_days} EBU order day${events.bulk_order_days > 1 ? "s" : ""}`,
      cls: "badge-purple",
      tip: "Enterprise bulk orders expected. Ensure B2B stock."
    },
  ].filter(Boolean);

  if (!items.length) return (
    <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:8 }}>
      <span className="badge badge-green">✓ No major events in forecast window</span>
    </div>
  );

  return (
    <div style={{ marginTop:10 }}>
      <div style={{ fontSize:11, color:"var(--t3)", marginBottom:6, textTransform:"uppercase", letterSpacing:".05em" }}>
        Upcoming signals
      </div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
        {items.map((item, i) => (
          <div key={i} title={item.tip} style={{ cursor:"help" }}>
            <span className={`badge ${item.cls}`}>
              {item.icon} {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
