"""
optimization_service.py — NEW service
Inventory + logistics optimization engine.
Balances cost, speed and service levels — recommends actions.
"""
import pandas as pd
import numpy as np


def calculate_eoq(avg_daily_demand, ordering_cost=500, holding_cost_pct=0.20, unit_cost=100):
    """
    Economic Order Quantity — optimal order size that minimises
    total ordering + holding cost.
    Formula: EOQ = sqrt(2 * D * S / H)
    D = annual demand, S = ordering cost, H = annual holding cost per unit
    """
    annual_demand = avg_daily_demand * 365
    holding_cost  = unit_cost * holding_cost_pct
    eoq = np.sqrt(2 * annual_demand * ordering_cost / (holding_cost + 1e-5))
    return max(1, round(eoq))


def classify_abc(products_data: list) -> dict:
    """
    ABC analysis — classifies SKUs by revenue contribution:
      A = top 20% SKUs driving 80% revenue
      B = next 30% SKUs
      C = remaining 50% SKUs
    """
    sorted_products = sorted(products_data, key=lambda x: x["revenue"], reverse=True)
    total_revenue   = sum(p["revenue"] for p in sorted_products)
    cumulative      = 0
    abc_map         = {}

    for p in sorted_products:
        cumulative += p["revenue"]
        pct = cumulative / total_revenue if total_revenue > 0 else 0
        if   pct <= 0.80: abc_map[p["product_id"]] = "A"
        elif pct <= 0.95: abc_map[p["product_id"]] = "B"
        else:             abc_map[p["product_id"]] = "C"

    return abc_map


UNIT_COST_MAP = {
    "Electronics": 350,
    "Grocery":     15,
    "Clothing":    45,
    "Pharma":      80,
    "Furniture":   200,
}

ORDERING_COST_MAP = {
    "Electronics": 800,
    "Grocery":     200,
    "Clothing":    350,
    "Pharma":      450,
    "Furniture":   600,
}


