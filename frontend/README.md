# Supply Chain AI Agent — Enhanced v2

## What is new

| File | What it adds |
|---|---|
| generate_data.py | 21 columns: holidays, weekends, Black Friday, Diwali, supplier disruptions (5 types), demand spikes (5 types), competitor stockouts, price events, lead time variability, supply availability, uncertainty score |
| forecast_service.py | 15 features per time step (was 1). Same XGBoost, much richer input. Output format unchanged. |
| disruption_service.py | NEW — detects active alerts, inventory risk, recommends actions per disruption type |
| optimization_service.py | NEW — EOQ, safety stock (95% service level), ABC analysis, logistics mode recommendation |
| app.py | 3 new endpoints: /disruptions /optimize /full-report. Original /report unchanged. |
| DisruptionPanel.jsx | NEW React tab — expandable alert cards, inventory risk table |
| OptimizationPanel.jsx | NEW React tab — bar chart, recommendation cards, ABC breakdown |

## Run order
```cmd
# 1. Regenerate data with all new factors
python backend/generate_data.py

# 2. Restart backend
python -m uvicorn app:app --reload --port 8000

# 3. Test new endpoints
http://localhost:8000/disruptions
http://localhost:8000/optimize
http://localhost:8000/full-report

# 4. Frontend — add 2 imports + 2 nav items + 2 tab renders (see App_additions.md)
npm start
```

## New factors modelled

### Supply side
- Port congestion → extended lead time, reduced supply
- Supplier quality hold → halt + alternate source
- Raw material shortage → panic buying spike
- Logistics strike → reroute recommendation
- Weather disruption → safety stock increase

### Demand side
- Viral social trend → 1.8x spike
- Competitor stockout → demand shift
- News-driven demand → 2.1x spike
- Flash sale → 1.6x spike
- Influencer campaign → 1.9x spike

### Calendar events
- 15 Indian public holidays (sales drop 50-70%)
- Post-holiday recovery (+20% next day)
- Black Friday (2.2x electronics, 1.5x others)
- Black Friday pre-week (+10% per day)
- Diwali season Oct 15 - Nov 5 (1.2-1.4x)
- Weekend (0.60-0.70x)
- EBU bulk orders (Monday month-start, 1.4-1.6x)
- Price events every 63 days

### Optimization output
- EOQ (Economic Order Quantity) per product
- Safety stock at 95% service level (Z=1.65)
- Reorder point = avg demand × lead time + safety stock
- ABC classification (revenue-based)
- Days of cover vs lead time comparison
- Logistics mode (air/express/standard) based on urgency
- Annual holding + ordering cost breakdown
