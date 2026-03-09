/**
 * Supply Chain Data Loader
 * Loads company profiles, disruptions, suppliers, and parts
 * from the supply_chain_datasets directory.
 */

// --- Company Profiles ---
import voltedgeProfile from '../mocks/supply_chain_datasets/supply_chain_datasets/Electronics/company_profile.json';
import ironrideProfile from '../mocks/supply_chain_datasets/supply_chain_datasets/Automotive JIT/company_profile.json';
import freshforkProfile from '../mocks/supply_chain_datasets/supply_chain_datasets/Food and Perishables/company_profile.json';

// --- Disruption Feeds (imported as raw text via ?raw) ---
import voltedgeDisruptionsCsv from '../mocks/supply_chain_datasets/supply_chain_datasets/Electronics/disruption_feed.csv?raw';
import ironrideDisruptionsCsv from '../mocks/supply_chain_datasets/supply_chain_datasets/Automotive JIT/disruption_feed.csv?raw';
import freshforkDisruptionsCsv from '../mocks/supply_chain_datasets/supply_chain_datasets/Food and Perishables/disruption_feed.csv?raw';

// --- Suppliers ---
import voltedgeSuppliersCsv from '../mocks/supply_chain_datasets/supply_chain_datasets/Electronics/suppliers.csv?raw';
import ironrideSuppliersCsv from '../mocks/supply_chain_datasets/supply_chain_datasets/Automotive JIT/suppliers.csv?raw';
import freshforkSuppliersCsv from '../mocks/supply_chain_datasets/supply_chain_datasets/Food and Perishables/suppliers.csv?raw';

// --- Parts ---
import voltedgePartsCsv from '../mocks/supply_chain_datasets/supply_chain_datasets/Electronics/parts.csv?raw';
import ironridePartsCsv from '../mocks/supply_chain_datasets/supply_chain_datasets/Automotive JIT/parts.csv?raw';
import freshforkPartsCsv from '../mocks/supply_chain_datasets/supply_chain_datasets/Food and Perishables/parts.csv?raw';

// ============================================================
// CSV Parser
// ============================================================
function parseCsv(csvText) {
    const lines = csvText.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const obj = {};
        headers.forEach((h, i) => { obj[h] = values[i] || ''; });
        return obj;
    });
}

// ============================================================
// Industry metadata (maps dataset folders to UI-friendly info)
// ============================================================
const INDUSTRIES = [
    {
        id: 'voltedge',
        profile: voltedgeProfile,
        disruptionsCsv: voltedgeDisruptionsCsv,
        suppliersCsv: voltedgeSuppliersCsv,
        partsCsv: voltedgePartsCsv,
        displayIndustry: 'Industrial Electronics / IoT',
        headquarters: 'Toronto, ON',
        employees: 280,
        revenue_annual: 38000000,
    },
    {
        id: 'ironride',
        profile: ironrideProfile,
        disruptionsCsv: ironrideDisruptionsCsv,
        suppliersCsv: ironrideSuppliersCsv,
        partsCsv: ironridePartsCsv,
        displayIndustry: 'Automotive Components (JIT)',
        headquarters: 'Detroit, MI',
        employees: 450,
        revenue_annual: 62000000,
    },
    {
        id: 'freshfork',
        profile: freshforkProfile,
        disruptionsCsv: freshforkDisruptionsCsv,
        suppliersCsv: freshforkSuppliersCsv,
        partsCsv: freshforkPartsCsv,
        displayIndustry: 'Fresh & Prepared Foods',
        headquarters: 'Vancouver, BC',
        employees: 520,
        revenue_annual: 71000000,
    },
];

// ============================================================
// Build companies array (matches shape Dashboard expects)
// ============================================================
function buildCompanies() {
    return INDUSTRIES.map(ind => {
        const profile = ind.profile;
        const parts = parseCsv(ind.partsCsv);
        const suppliers = parseCsv(ind.suppliersCsv);

        // Find the most critical part (first line-stop part)
        const criticalPart = parts.find(p => p.is_line_stop === 'True') || parts[0];
        // Calculate average lead time from line-stop parts
        const lineStopParts = parts.filter(p => p.is_line_stop === 'True');
        const avgLeadTime = lineStopParts.length > 0
            ? Math.round(lineStopParts.reduce((sum, p) => sum + parseInt(p.normal_lead_time_days || 0), 0) / lineStopParts.length)
            : 30;

        // Determine sourcing strategy from supplier count
        const sourcingType = suppliers.length >= 4 ? 'multi-source'
            : suppliers.length >= 2 ? 'dual-source' : 'single-source';

        return {
            id: ind.id,
            name: profile.company.name,
            industry: ind.displayIndustry,
            critical_component: criticalPart?.description || 'Unknown',
            margin_pct: 0.25,
            lead_time_days: avgLeadTime,
            inventory_buffer: profile.risk_appetite?.risk_tolerance === 'conservative' ? 'high'
                : profile.risk_appetite?.risk_tolerance === 'aggressive' ? 'low' : 'medium',
            sourcing: sourcingType,
            risk_tolerance: profile.risk_appetite?.risk_tolerance || 'balanced',
            revenue_annual: ind.revenue_annual,
            employees: ind.employees,
            headquarters: ind.headquarters,
            region: ind.headquarters,
            description: `${profile.company.name} operates in the ${ind.displayIndustry} sector.`,
            // Extra data for richer prompts
            _suppliers: suppliers,
            _parts: parts,
            _kpis: profile.kpis || [],
            _risk_appetite: profile.risk_appetite || {},
        };
    });
}

