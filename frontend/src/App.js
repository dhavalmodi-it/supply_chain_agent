import { useEffect, useState, useRef } from "react";
import Select from "react-select";
// NEW — removed unused imports
import {
  XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Legend, AreaChart, Area,
  BarChart, Bar, Cell
} from "recharts";
import EventBadges from "./EventBadges";
import FeaturesUsed from "./FeaturesUsed";
import StockoutRisk from "./StockoutRisk";
import DisruptionPanel  from "./DisruptionPanel";
import OptimizationPanel from "./OptimizationPanel";
import "./index.css";


// ─── Constants ────────────────────────────────────────────
const COLORS = ["#3878ff","#00e08a","#ff3d5a","#9b72ff","#ffb020","#00d4ff","#ff5ca8"];

const RISK_MAP = {
  "High demand expected":  { label:"High Risk",  cls:"badge-red"    },
  "Overstock risk":        { label:"Overstock",  cls:"badge-amber"  },
  "Stable demand":         { label:"Stable",     cls:"badge-green"  },
};

// ─── Custom Tooltip ───────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background:"#0f192d", border:"1px solid rgba(56,120,255,.25)",
      borderRadius:10, padding:"10px 14px", fontSize:12
    }}>
      <div style={{ color:"#7a90b8", marginBottom:6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display:"flex", gap:8, alignItems:"center", marginBottom:2 }}>
          <span style={{ width:8, height:8, borderRadius:2, background:p.color, display:"inline-block" }}/>
          <span style={{ color:"#7a90b8" }}>{p.dataKey}:</span>
          <span style={{ color:"#dce8ff", fontFamily:"var(--mono)", fontWeight:500 }}>{Math.round(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── KPI Card ─────────────────────────────────────────────
function KPICard({ title, value, sub, accent, icon }) {
  return (
    <div className="card card-glow fade-up" style={{ padding:"18px 20px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <div style={{ fontSize:11, color:"var(--t3)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>{title}</div>
          <div className="count" style={{ fontSize:28, fontWeight:700, color: accent || "var(--t1)", fontFamily:"var(--mono)", lineHeight:1 }}>{value}</div>
          {sub && <div style={{ fontSize:11, color:"var(--t2)", marginTop:6 }}>{sub}</div>}
        </div>
        <div style={{
          width:38, height:38, borderRadius:10,
          background: `rgba(${accent === "var(--green)" ? "0,224,138" : accent === "var(--red)" ? "255,61,90" : "56,120,255"},.12)`,
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0
        }}>{icon}</div>
      </div>
    </div>
  );
}

// ─── Metric Row ───────────────────────────────────────────
function MetricRow({ label, value, color }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:"1px solid var(--b0)" }}>
      <span style={{ fontSize:12, color:"var(--t2)" }}>{label}</span>
      <span style={{ fontSize:12, fontFamily:"var(--mono)", fontWeight:500, color: color || "var(--t1)" }}>{value}</span>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────
function SkeletonLoader() {
  return (
    <div className="grid-bg" style={{ minHeight:"100vh", padding:"32px 40px" }}>
      {/* header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:32 }}>
        <div className="skeleton" style={{ width:40, height:40, borderRadius:10 }}/>
        <div>
          <div className="skeleton" style={{ width:260, height:18, marginBottom:8 }}/>
          <div className="skeleton" style={{ width:160, height:12 }}/>
        </div>
      </div>
      {/* kpi row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 }}>
        {[...Array(4)].map((_,i) => (
          <div key={i} className="card" style={{ padding:20 }}>
            <div className="skeleton" style={{ width:"60%", height:12, marginBottom:12 }}/>
            <div className="skeleton" style={{ width:"40%", height:28 }}/>
          </div>
        ))}
      </div>
      {/* chart placeholder */}
      <div className="card" style={{ height:280 }}>
        <div className="skeleton" style={{ width:"30%", height:14, marginBottom:16 }}/>
        <div className="skeleton" style={{ width:"100%", height:220 }}/>
      </div>
      <div style={{ textAlign:"center", marginTop:40, color:"var(--t3)", fontSize:13 }}>
        <div className="pulse" style={{ margin:"0 auto 12px" }}/>
        Training XGBoost models on your data…
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────
function App() {
  const [data,             setData]             = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [plans,            setPlans]            = useState({});
  const [isLoading,        setIsLoading]        = useState(true);
  const [activeTab,        setActiveTab]        = useState("forecast");
  const [trainTime,        setTrainTime]        = useState(null);
  const t0 = useRef(Date.now());
  const [horizon, setHorizon] = useState(30);

  // ── Fetch — unchanged from your original ──
  useEffect(() => {
    t0.current = Date.now();
    fetch(`http://localhost:8000/report?horizon=${horizon}`)
      .then(r => r.json())
      .then(res => {
        setTimeout(() => {
          setData(res);
          const first = res.products[0];
          setSelectedProducts([{
            value: first.product,
            label: `${first.product_name} (${first.category})`
          }]);
          setTrainTime(((Date.now() - t0.current) / 1000).toFixed(1));
          setIsLoading(false);
        }, 800);
      });
  }, []);

  if (isLoading) return <SkeletonLoader />;

  const selectedIds = selectedProducts.map(p => p.value);

  // ── Chart data — same logic as original ──
  const chartData = Array.from({ length: horizon }, (_, i) => {
    let row = { day: `D${i + 1}` };
    selectedIds.forEach(id => { row[id] = Math.round(data.forecasts[id]?.[i] || 0); });
    return row;
  });
  

  // ── Supply plan — same logic as original ──
  const handleGeneratePlan = () => {
    let newPlans = {};
    selectedIds.forEach(id => {
      const p        = data.products.find(x => x.product === id);
      const forecast = data.forecasts[id];
      const avg      = forecast.reduce((a,b)=>a+b,0) / forecast.length;
      // console.log("avg",avg);
      const stock    = p.current_stock;
      const safety   = avg * 30;
      let action, qty, risk;
      if (stock < safety) {
        action = "Increase Inventory"; qty = Math.round(safety - stock); risk = "High demand expected";
      } else if (stock > safety * 1.5) {
        action = "Reduce Inventory";  qty = 0; risk = "Overstock risk";
      } else {
        action = "Maintain Inventory"; qty = 0; risk = "Stable demand";
      }
      newPlans[id] = { action, qty, stock, risk };
    });
    setPlans(newPlans);
  };

  // ── AI Insights — same logic as original ──
  const generateInsights = () => {
    let high=null, low=null, maxAvg=-Infinity, minAvg=Infinity;
    selectedIds.forEach(id => {
      const avg = data.forecasts[id].reduce((a,b)=>a+b,0) / data.forecasts[id].length;
      if (avg > maxAvg) { maxAvg=avg; high=id; }
      if (avg < minAvg) { minAvg=avg; low=id; }
    });
    return { high, low, maxAvg, minAvg };
  };
  const insights = generateInsights();

  // ── Derived summary stats ──
  const totalStock   = data.products.reduce((s,p) => s+p.current_stock, 0);
  const avgAccuracy  = (data.products.reduce((s,p) => s+p.metrics.Accuracy,0) / data.products.length).toFixed(1);
  const highRiskCount= selectedIds.filter(id => {
    const p=data.products.find(x=>x.product===id);
    const avg=data.forecasts[id].reduce((a,b)=>a+b,0)/data.forecasts[id].length;
    return p.current_stock < avg*1.2;
  }).length;

  

  // ── Bar chart for accuracy ──
  const accuracyBar = data.products.map((p,i) => ({
    name: p.product_name.length>12 ? p.product_name.slice(0,12)+"…" : p.product_name,
    accuracy: parseFloat(p.metrics.Accuracy.toFixed(1)),
    color: COLORS[i % COLORS.length]
  }));


  return (
    <div className="grid-bg" style={{ minHeight:"100vh", background:"var(--bg0)" }}>
      {/* ══ SIDEBAR ══════════════════════════════════════ */}
      <div style={{
        position:"fixed", left:0, top:0, bottom:0, width:220,
        background:"var(--bg1)", borderRight:"1px solid var(--b0)",
        display:"flex", flexDirection:"column", zIndex:100, padding:"24px 0"
      }}>
        {/* Logo */}
        <div style={{ padding:"0 20px 24px", borderBottom:"1px solid var(--b0)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{
              width:36, height:36, borderRadius:9,
              background:"linear-gradient(135deg,#3878ff,#9b72ff)",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:18
            }}>⛓</div>
            <div>
              <div style={{ fontWeight:700, fontSize:13, color:"var(--t1)" }}>SupplyMind</div>
              <div style={{ fontSize:10, color:"var(--t3)", fontFamily:"var(--mono)" }}>AI AGENT v2.0</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:"16px 10px" }}>
          {[
            { key:"forecast", icon:"📈", label:"Demand Forecast" },
            { key:"accuracy", icon:"🎯", label:"Model Accuracy"  },
            { key:"supply",   icon:"📦", label:"Supply Plan"     },
            { key:"model",    icon:"🧠", label:"Model Details"   },
            { key:"disruptions", icon:"⚠️", label:"Disruptions"},
            { key:"optimize",    icon:"⚡", label:"Optimize" },
          ].map(item => (
            <button key={item.key} onClick={() => setActiveTab(item.key)} style={{
              width:"100%", display:"flex", alignItems:"center", gap:9,
              padding:"9px 12px", borderRadius:8, marginBottom:2, border:"none",
              background: activeTab===item.key ? "rgba(56,120,255,.12)" : "transparent",
              color: activeTab===item.key ? "var(--blue)" : "var(--t2)",
              fontSize:13, fontWeight: activeTab===item.key ? 600 : 400,
              cursor:"pointer", transition:"all .15s", textAlign:"left",
              outline: activeTab===item.key ? "1px solid rgba(56,120,255,.2)" : "none"
            }}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Status */}
        <div style={{ padding:"16px 20px", borderTop:"1px solid var(--b0)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
            <div className="pulse"/>
            <span style={{ fontSize:11, color:"var(--t3)", fontFamily:"var(--mono)" }}>Backend live</span>
          </div>
          <div style={{ fontSize:10, color:"var(--t3)" }}>
            {data.products.length} products · {trainTime}s train
          </div>
        </div>
      </div>

      {/* ══ MAIN ═════════════════════════════════════════ */}
      <div style={{ marginLeft:220, padding:"28px 32px", minHeight:"100vh" }}>

        {/* ── Top bar ── */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          marginBottom:24, paddingBottom:20, borderBottom:"1px solid var(--b0)"
        }}>
          <div>
            <h1 style={{ fontSize:20, fontWeight:700, marginBottom:2 }}>
              {{ forecast:"Demand Forecast", accuracy:"Model Accuracy", supply:"Supply Plan", model:"Model Details" }[activeTab]}
            </h1>
            <p style={{ fontSize:12, color:"var(--t3)" }}>
              XGBoost · {data.products.length} products · {new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}
            </p>
          </div>

          {/* Product selector */}
          <div style={{ width:360 }}>
            <Select
              classNamePrefix="rs"
              options={data.products.map(p => ({
                value: p.product,
                label: `${p.product_name} (${p.category})`
              }))}
              isMulti
              value={selectedProducts}
              onChange={v => { setSelectedProducts(v || []); setPlans({}); }}
              placeholder="Select products…"
            />
          </div>
        </div>

        {/* ── KPI row — always visible ── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:24 }}>
          <KPICard title="Model Accuracy"  value={`${avgAccuracy}%`} accent="var(--green)"  icon="🎯" sub="Avg across all products" />
          <KPICard title="Total Stock"     value={totalStock.toLocaleString()} icon="📦" sub="Units across all SKUs" />
          <KPICard title="High Risk SKUs"  value={highRiskCount} accent={highRiskCount>0?"var(--red)":"var(--green)"} icon="⚠️" sub="Need immediate reorder" />
          <KPICard title="Products"        value={data.products.length} icon="🏷️" accent="var(--purple)" sub={`${selectedIds.length} selected`} />
        </div>

        {/* ════════════════════════════════════════════════
            TAB: FORECAST
        ════════════════════════════════════════════════ */}
        {activeTab === "forecast" && (
          <div className="fade-up">
            {/* AI Insights banner */}
            <div className="card" style={{
              marginBottom:16, padding:"16px 20px",
              background:"linear-gradient(135deg, rgba(56,120,255,.08), rgba(155,114,255,.06))",
              border:"1px solid rgba(56,120,255,.2)"
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                <span style={{ fontSize:14 }}>🧠</span>
                <span style={{ fontWeight:600, fontSize:14 }}>AI Insights</span>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
                <div style={{ fontSize:13, color:"var(--t2)" }}>
                  <span style={{ color:"var(--green)", fontWeight:600 }}>↑ Top demand: </span>
                  {data.products.find(p=>p.product===insights.high)?.product_name || "—"}
                  <span style={{ color:"var(--t3)", fontSize:11 }}> · avg {Math.round(insights.maxAvg)} units/day</span>
                </div>
                <div style={{ fontSize:13, color:"var(--t2)" }}>
                  <span style={{ color:"var(--amber)", fontWeight:600 }}>↓ Low demand: </span>
                  {data.products.find(p=>p.product===insights.low)?.product_name || "—"}
                  <span style={{ color:"var(--t3)", fontSize:11 }}> · avg {Math.round(insights.minAvg)} units/day</span>
                </div>
                <div style={{ fontSize:13, color:"var(--t2)" }}>
                  <span style={{ color:"var(--blue)", fontWeight:600 }}>📦 Recommendation: </span>
                  Optimize inventory across high and low demand items.
                </div>
              </div>
            </div>

            {/* Main forecast chart */}
            <div className="card" style={{ marginBottom:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:14 }}>30-Day Demand Forecast</div>
                  <div style={{ fontSize:11, color:"var(--t3)", marginTop:2 }}>XGBoost autoregressive prediction · confidence band shown</div>
                </div>
                <span className="badge badge-blue">Next 30 days</span>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData}>
                  <defs>
                    {selectedIds.map((id,i) => (
                      <linearGradient key={id} id={`g${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={COLORS[i%COLORS.length]} stopOpacity={0.18}/>
                        <stop offset="95%" stopColor={COLORS[i%COLORS.length]} stopOpacity={0}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                  <XAxis dataKey="day" tick={{fill:"#3d5070",fontSize:10}} tickLine={false} axisLine={false}/>
                  <YAxis tick={{fill:"#3d5070",fontSize:10}} tickLine={false} axisLine={false}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Legend wrapperStyle={{fontSize:12,color:"#7a90b8"}}/>
                  {selectedIds.map((id,i) => (
                    <Area key={id} type="monotone" dataKey={id}
                      stroke={COLORS[i%COLORS.length]} strokeWidth={2.5}
                      fill={`url(#g${i})`} dot={false}/>
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Product cards */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:12 }}>
              {selectedIds.map((id,i) => {
                const p   = data.products.find(x=>x.product===id);
                const avg = Math.round(data.forecasts[id].reduce((a,b)=>a+b,0)/30);
                const total = Math.round(data.forecasts[id].reduce((a,b)=>a+b,0));
                return (
                  <div key={id} className="card fade-up" style={{
                    borderLeft:`3px solid ${COLORS[i%COLORS.length]}`
                  }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                      <div>
                        <div style={{ fontWeight:600, fontSize:14 }}>{p.product_name}</div>
                        <div style={{ fontSize:11, color:"var(--t3)", marginTop:2 }}>{p.product} · {p.category}</div>
                      </div>
                      {/* <FeaturesUsed product={p} /> */}
                      <span className="badge badge-blue" style={{ fontSize:10 }}>{p.metrics.Accuracy.toFixed(0)}%</span>
                    </div>
                    <MetricRow label="Current Stock" value={p.current_stock.toLocaleString()} />
                    <MetricRow label="Avg Daily Forecast" value={`${avg} units`} color="var(--blue)" />
                    <MetricRow label="30-Day Total"  value={`${total.toLocaleString()} units`} color="var(--cyan)" />
                    <EventBadges product={p} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            TAB: ACCURACY
        ════════════════════════════════════════════════ */}
        {activeTab === "accuracy" && (
          <div className="fade-up">
            {/* Accuracy bar chart */}
            <div className="card" style={{ marginBottom:16 }}>
              <div style={{ fontWeight:600, fontSize:14, marginBottom:4 }}>Model Accuracy by Product</div>
              <div style={{ fontSize:11, color:"var(--t3)", marginBottom:18 }}>XGBoost test-set evaluation — 80/20 train/test split</div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={accuracyBar} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                  <XAxis dataKey="name" tick={{fill:"#3d5070",fontSize:11}} tickLine={false} axisLine={false}/>
                  <YAxis domain={[0,100]} tick={{fill:"#3d5070",fontSize:10}} tickLine={false} axisLine={false}
                    tickFormatter={v=>`${v}%`}/>
                  <Tooltip content={<CustomTooltip/>} formatter={v=>`${v}%`}/>
                  <Bar dataKey="accuracy" radius={[6,6,0,0]}>
                    {accuracyBar.map((entry,i) => (
                      <Cell key={i} fill={entry.accuracy>=80?"#00e08a":entry.accuracy>=60?"#ffb020":"#ff3d5a"}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Metrics cards */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:12 }}>
              {selectedIds.map((id,i) => {
                const p = data.products.find(x=>x.product===id);
                const acc = p.metrics.Accuracy;
                const accColor = acc>=80?"var(--green)":acc>=60?"var(--amber)":"var(--red)";
                return (
                  <div key={id} className="card fade-up">
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
                      <div>
                        <div style={{ fontWeight:600 }}>{p.product_name}</div>
                        <div style={{ fontSize:11, color:"var(--t3)" }}>{p.category}</div>
                      </div>
                      <div style={{
                        fontSize:22, fontWeight:700, color:accColor, fontFamily:"var(--mono)"
                      }}>{acc.toFixed(1)}%</div>
                    </div>
                    {/* accuracy bar */}
                    <div style={{ height:4, background:"var(--bg4)", borderRadius:4, marginBottom:14, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${Math.min(acc,100)}%`, background:accColor, borderRadius:4, transition:"width .8s ease" }}/>
                    </div>
                    <MetricRow label="MAE (avg error)"  value={`${p.metrics.MAE.toFixed(1)} units`}  color="var(--t1)" />
                    <MetricRow label="MAPE (% error)"   value={`${p.metrics.MAPE.toFixed(1)}%`}       color={accColor}  />
                    <MetricRow label="R² Score"         value={p.metrics.R2 < 0 ? "Unstable" : p.metrics.R2.toFixed(3)} color={p.metrics.R2>=0?"var(--cyan)":"var(--red)"} />
                    <div style={{ marginTop:10, padding:"8px 10px", background:"var(--bg3)", borderRadius:8, fontSize:11, color:"var(--t2)", lineHeight:1.6 }}>
                      {p.interpretation.r2}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            TAB: SUPPLY PLAN
        ════════════════════════════════════════════════ */}
        {activeTab === "supply" && (
          <div className="fade-up">
            <div style={{ marginBottom:16, display:"flex", justifyContent:"flex-end" }}>
              <button onClick={handleGeneratePlan} style={{
                padding:"10px 24px", borderRadius:10, border:"none",
                background:"linear-gradient(135deg,#3878ff,#9b72ff)",
                color:"#fff", fontWeight:600, fontSize:14, cursor:"pointer",
                boxShadow:"0 4px 20px rgba(56,120,255,.3)", transition:"opacity .15s"
              }}
                onMouseOver={e=>e.target.style.opacity=.85}
                onMouseOut={e=>e.target.style.opacity=1}
              >
                ⚡ Generate AI Supply Plan
              </button>
            </div>

            {Object.keys(plans).length === 0 ? (
              <div className="card" style={{ textAlign:"center", padding:"48px 20px", color:"var(--t3)" }}>
                <div style={{ fontSize:32, marginBottom:12 }}>📦</div>
                <div style={{ fontWeight:600, marginBottom:6 }}>No supply plan generated yet</div>
                <div style={{ fontSize:12 }}>Click the button above to generate AI-powered recommendations</div>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:14 }}>
                {Object.keys(plans).map(id => {
                  const p    = data.products.find(x=>x.product===id);
                  const plan = plans[id];
                  const riskInfo = RISK_MAP[plan.risk] || { label:plan.risk, cls:"badge-blue" };
                  const actionColor = plan.action==="Increase Inventory"?"var(--red)": plan.action==="Reduce Inventory"?"var(--amber)":"var(--green)";
                  const forecast30  = Math.round(data.forecasts[id].reduce((a,b)=>a+b,0));
                  const avgDaily    = Math.round(forecast30/30);
                  return (
                    <div key={id} className="card fade-up" style={{
                      borderTop:`3px solid ${actionColor}`
                    }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
                        <div>
                          <div style={{ fontWeight:600, fontSize:14 }}>{p.product_name}</div>
                          <div style={{ fontSize:11, color:"var(--t3)", marginTop:2 }}>{p.product} · {p.category}</div>
                        </div>
                        <span className={`badge ${riskInfo.cls}`}>{riskInfo.label}</span>
                      </div>
                      <MetricRow label="Current Stock"   value={plan.stock.toLocaleString()} />
                      <MetricRow label="30-Day Forecast" value={`${forecast30.toLocaleString()} units`} color="var(--cyan)" />
                      <MetricRow label="Avg Daily Need"  value={`${avgDaily} units/day`} />
                      <MetricRow label="Recommended Qty" value={plan.qty > 0 ? `+${plan.qty.toLocaleString()}` : "No order needed"} color={plan.qty>0?"var(--red)":"var(--green)"} />
                      <div style={{ marginTop:12, padding:"10px 12px", borderRadius:8, background: actionColor==="var(--red)"?"rgba(255,61,90,.08)":actionColor==="var(--amber)"?"rgba(255,176,32,.08)":"rgba(0,224,138,.08)", border:`1px solid ${actionColor}33` }}>
                        <div style={{ fontSize:12, fontWeight:600, color:actionColor }}>Action: {plan.action}</div>
                        <div style={{ fontSize:11, color:"var(--t2)", marginTop:3 }}>
                          {plan.action==="Increase Inventory" ? `Order ${plan.qty} units before stockout.` :
                           plan.action==="Reduce Inventory"   ? "Consider promotions to clear excess stock." :
                           "Current stock level is optimal. Monitor weekly."}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════
            TAB: MODEL DETAILS
        ════════════════════════════════════════════════ */}
        {activeTab === "model" && (
          <div className="fade-up">
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
              {/* Model spec */}
              <div className="card">
                <div style={{ fontWeight:600, fontSize:14, marginBottom:16 }}>🧠 Model Architecture</div>
                {[
                  ["Algorithm",      "XGBoost Regressor"],
                  ["Estimators",     "300 trees"],
                  ["Learning rate",  "0.05"],
                  ["Max depth",      "6"],
                  ["Subsample",      "80%"],
                  ["Feature sample", "80%"],
                  ["Sequence length","7 days lookback"],
                  ["Split strategy", "80% train / 20% test (no shuffle)"],
                ].map(([k,v]) => <MetricRow key={k} label={k} value={v} />)}
              </div>
              {/* Feature explanation */}
              <div className="card">
                <div style={{ fontWeight:600, fontSize:14, marginBottom:16 }}>⚙️ Feature Engineering</div>
                {[
                  ["Input type",  "Time-series sequences (lag features)"],
                  ["Scaler",      "MinMaxScaler (0–1 range)"],
                  ["Lag window",  "7 days rolling window"],
                  ["Target",      "Next-day sales volume"],
                  ["Forecast",    "Autoregressive (30 steps)"],
                  ["Loss metric", "MAE + MAPE"],
                  ["Framework",   "scikit-learn + XGBoost"],
                  ["Objective",   "reg:squarederror"],
                ].map(([k,v]) => <MetricRow key={k} label={k} value={v} />)}
              </div>
            </div>

            {/* All products accuracy table */}
            <div className="card">
              <div style={{ fontWeight:600, fontSize:14, marginBottom:16 }}>📊 All Products — Full Evaluation Report</div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                  <thead>
                    <tr style={{ borderBottom:"1px solid var(--b1)" }}>
                      {["Product","Name","Category","Stock","Accuracy","MAE","MAPE","R²","Status"].map(h => (
                        <th key={h} style={{ padding:"8px 12px", textAlign:"left", color:"var(--t3)", fontWeight:500, fontSize:11, textTransform:"uppercase", letterSpacing:".04em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.products.map((p,i) => {
                      const acc = p.metrics.Accuracy;
                      const accColor = acc>=80?"var(--green)":acc>=60?"var(--amber)":"var(--red)";
                      const status = acc>=80?"Excellent":acc>=60?"Good":"Needs data";
                      const statusCls = acc>=80?"badge-green":acc>=60?"badge-amber":"badge-red";
                      return (
                        <tr key={p.product} style={{ borderBottom:"1px solid var(--b0)", transition:"background .1s" }}
                          onMouseEnter={e=>e.currentTarget.style.background="var(--bg3)"}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{ padding:"10px 12px", fontFamily:"var(--mono)", color:"var(--t3)", fontSize:11 }}>{p.product}</td>
                          <td style={{ padding:"10px 12px", fontWeight:500 }}>{p.product_name}</td>
                          <td style={{ padding:"10px 12px", color:"var(--t2)" }}>{p.category}</td>
                          <td style={{ padding:"10px 12px", fontFamily:"var(--mono)" }}>{p.current_stock.toLocaleString()}</td>
                          <td style={{ padding:"10px 12px", fontFamily:"var(--mono)", color:accColor, fontWeight:600 }}>{acc.toFixed(1)}%</td>
                          <td style={{ padding:"10px 12px", fontFamily:"var(--mono)" }}>{p.metrics.MAE.toFixed(1)}</td>
                          <td style={{ padding:"10px 12px", fontFamily:"var(--mono)" }}>{p.metrics.MAPE.toFixed(1)}%</td>
                          <td style={{ padding:"10px 12px", fontFamily:"var(--mono)", color:p.metrics.R2>=0?"var(--cyan)":"var(--red)" }}>{p.metrics.R2 < 0 ? "—" : p.metrics.R2.toFixed(3)}</td>
                          <td style={{ padding:"10px 12px" }}><span className={`badge ${statusCls}`}>{status}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {activeTab === "disruptions" && <DisruptionPanel />}
        {activeTab === "optimize"    && <OptimizationPanel />}
      </div>
    </div>
  );
}

export default App;
