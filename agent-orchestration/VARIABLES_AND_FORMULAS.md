# Supply Chain Resilience Agent — Variables & Formulas Reference

## 1. Agent Output Schema

These are the fields every analysis response must contain.

| Field | Type | Range | Description |
|---|---|---|---|
| `risk_score` | number | 1–100 | Overall disruption severity rating |
| `revenue_at_risk` | number | USD | Estimated financial exposure |
| `orders_affected` | number | — | Customer orders impacted |
| `sla_risk` | float | 0–∞ (multiplier) | SLA violation risk multiplier (e.g. 1.2x) |
| `stockout_probability` | float | 0–1 | Probability of inventory stockout |
| `explanation` | string | Markdown | Executive summary |
| `mitigation_options` | array | 3 items | Scored alternative actions |
| `actions` | object | — | Drafted supplier email, PO, escalation |
| `reasoning_trace` | array | 7+ steps | Step-by-step decision log |

---

## 2. Risk Scoring Thresholds

### Risk Label & Color

```
risk_score >= 75  →  Critical  →  Red
risk_score >= 50  →  High      →  Yellow
risk_score >= 30  →  Medium    →  Blue
risk_score <  30  →  Low       →  Green
```

### Disruption Severity (from CSV `severity` column)

```
severity = 0.80  →  'high'    (confidence ~0.90)
severity = 0.55  →  'medium'  (confidence ~0.70)
severity = 0.30  →  'low'     (confidence ~0.45)

Fallback:
  parseFloat(severity) >= 0.7  →  'high'
  parseFloat(severity) >= 0.4  →  'medium'
  parseFloat(severity) <  0.4  →  'low'
```

---

## 3. Mitigation Option Scoring

### Required Fields per Option

| Field | Type | Description |
|---|---|---|
| `option` | string | Name of strategy |
| `cost` | number (USD) | Direct implementation cost |
| `cost_avoidance` | number (USD) | Estimated savings / avoided loss |
| `service_score` | float 0–1 | Service level maintenance metric |
| `resilience_score` | float 0–1 | Long-term resilience gain |
| `final_score` | float 0–1 | Composite weighted score |
| `recommended` | boolean | Agent's top pick (max 1 per analysis) |
| `pros` | string[] | Benefits |
| `cons` | string[] | Drawbacks |

### Composite Score Formula

```
final_score = (cost_factor × 0.40) + (service_score × 0.35) + (resilience_score × 0.25)

where:
  cost_factor = 1 - (cost / budget_available)
```

### Cost Avoidance Formula

```
cost_avoidance = revenue_at_risk - mitigation_cost
```

---

## 4. Display Formatting Functions

### Currency (`formatCurrency`)

```
value >= 1,000,000,000  →  $X.XB
value >= 1,000,000      →  $X.XM
value >= 1,000          →  $XXXK
value <  1,000          →  $XXX
```

### Cost (`formatCost` — mitigation options)

```
value >= 1,000,000  →  $X.XM
value >= 1,000      →  $XXXK
value <  1,000      →  $XXX
```

### SLA Risk

```
Display: sla_risk.toFixed(1) + "x"   →  e.g. 1.2x
```

### Stockout Probability

```
Display: Math.round(stockout_probability × 100) + "%"   →  e.g. 65%
```

---

## 5. Company Profile Fields

### Static Fields (from `company_profile.json`)

| Field | Type | Description |
|---|---|---|
| `id` | string | Identifier: `voltedge`, `ironride`, `freshfork` |
| `name` | string | Company legal name |
| `industry` | string | Industry label |
| `revenue_annual` | number (USD) | Annual revenue |
| `employees` | number | Headcount |
| `region` | string | HQ region |
| `risk_tolerance` | enum | `conservative`, `balanced`, `aggressive` |
| `margin_pct` | float | Gross margin (hardcoded 0.25) |

### Derived Fields (computed from CSV data)

| Field | Formula |
|---|---|
| `critical_component` | First part where `is_line_stop = True` |
| `lead_time_days` | `SUM(lineStopParts.normal_lead_time_days) / COUNT(lineStopParts)` |
| `inventory_buffer` | `conservative → 'high'`, `aggressive → 'low'`, else `'medium'` |
| `sourcing` | `suppliers ≥ 4 → 'multi-source'`, `≥ 2 → 'dual-source'`, `< 2 → 'single-source'` |

### Risk Appetite Thresholds (per company)