// ============================================================
// Build disruptions map (matches shape DisruptionFeed expects)
// ============================================================
const SEVERITY_MAP = {
    '0.3': 'low',
    '0.55': 'medium',
    '0.8': 'high',
};

const EVENT_TYPE_ICONS = {
    'lane_delay': 'truck',
    'supplier_disruption': 'flame',
    'geopolitical': 'shield',
    'weather': 'sun',
    'port_congestion': 'anchor',
};

const EVENT_TYPE_LABELS = {
    lane_delay: 'shipping lane delay',
    supplier_disruption: 'supplier disruption',
    geopolitical: 'geopolitical event',
    weather: 'weather event',
    port_congestion: 'port congestion',
};

function formatDisruptionDetails(eventType, laneId, deltaDays, confidence, dayCount) {
    const typeLabel = EVENT_TYPE_LABELS[eventType] || eventType.replace(/_/g, ' ');
    const region = formatLaneRegion(laneId);
    const confidencePct = Math.round(confidence * 100);
    const dayWord = deltaDays === 1 ? 'day' : 'days';
    const trackingNote = dayCount > 1
        ? `This situation has been developing over ${dayCount} days.`
        : 'This is a newly detected event.';
    return `A ${typeLabel} affecting the ${region} route is expected to add ${deltaDays} ${dayWord} to shipment times. ${trackingNote} Assessed with ${confidencePct}% confidence.`;
}

function buildDisruptions() {
    const disruptionMap = {};

    INDUSTRIES.forEach(ind => {
        const rows = parseCsv(ind.disruptionsCsv);
        // Group by scenario_id to avoid duplicate entries
        const scenarioGroups = {};
        rows.forEach(row => {
            const sid = row.scenario_id;
            if (!scenarioGroups[sid]) {
                scenarioGroups[sid] = [];
            }
            scenarioGroups[sid].push(row);
        });

        disruptionMap[ind.id] = Object.entries(scenarioGroups).map(([scenarioId, events], idx) => {
            // Use the latest event for severity/confidence
            const latest = events[events.length - 1];
            const severity = SEVERITY_MAP[latest.severity] || (parseFloat(latest.severity) >= 0.7 ? 'high' : parseFloat(latest.severity) >= 0.4 ? 'medium' : 'low');
            const eventType = latest.event_type || 'logistics';
            const laneId = latest.lane_id || '';
            const deltaTransitDays = parseInt(latest.delta_transit_days) || 0;

            return {
                id: `dis_${String(idx + 1).padStart(3, '0')}`,
                type: eventType,
                title: formatScenarioTitle(scenarioId, laneId, deltaTransitDays, eventType),
                severity,
                region: formatLaneRegion(laneId),
                timestamp: latest.event_date ? new Date(latest.event_date + 'T08:00:00Z').toISOString() : new Date().toISOString(),
                details: formatDisruptionDetails(eventType, laneId, deltaTransitDays, parseFloat(latest.confidence), events.length),
                delta_transit_days: deltaTransitDays,
                icon: EVENT_TYPE_ICONS[eventType] || 'truck',
            };
        });
    });

    return disruptionMap;
}

function formatScenarioTitle(scenarioId, laneId, deltaDays, eventType) {
    const region = formatLaneRegion(laneId);
    const dayWord = deltaDays === 1 ? 'day' : 'days';

    const TYPE_TITLES = {
        lane_delay: `${deltaDays}-${dayWord} Shipping Delay`,
        port_congestion: `Port Congestion (+${deltaDays} ${dayWord})`,
        supplier_disruption: 'Supplier Disruption',
        geopolitical: 'Geopolitical Alert',
        weather: 'Weather Disruption',
    };

    const typeTitle = TYPE_TITLES[eventType] || `${deltaDays}-${dayWord} Delay`;
    return `${typeTitle} — ${region}`;
}

function formatLaneRegion(laneId) {
    const regionMap = {
        'CN': 'China', 'CA': 'Canada', 'US': 'United States', 'MY': 'Malaysia',
        'VN': 'Vietnam', 'MX': 'Mexico', 'TW': 'Taiwan', 'KR': 'South Korea',
    };
    if (!laneId) return 'Unknown';
    const parts = laneId.split('->');
    const origin = parts[0]?.trim() || '';
    const dest = parts[1]?.split('_')[0]?.trim() || '';
    return `${regionMap[origin] || origin} → ${regionMap[dest] || dest}`;
}

// ============================================================
// Cached data (built once on import)
// ============================================================
export const companies = buildCompanies();
export const disruptions = buildDisruptions();
