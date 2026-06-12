import { useEffect, useState } from "react";
import Select from "react-select";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend
} from "recharts";

function App() {
  const [data, setData] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [plans, setPlans] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    fetch("http://localhost:8000/report")
      .then(res => res.json())
      .then(res => {
        setTimeout(() => {
          setData(res);
          const first = res.products[0];
          setSelectedProducts([{
            value: first.product,
            label: `${first.product_name} (${first.category})`
          }]);
          setIsLoading(false);
        }, 800);
      });
  }, []);

  if (isLoading) return <SkeletonLoader darkMode={darkMode} />;

  const selectedIds = selectedProducts.map(p => p.value);

  // Chart data
  const chartData = Array.from({ length: 30 }, (_, i) => {
    let row = { day: `D${i + 1}` };
    selectedIds.forEach(id => {
      row[id] = data.forecasts[id]?.[i] || 0;
    });
    return row;
  });

  // Supply Plan
  const handleGeneratePlan = () => {
    let newPlans = {};

    selectedIds.forEach(id => {
      const p = data.products.find(x => x.product === id);
      const forecast = data.forecasts[id];

      const avg = forecast.reduce((a,b)=>a+b,0)/forecast.length;
      const stock = p.current_stock;
      const safety = avg * 1.2;

      let action, qty, risk;

      if (stock < safety) {
        action = "Increase Inventory";
        qty = Math.round(safety - stock);
        risk = "High demand expected";
      } else if (stock > avg * 1.5) {
        action = "Reduce Inventory";
        qty = 0;
        risk = "Overstock risk";
      } else {
        action = "Maintain Inventory";
        qty = 0;
        risk = "Stable demand";
      }

      newPlans[id] = { action, qty, stock, risk };
    });

    setPlans(newPlans);
  };

  // AI Insights
  const generateInsights = () => {
    let high = null, low = null, max=-Infinity, min=Infinity;

    selectedIds.forEach(id=>{
      const forecast = data.forecasts[id];
      const avg = forecast.reduce((a,b)=>a+b,0)/forecast.length;

      if(avg>max){ max=avg; high=id; }
      if(avg<min){ min=avg; low=id; }
    });

    return { high, low };
  };

  const insights = generateInsights();

  const bg = darkMode ? "#121212" : "#f4f6f8";
  const text = darkMode ? "#fff" : "#000";

  return (
    <div style={{ padding:20, background:bg, minHeight:"100vh", color:text }} className="fade-in">

      {/* HEADER */}
      <div style={{display:"flex", justifyContent:"space-between"}}>
        <h1>🚀 AI Supply Chain Dashboard</h1>
      </div>

      {/*SELECT */}
      <Select
        options={data.products.map(p => ({
          value: p.product,
          label: `${p.product_name} (${p.category})`
        }))}
        isMulti
        value={selectedProducts}
        onChange={(v)=>{
          setSelectedProducts(v || []);
          setPlans({});
        }}
      />

      {/*AI SUMMARY (BACK) */}
      <div className="card" style={{marginTop:20}}>
        <h2>🧠 AI Insights</h2>

        <p>
          ✅ Top Demand Product:{" "}
          <b>{data.products.find(p => p.product === insights.high)?.product_name}</b>
        </p>

        <p>
          📉 Lowest Demand Product:{" "}
          <b>{data.products.find(p => p.product === insights.low)?.product_name}</b>
        </p>

        <p>
          📦 Recommendation: Optimize inventory across high and low demand items.
        </p>
      </div>

      {/* PRODUCT CARDS */}
      <div className="grid">
        {selectedIds.map(id=>{
          const p = data.products.find(x=>x.product===id);
          return (
            <Card key={id}>
              <h3>{p.product} - {p.product_name}</h3>
              <p className="gray">{p.category}</p>
              <p><b>Current Stock:</b> {p.current_stock}</p>
            </Card>
          );
        })}
      </div>

      {/* CHART */}
      <div className="card">
        <h2>📈 Forecast</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid stroke="#ccc"/>
            <XAxis dataKey="day"/>
            <YAxis/>
            <Tooltip/>
            <Legend/>
            {selectedIds.map((id,i)=>(
              <Line key={id} dataKey={id} stroke={colors[i]} strokeWidth={3}/>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* INTERPRETATION */}
      <div className="grid">
        {selectedIds.map(id=>{
          const p = data.products.find(x=>x.product===id);
          return (
            <Card key={id}>
              <h3>{p.product_name}</h3>
              <ul>
                <li>{p.interpretation.accuracy}</li>
                <li>{p.interpretation.mae}</li>
                <li>{p.interpretation.mape}</li>
                <li>{p.interpretation.r2}</li>
              </ul>
            </Card>
          );
        })}
      </div>

      {/* BUTTON */}
      <div style={{textAlign:"center"}}>
        <button className="btn" onClick={handleGeneratePlan}>
          Generate AI Plan
        </button>
      </div>

      {/* SUPPLY PLAN */}
      <div className="grid">
        {Object.keys(plans).map(id=>{
          const p = data.products.find(x=>x.product===id);
          return (
            <Card key={id}>
              <h3>{p.product_name}</h3>
              <p><b>Stock:</b> {plans[id].stock}</p>
              <p><b>Action:</b> {plans[id].action}</p>
              <p><b>Qty:</b> {plans[id].qty}</p>
              <p><b>Risk:</b> {plans[id].risk}</p>
            </Card>
          );
        })}
      </div>

    </div>
  );
}

export default App;

////////////////////////
// COMPONENTS
////////////////////////

function Card({ children }) {
  return <div className="card">{children}</div>;
}

function SkeletonLoader({ darkMode }) {
  return (
    <div style={{padding:30}}>
      <h2>Loading AI Dashboard...</h2>
      <div className="grid">
        {[1,2,3,4].map(x=>(
          <div key={x} className="skeleton-card"></div>
        ))}
      </div>
    </div>
  );
}

////////////////////////
// STYLES
////////////////////////

const colors=["#007bff","#28a745","#ff5733","#6f42c1","#ffc107"];