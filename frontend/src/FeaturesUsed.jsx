/**
 * FeaturesUsed.jsx
 * Shows which AI features were used in the model — 
 * great for the Model Details tab and hackathon judges.
 * 
 * Usage:
 *   import FeaturesUsed from "./FeaturesUsed";
 *   <FeaturesUsed product={p} />
 */
const FEATURE_META = {
  sales_history:        { icon:"📈", label:"Sales history",         desc:"7-day rolling lag sequences" },
  weekend_pattern:      { icon:"📅", label:"Weekend pattern",       desc:"Sat/Sun demand drops 30-40%" },
  public_holidays:      { icon:"🏖️", label:"Public holidays",       desc:"15 Indian holidays modelled" },
  black_friday:         { icon:"🛒", label:"Black Friday",          desc:"2x-2.5x spike for electronics" },
  bulk_orders:          { icon:"🏢", label:"EBU bulk orders",       desc:"Enterprise order day detection" },
  diwali_season:        { icon:"🪔", label:"Diwali season",         desc:"Oct 15 – Nov 5 demand boost" },
  day_of_week:          { icon:"📆", label:"Day of week",           desc:"Mon-Fri vs weekend index" },
  monthly_seasonality:  { icon:"🗓️", label:"Monthly seasonality",   desc:"Q4 peaks, Jan-Feb troughs" },
};

export default function FeaturesUsed({ product }) {
  const features = product?.interpretation?.events?.features_used;
  if (!features?.length) return null;

  return (
    <div>
      <div style={{ fontSize:11, color:"var(--t3)", marginBottom:10, textTransform:"uppercase", letterSpacing:".05em" }}>
        Features used in this model
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        {features.map(f => {
          const meta = FEATURE_META[f] || { icon:"⚙️", label:f, desc:"" };
          return (
            <div key={f} style={{
              display:"flex", alignItems:"flex-start", gap:8,
              padding:"8px 10px", background:"var(--bg3)",
              borderRadius:8, fontSize:12
            }}>
              <span style={{ fontSize:16, flexShrink:0 }}>{meta.icon}</span>
              <div>
                <div style={{ fontWeight:500, color:"var(--t1)" }}>{meta.label}</div>
                <div style={{ fontSize:11, color:"var(--t3)" }}>{meta.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
