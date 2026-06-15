"""
disruption_service.py — NEW service
Detects active and upcoming disruptions from sales_data.csv
Returns structured alerts with recommended actions
"""
import pandas as pd
import numpy as np
from datetime import date, timedelta

DISRUPTION_LABELS = {
    "port_congestion":       {"icon":"🚢", "title":"Port congestion",       "color":"amber"},
    "supplier_quality_hold": {"icon":"🔬", "title":"Supplier quality hold", "color":"red"},
    "raw_material_shortage": {"icon":"⛏️",  "title":"Raw material shortage", "color":"red"},
    "logistics_strike":      {"icon":"🚛", "title":"Logistics strike",      "color":"red"},
    "weather_disruption":    {"icon":"🌩️", "title":"Weather disruption",    "color":"amber"},
}

SPIKE_LABELS = {
    "viral_social_trend":   {"icon":"📱","title":"Viral demand spike"},
    "competitor_stockout":  {"icon":"🏪","title":"Competitor stockout"},
    "news_event_demand":    {"icon":"📰","title":"News-driven demand"},
    "flash_sale":           {"icon":"💸","title":"Flash sale spike"},
    "influencer_campaign":  {"icon":"🌟","title":"Influencer campaign"},
}

ACTION_MAP = {
    "port_congestion":        ["Switch to air freight for critical SKUs",
                               "Activate safety stock buffer (7-day cover)",
                               "Alert sales team of potential delays"],
    "supplier_quality_hold":  ["Halt incoming shipment — quarantine batch",
                               "Issue Supplier Corrective Action (SCAR)",
                               "Source emergency alternate supplier"],
    "raw_material_shortage":  ["Pre-order from secondary suppliers now",
                               "Prioritize production for high-margin SKUs",
                               "Communicate ETA delay to customers"],
    "logistics_strike":       ["Reroute via alternate carrier (DHL/FedEx)",
                               "Pre-ship 2 weeks of stock before strike",
                               "Negotiate spot rates immediately"],
    "weather_disruption":     ["Monitor 72-hour weather forecast daily",
                               "Increase safety stock by 20% in affected region",
                               "Coordinate with 3PL for contingency routing"],
}

SPIKE_ACTION_MAP = {
    "viral_social_trend":  ["Trigger emergency replenishment order",
                             "Reallocate stock from low-velocity regions",
                             "Enable backorder with committed lead time"],
    "competitor_stockout": ["Capture demand — increase visible stock levels",
                             "Run targeted ads in competitor's regions",
                             "Negotiate priority production slot with supplier"],
    "news_event_demand":   ["Monitor social signals for demand duration",
                             "Adjust safety stock upward for 2 weeks",
                             "Communicate proactively with key accounts"],
    "flash_sale":          ["Pre-position stock at distribution centres",
                             "Ensure fulfillment SLA agreements are in place",
                             "Alert warehouse for surge staffing"],
    "influencer_campaign": ["Track sell-through velocity hourly",
                             "Set max-order limits to prevent hoarding",
                             "Prepare next batch reorder within 48 hours"],
}