def optimize(df: pd.DataFrame, forecasts: dict) -> dict:
    """
    Main optimization function.
    Returns: per-product recommendations + system-level logistics suggestions.
    """
    recommendations = []
    products_abc    = []
    
    stock_df = pd.read_csv("backend/data/current_stock.csv")
    stock_map = dict(zip(stock_df["product_id"], stock_df["current_stock"]))


    for product_id in df["product_id"].unique():
        pdf      = df[df["product_id"] == product_id]
        pname    = pdf["product_name"].iloc[0]
        category = pdf["category"].iloc[0]
        # stock    = int(pdf["current_stock"].iloc[0])
        stock = stock_map.get(product_id, 0)
        # Compute stats
        avg_daily    = float(pdf["sales"].tail(30).mean())
        lead_time    = int(pdf["lead_time_days"].mean())
        uncertainty  = float(pdf["uncertainty"].mean())
        sup_disrupted= int(pdf["supplier_disruption"].sum() > 0)
        avg_supply   = float(pdf["supply_available"].mean())

        # Forecast-based demand
        forecast_30  = forecasts.get(product_id, [avg_daily]*30)
        forecast_avg = float(np.mean(forecast_30))
        forecast_total = float(np.sum(forecast_30))

        # Cost parameters
        unit_cost     = UNIT_COST_MAP.get(category, 100)
        ordering_cost = ORDERING_COST_MAP.get(category, 500)
        holding_pct   = 0.20 + uncertainty * 0.10  # higher uncertainty → higher holding cost weight

        # Safety stock with uncertainty buffer
        # Formula: SS = Z * sigma * sqrt(lead_time)
        # Z=1.65 for 95% service level
        std_demand   = float(pdf["sales"].tail(30).std())
        safety_stock = round(1.65 * std_demand * np.sqrt(lead_time) * (1 + uncertainty), 0)

        # Reorder point
        rop = round(avg_daily * lead_time + safety_stock, 0)

        # EOQ
        eoq = calculate_eoq(avg_daily, ordering_cost, holding_pct, unit_cost)

        # Days of stock remaining
        days_cover = stock / avg_daily if avg_daily > 0 else 999

        # Determine action
        overstock_threshold = avg_daily * 60  # 2 months

        if stock == 0:
            action      = "EMERGENCY_ORDER"
            action_label= "Emergency order"
            priority    = "critical"
            order_qty   = eoq * 2  # double EOQ for emergency
            cost_impact = order_qty * unit_cost
            speed_req   = "Air freight — within 48 hours"
            service_impact = "Stockout — 100% service level failure"
        elif stock < rop:
            action      = "REORDER_NOW"
            action_label= "Reorder now"
            priority    = "high"
            order_qty   = eoq
            cost_impact = order_qty * unit_cost
            speed_req   = "Express freight" if days_cover < 7 else "Standard freight"
            service_impact = f"Risk of stockout in {round(days_cover,1)} days"
        elif stock > overstock_threshold:
            action      = "REDUCE_INVENTORY"
            action_label= "Reduce inventory"
            priority    = "medium"
            order_qty   = 0
            cost_impact = -round((stock - overstock_threshold) * unit_cost * holding_pct, 0)  # saving
            speed_req   = "No urgent freight needed"
            service_impact = "Excess holding cost. Consider promotions or reallocation."
        else:
            action      = "MAINTAIN"
            action_label= "Maintain levels"
            priority    = "low"
            order_qty   = 0
            cost_impact = 0
            speed_req   = "Planned replenishment"
            service_impact = "Optimal. Continue monitoring."

        # Adjust for supplier disruption
        if sup_disrupted and order_qty > 0:
            order_qty = round(order_qty * (1 / (avg_supply + 1e-5)), 0)
            speed_req = "Multi-source — disruption active"

        # Revenue for ABC
        revenue = avg_daily * 365 * unit_cost
        products_abc.append({"product_id": product_id, "revenue": revenue})

        # Logistics recommendation
        if days_cover < 5:
            logistics_mode = "Air freight (urgent)"
        elif days_cover < lead_time:
            logistics_mode = "Express road/rail"
        else:
            logistics_mode = "Standard sea/road"

        # Cost breakdown
        annual_holding = round(stock * unit_cost * holding_pct, 0)
        order_cost_annual = round((avg_daily * 365 / (eoq + 1e-5)) * ordering_cost, 0)
        total_annual_cost = annual_holding + order_cost_annual

        recommendations.append({
            "product":            product_id,
            "product_name":       pname,
            "category":           category,
            "current_stock":      stock,
            "avg_daily_demand":   round(avg_daily, 1),
            "forecast_30d":       round(forecast_total, 0),
            "days_of_cover":      round(days_cover, 1),
            "lead_time_days":     lead_time,
            "safety_stock":       round(safety_stock, 0),
            "reorder_point":      round(rop, 0),
            "eoq":                eoq,
            "action":             action,
            "action_label":       action_label,
            "priority":           priority,
            "order_qty":          round(order_qty, 0),
            "unit_cost":          unit_cost,
            "order_value":        round(order_qty * unit_cost, 0),
            "cost_impact":        round(cost_impact, 0),
            "speed_requirement":  speed_req,
            "service_impact":     service_impact,
            "logistics_mode":     logistics_mode,
            "supplier_disrupted": bool(sup_disrupted),
            "uncertainty_level":  round(uncertainty, 3),
            "cost_breakdown": {
                "annual_holding_cost":  annual_holding,
                "annual_ordering_cost": order_cost_annual,
                "total_annual_cost":    total_annual_cost,
            }
        })

    # ABC classification
    abc_map = classify_abc(products_abc)
    for r in recommendations:
        r["abc_class"] = abc_map.get(r["product"], "C")

    # System-level logistics suggestions
    logistics_actions = []
    emergency = [r for r in recommendations if r["priority"] == "critical"]
    high_prio = [r for r in recommendations if r["priority"] == "high"]
    overstock = [r for r in recommendations if r["action"] == "REDUCE_INVENTORY"]

    if emergency:
        logistics_actions.append({
            "type":    "emergency",
            "message": f"URGENT: {len(emergency)} SKU(s) at zero stock — "
                       f"activate emergency air freight immediately.",
            "skus":    [r["product_name"] for r in emergency],
        })
    if high_prio:
        logistics_actions.append({
            "type":    "reorder",
            "message": f"{len(high_prio)} SKU(s) below reorder point — "
                       f"consolidate into one purchase order to save freight cost.",
            "skus":    [r["product_name"] for r in high_prio],
        })
    if overstock:
        logistics_actions.append({
            "type":    "overstock",
            "message": f"{len(overstock)} SKU(s) overstocked — "
                       f"run promotions or reallocate to high-demand regions.",
            "skus":    [r["product_name"] for r in overstock],
        })

    total_order_value = sum(r["order_value"] for r in recommendations)
    total_saving      = sum(-r["cost_impact"] for r in recommendations if r["cost_impact"] < 0)

    return {
        "recommendations": recommendations,
        "logistics_actions": logistics_actions,
        "summary": {
            "total_order_value":  round(total_order_value, 0),
            "potential_savings":  round(total_saving, 0),
            "critical_count":     len(emergency),
            "reorder_count":      len(high_prio),
            "overstock_count":    len(overstock),
            "abc_distribution":   {k: sum(1 for r in recommendations if r["abc_class"]==k)
                                    for k in ["A","B","C"]},
        }
    }