| Company | Max OTIF Risk | Max Stockout | Human Approval Threshold (CAD) |
|---|---|---|---|
| VoltEdge | 10% | 8% | $15,000 |
| IronRide | 4% | 5% | $20,000 |
| FreshFork | 6% | 5% | $12,000 |

**Escalation trigger:**
```
IF revenue_at_risk > human_approval_required_if_expedite_cost_over_cad
  → generate escalation to executive
```

---

## 6. Supplier Fields (`suppliers.csv`)

| Column | Type | Description |
|---|---|---|
| `supplier_id` | string | Format: `SUP_XX_YY` |
| `name` | string | Supplier company name |
| `country` | string | Country code (CN, MY, US, VN, MX, CA…) |
| `reliability_otif_pct` | float 0–1 | On-time-in-full rate |
| `financial_distress_score_0_100` | number | 0 = healthy, 100 = distressed |

---

## 7. Parts Fields (`parts.csv`)

| Column | Type | Description |
|---|---|---|
| `part_id` | string | Format: `PART_XXX` |
| `description` | string | Part name and type |
| `is_line_stop` | string `True`/`False` | Stockout halts production |
| `normal_lead_time_days` | number | Standard procurement lead time |
| `substitutes` | string | Alternate part IDs (semicolon-separated) |
| `qualified_suppliers` | string | Supplier IDs (semicolon-separated) |
| `category` | string | electronics, automotive, packaging, food_inputs, services |

---

## 8. Disruption Feed Fields (`disruption_feed.csv`)

| Column | Type | Description |
|---|---|---|
| `company_key` | string | `VOLTEDGE`, `IRONRIDE`, `FRESHFORK` |
| `scenario_id` | string | Unique scenario ID |
| `event_date` | string `YYYY-MM-DD` | Date of disruption signal |
| `event_type` | string | `lane_delay`, `supplier_disruption`, `geopolitical`, `weather`, `port_congestion` |
| `lane_id` | string | Trade route (e.g. `CN->CA_ocean`) |
| `delta_transit_days` | number | Additional delay in days |
| `confidence` | float 0–1 | Signal confidence level |
| `severity` | float 0–1 | Disruption severity (0.3 / 0.55 / 0.8) |
| `source_type` | string | `simulated_feed`, `api`, `news` |

### Multi-Event Grouping Logic

```
Disruptions grouped by scenario_id.
Latest event in group used for severity/confidence.

IF event_count > 1:
  "This situation has been developing for {N} days."
ELSE:
  "This is a newly detected event."
```

---

## 9. Reasoning Trace Structure

Each step in `reasoning_trace`:

| Field | Type | Description |
|---|---|---|
| `step` | number | Sequential index |
| `action` | string | High-level action taken |
| `detail` | string | Specific findings |
| `ts` | string `HH:MM:SS` | Timestamp |

**Minimum 7 steps required per analysis.**

---

## 10. Agent Stage Machine (Frontend)

```
idle → thinking → risk → tradeoff → actions → done
```

| Stage | Trigger |
|---|---|
| `thinking` | User selects disruption |
| `risk` | 450ms + stream completes |
| `tradeoff` | 900ms after start |
| `actions` | 1,800ms after start |
| `done` | 2,400ms after start |

---

## 11. Live News Caching

```
Cache TTL: 5 minutes (300,000 ms)

IF now - cache[companyId].timestamp < 300,000ms:
  return cached data
ELSE:
  fetch fresh from Perception Agent, update cache
```

### Live Article → Disruption Severity Mapping

```
Article rank 1  →  'critical'
Article rank 2–3  →  'high'
Article rank 4+  →  'medium'
```

---

## 12. Webhooks

| Endpoint | Purpose | Timeout |
|---|---|---|
| `localhost:5670/webhook/9e501223-...` | Master analysis agent | 5 min |
| `localhost:5670/webhook/get-live-news` | Perception Agent (Tavily news fetch) | Default |

### Master Analysis Payload

```json
{
  "chatInput": "<full prompt>",
  "companyId": "voltedge | ironride | freshfork",
  "disruptionId": "dis_001",
  "timestamp": "ISO8601"
}
```

### Live News Payload

```json
{
  "chatInput": "<tavily search prompt>",
  "companyId": "...",
  "industry": "...",
  "region": "...",
  "critical_component": "...",
  "suppliers": [],
  "parts": []
}
```