def detect_disruptions(df: pd.DataFrame) -> dict:
    """
    Analyses the sales CSV to find:
    1. Active supplier disruptions
    2. Upcoming events in next 30 days
    3. Demand uncertainty alerts
    4. Inventory risk by product
    """
    today     = pd.Timestamp(date.today())
    horizon   = today + pd.Timedelta(days=30)
    alerts    = []
    warnings  = []
    risk_map  = {}
    
    stock_df = pd.read_csv("backend/data/current_stock.csv")
    stock_map = dict(zip(stock_df["product_id"], stock_df["current_stock"]))
    

    for product_id in df["product_id"].unique():
        pdf = df[df["product_id"] == product_id].copy()
        pdf["date"] = pd.to_datetime(pdf["date"])
        pname    = pdf["product_name"].iloc[0]
        category = pdf["category"].iloc[0]
        # stock    = int(pdf["current_stock"].iloc[0])
        stock = stock_map.get(product_id, 0)
        # ── 1. Active supplier disruptions ──
        active_dis = pdf[
            (pdf["supplier_disruption"] == 1) &
            (pdf["date"] >= today - pd.Timedelta(days=14)) &
            (pdf["date"] <= today + pd.Timedelta(days=7))
        ]
        if len(active_dis) > 0:
            row     = active_dis.iloc[0]
            dtype   = row["disruption_type"]
            sev     = float(row["disruption_severity"])
            meta    = DISRUPTION_LABELS.get(dtype, {"icon":"⚠️","title":dtype,"color":"amber"})
            actions = ACTION_MAP.get(dtype, ["Review supply chain immediately"])
            alerts.append({
                "id":            f"{product_id}_dis",
                "type":          "supplier_disruption",
                "severity":      "critical" if sev >= 0.7 else "high" if sev >= 0.5 else "medium",
                "icon":          meta["icon"],
                "title":         meta["title"],
                "product":       product_id,
                "product_name":  pname,
                "category":      category,
                "description":   f"{pname} supply impacted. Severity: {int(sev*100)}%. "
                                 f"Lead time extended to {int(row['lead_time_days'])} days. "
                                 f"Supply availability: {int(float(row['supply_available'])*100)}%.",
                "financial_impact": int(stock * sev * 150),
                "lead_time_days": int(row["lead_time_days"]),
                "supply_pct":     int(float(row["supply_available"]) * 100),
                "actions":        actions,
                "color":          meta["color"],
            })

        # ── 2. Demand spikes ──
        spikes = pdf[
            (pdf["demand_spike"] == 1) &
            (pdf["date"] >= today - pd.Timedelta(days=7)) &
            (pdf["date"] <= today + pd.Timedelta(days=7))
        ]
        if len(spikes) > 0:
            row    = spikes.iloc[0]
            reason = row["demand_spike_reason"]
            meta   = SPIKE_LABELS.get(reason, {"icon":"📈","title":"Demand spike"})
            actions = SPIKE_ACTION_MAP.get(reason, ["Monitor and respond"])
            alerts.append({
                "id":           f"{product_id}_spike",
                "type":         "demand_spike",
                "severity":     "high",
                "icon":         meta["icon"],
                "title":        meta["title"],
                "product":      product_id,
                "product_name": pname,
                "category":     category,
                "description":  f"Unusual demand surge detected for {pname}. "
                                f"Trigger: {reason.replace('_',' ')}. "
                                f"Current stock may not cover next 7 days.",
                "financial_impact": int(stock * 0.3 * 200),
                "lead_time_days": int(pdf["lead_time_days"].mean()),
                "supply_pct":     100,
                "actions":        actions,
                "color":          "amber",
            })

        # ── 3. Inventory risk ──
        avg_sales    = float(pdf["sales"].tail(30).mean())
        lead_time    = int(pdf["lead_time_days"].mean())
        safety_stock = avg_sales * lead_time * 0.25
        days_of_cover= stock / avg_sales if avg_sales > 0 else 99
        uncertainty  = float(pdf["uncertainty"].mean())

        if days_of_cover < lead_time:
            status = "critical"
        elif days_of_cover < lead_time * 1.5:
            status = "low"
        elif stock > avg_sales * 45:
            status = "overstock"
        else:
            status = "healthy"

        risk_map[product_id] = {
            "product":        product_id,
            "product_name":   pname,
            "category":       category,
            "current_stock":  stock,
            "avg_daily_sales": round(avg_sales, 1),
            "days_of_cover":  round(days_of_cover, 1),
            "lead_time_days": lead_time,
            "safety_stock":   round(safety_stock, 0),
            "uncertainty":    round(uncertainty, 3),
            "status":         status,
            "reorder_qty":    max(0, round(avg_sales * 30 + safety_stock - stock, 0)),
        }

    # ── 4. Summary ──
    total_impact = sum(a["financial_impact"] for a in alerts)
    by_sev = {
        "critical": sum(1 for a in alerts if a["severity"] == "critical"),
        "high":     sum(1 for a in alerts if a["severity"] == "high"),
        "medium":   sum(1 for a in alerts if a["severity"] == "medium"),
    }

    return {
        "alerts":       alerts,
        "inventory_risk": list(risk_map.values()),
        "summary": {
            "total_alerts":       len(alerts),
            "by_severity":        by_sev,
            "total_financial_impact": total_impact,
            "critical_products":  [r["product_name"] for r in risk_map.values() if r["status"]=="critical"],
            "overstock_products": [r["product_name"] for r in risk_map.values() if r["status"]=="overstock"],
        }
    }
