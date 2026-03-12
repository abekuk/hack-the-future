import { motion } from 'framer-motion';
import { Building2, AlertTriangle, CheckCircle, TrendingDown } from 'lucide-react';

function parseOtif(raw) {
  const val = parseFloat(raw);
  if (isNaN(val)) return NaN;
  // Auto-detect: if value <= 1, it's a decimal (0.90 = 90%)
  return val <= 1 ? val * 100 : val;
}

function getHealthColor(otif) {
  const pct = parseFloat(otif);
  const displayPct = isNaN(pct) ? NaN : (pct <= 1 ? pct * 100 : pct);
  if (isNaN(displayPct)) return { color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.06)', label: 'Unknown' };
  if (displayPct >= 95) return { color: 'var(--accent-green)', bg: 'rgba(52,168,83,0.1)', label: 'Healthy' };
  if (displayPct >= 85) return { color: 'var(--accent-yellow)', bg: 'rgba(251,188,4,0.1)', label: 'At Risk' };
  return { color: 'var(--accent-red)', bg: 'rgba(234,67,53,0.12)', label: 'Critical' };
}

function HealthIcon({ otif }) {
  const pct = parseOtif(otif);
  if (isNaN(pct)) return <Building2 size={13} style={{ color: 'var(--text-secondary)' }} />;
  if (pct >= 95) return <CheckCircle size={13} style={{ color: 'var(--accent-green)' }} />;
  if (pct >= 85) return <TrendingDown size={13} style={{ color: 'var(--accent-yellow)' }} />;
  return <AlertTriangle size={13} style={{ color: 'var(--accent-red)' }} />;
}

export default function SupplierHealth({ company }) {
  const suppliers = company?._suppliers || [];
  if (suppliers.length === 0) return null;

  // Calculate aggregate health
  const avgOtif = suppliers.reduce((sum, s) => sum + (parseOtif(s.reliability_otif_pct) || 0), 0) / suppliers.length;
  const atRiskCount = suppliers.filter(s => parseFloat(s.reliability_otif_pct) < 95).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.3 }}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          Supplier Health
        </h3>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{
            background: atRiskCount > 0 ? 'rgba(251,188,4,0.1)' : 'rgba(52,168,83,0.1)',
            color: atRiskCount > 0 ? 'var(--accent-yellow)' : 'var(--accent-green)',
          }}
        >
          Avg OTIF: {avgOtif.toFixed(1)}%
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {suppliers.map((s, i) => {
          const health = getHealthColor(s.reliability_otif_pct);
          const otif = parseOtif(s.reliability_otif_pct);
          return (
            <motion.div
              key={s.name || i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.05, duration: 0.25 }}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}
            >
              <HealthIcon otif={s.reliability_otif_pct} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {s.name}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {s.country}{s.normal_lead_time_days ? ` · ${s.normal_lead_time_days}d lead` : ''}
                </p>
              </div>
              {/* OTIF bar */}
              <div className="flex items-center gap-1.5">
                <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, otif)}%`, background: health.color }}
                  />
                </div>
                <span className="text-xs font-semibold w-10 text-right" style={{ color: health.color }}>
                  {isNaN(otif) ? 'N/A' : `${otif}%`}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
