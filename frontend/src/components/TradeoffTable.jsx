import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { Info, TrendingDown, DollarSign, Calculator } from 'lucide-react';

function ScoreBar({ value, color, maxScale = 10 }) {
  const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;
  const pct = Math.min(100, Math.max(0, (safeValue / maxScale) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, background: 'rgba(255,255,255,0.08)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.round(pct)}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)', minWidth: 32 }}>
        {Math.round(pct)}
      </span>
    </div>
  );
}

function formatCost(value) {
  if (value == null || isNaN(value)) return 'N/A';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

function ScoreExplainability({ opt, simulation, revenueAtRisk }) {
  const service = opt.service_score ?? opt.service ?? 0;
  const resilience = opt.resilience_score ?? opt.resilience ?? 0;
  const finalScore = opt.final_score ?? 0;
  const cost = opt.cost ?? 0;
  const costAvoidance = opt.cost_avoidance ?? 0;
  const revAtRisk = revenueAtRisk || 0;

  // ── Rigorous Cost Efficiency ──
  // ROI-based: how much revenue is saved per dollar spent
  // Scale: ROI <= 0 → 0/100,  ROI >= 10 → 100/100, linear in between
  const roi = cost > 0 ? costAvoidance / cost : 0;
  const costEfficiencyRaw = Math.min(10, Math.max(0, roi));
  const costEfficiencyPct = Math.round(costEfficiencyRaw * 10);

  // Weighted composite
  const servicePct = Math.round(service * 10);
  const resiliencePct = Math.round(resilience * 10);
  const compositePct = Math.round(finalScore * 10);

  // Simulation inputs for derivation
  const simInputs = simulation?._simulation_inputs;

  return (
    <div
      className="mt-3 pt-3 flex flex-col gap-3"
      style={{ borderTop: '1px solid var(--border-subtle)' }}
    >
      <div className="flex items-center gap-1.5">
        <Info size={12} style={{ color: 'var(--accent-blue)' }} />
        <p className="text-xs font-semibold" style={{ color: 'var(--accent-blue)' }}>Score Breakdown & Derivation</p>
      </div>

      {/* Score decomposition */}
      <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex flex-col gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <div className="flex justify-between">
            <span>Service Impact <span style={{ opacity: 0.5 }}>(40% weight)</span></span>
            <span className="font-mono" style={{ color: 'var(--accent-green)' }}>{servicePct}/100</span>
          </div>
          <div className="flex justify-between">
            <span>Resilience Gain <span style={{ opacity: 0.5 }}>(40% weight)</span></span>
            <span className="font-mono" style={{ color: 'var(--accent-blue)' }}>{resiliencePct}/100</span>
          </div>
          <div className="flex justify-between">
            <span>Cost Efficiency (ROI) <span style={{ opacity: 0.5 }}>(20% weight)</span></span>
            <span className="font-mono" style={{ color: 'var(--accent-yellow, #FBBC04)' }}>{costEfficiencyPct}/100</span>
          </div>
          <div
            className="flex justify-between pt-1.5 mt-1 font-semibold"
            style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
          >
            <span>Composite Score</span>
            <span className="font-mono">{compositePct}/100</span>
          </div>
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>
           Score = (0.4 × Service) + (0.4 × Resilience) + (0.2 × Cost Efficiency)
        </p>
      </div>

      {/* Revenue at Risk derivation */}
      {simInputs && revAtRisk > 0 && (
        <div className="rounded-lg p-3" style={{ background: 'rgba(234,67,53,0.04)', border: '1px solid rgba(234,67,53,0.15)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingDown size={12} style={{ color: 'var(--accent-red)' }} />
            <p className="text-xs font-semibold" style={{ color: 'var(--accent-red)' }}>Revenue at Risk Derivation</p>
          </div>
          <div className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <div className="flex justify-between">
              <span>Daily Revenue</span>
              <span className="font-mono">{formatCost(simInputs.daily_revenue)}/day</span>
            </div>
            <div className="flex justify-between">
              <span>Disruption Duration</span>
              <span className="font-mono">{simInputs.disruption_days} days</span>
            </div>
            <div className="flex justify-between">
              <span>Buffer Coverage</span>
              <span className="font-mono">−{simInputs.buffer_days} days</span>
            </div>
            <div className="flex justify-between">
              <span>Net Exposure</span>
              <span className="font-mono">{Math.max(0, simInputs.disruption_days - simInputs.buffer_days)} days</span>
            </div>
            <div className="flex justify-between">
              <span>Severity Multiplier</span>
              <span className="font-mono">×{simInputs.severity_multiplier}</span>
            </div>
            <div
              className="flex justify-between pt-1.5 mt-1 font-semibold"
              style={{ borderTop: '1px solid rgba(234,67,53,0.15)', color: 'var(--text-primary)' }}
            >
              <span>Total Revenue at Risk</span>
              <span className="font-mono" style={{ color: 'var(--accent-red)' }}>{formatCost(revAtRisk)}</span>
            </div>
          </div>
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>
            = {formatCost(simInputs.daily_revenue)} × max(0, {simInputs.disruption_days} − {simInputs.buffer_days}) × {simInputs.severity_multiplier}
          </p>
        </div>
      )}

      {/* Savings derivation */}
      {cost > 0 && (
        <div className="rounded-lg p-3" style={{ background: 'rgba(52,168,83,0.04)', border: '1px solid rgba(52,168,83,0.15)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <DollarSign size={12} style={{ color: 'var(--accent-green)' }} />
            <p className="text-xs font-semibold" style={{ color: 'var(--accent-green)' }}>Savings Calculation</p>
          </div>
          <div className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <div className="flex justify-between">
              <span>Mitigation Effectiveness</span>
              <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                {revAtRisk > 0 ? Math.min(100, Math.round(((costAvoidance + cost) / revAtRisk) * 100)) : 0}%
              </span>
            </div>
            <div className="flex justify-between">
              <span>Revenue Protected</span>
              <span className="font-mono">{formatCost(costAvoidance + cost)}</span>
            </div>
            <div className="flex justify-between">
              <span>Implementation Cost</span>
              <span className="font-mono" style={{ color: 'var(--accent-red)' }}>−{formatCost(cost)}</span>
            </div>
            <div
              className="flex justify-between pt-1.5 mt-1 font-semibold"
              style={{ borderTop: '1px solid rgba(52,168,83,0.15)', color: 'var(--text-primary)' }}
            >
              <span>Net Savings (Cost Avoidance)</span>
              <span className="font-mono" style={{ color: 'var(--accent-green)' }}>{formatCost(costAvoidance)}</span>
            </div>
          </div>
          <div className="flex flex-col gap-0.5 mt-1.5">
            <p className="text-xs" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>
              = Revenue Protected − Implementation Cost
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>
              ROI: {roi.toFixed(1)}× return ({formatCost(costAvoidance)} saved per {formatCost(cost)} spent)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TradeoffTable({ options, simulation, revenueAtRisk }) {
  const [expandedIdx, setExpandedIdx] = useState(null);
  const safeOptions = options || [];

  if (safeOptions.length === 0) {
    return (
      <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
        <p className="text-sm">No mitigation options generated for this disruption.</p>
      </div>
    );
  }

  // Override LLM's recommended flag — always pick the highest-scoring option
  const highestScoreIdx = safeOptions.reduce((bestIdx, opt, idx, arr) => {
    const bestScore = arr[bestIdx].final_score ?? 0;
    const curScore = opt.final_score ?? 0;
    return curScore > bestScore ? idx : bestIdx;
  }, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-secondary)' }}>
        Mitigation Trade-offs
      </h3>

      <div className="flex flex-col gap-3">
        {safeOptions.map((opt, i) => {
          const isRecommended = i === highestScoreIdx;
          return (
          <motion.div
            key={opt.option}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.12, duration: 0.4 }}
            className="rounded-2xl overflow-hidden cursor-pointer"
            style={{
              background: isRecommended ? 'rgba(66,133,244,0.08)' : 'var(--bg-surface)',
              border: isRecommended
                ? '1px solid rgba(66,133,244,0.3)'
                : '1px solid var(--border-subtle)',
              boxShadow: isRecommended ? '0 0 0 1px rgba(66,133,244,0.15) inset' : 'none',
            }}
            onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
          >
            {isRecommended && (
              <div className="gemini-gradient" style={{ height: 3, width: '100%' }} />
            )}

            <div className="p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  {isRecommended && <img src="/gemini-logo.png" alt="" width="15" height="15" />}
                  <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{opt.option}</span>
                  {isRecommended && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(66,133,244,0.2)', color: 'var(--accent-blue)' }}>
                      Recommended
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    Cost: {formatCost(opt.cost)}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--accent-green)' }}>
                    Saves {formatCost(opt.cost_avoidance)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs w-24" style={{ color: 'var(--text-secondary)' }}>Service</span>
                  <ScoreBar value={opt.service_score ?? opt.service} color="var(--accent-green)" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs w-24" style={{ color: 'var(--text-secondary)' }}>Resilience</span>
                  <ScoreBar value={opt.resilience_score ?? opt.resilience} color="var(--accent-blue)" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs w-24 font-semibold" style={{ color: 'var(--text-primary)' }}>Score</span>
                  <ScoreBar value={opt.final_score} color={isRecommended ? '#4285F4' : 'rgba(255,255,255,0.4)'} />
                </div>
              </div>
            </div>

            {/* Expandable: Pros/Cons + Score Explainability */}
            <AnimatePresence>
              {expandedIdx === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="px-4 pb-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="pt-3">
                        <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--accent-green)' }}>Pros</p>
                        <ul className="flex flex-col gap-1">
                          {(opt.pros || []).map((p) => (
                            <li key={p} className="text-xs flex items-start gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                              <span style={{ color: 'var(--accent-green)' }}>+</span> {p}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="pt-3">
                        <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--accent-red)' }}>Cons</p>
                        <ul className="flex flex-col gap-1">
                          {(opt.cons || []).map((c) => (
                            <li key={c} className="text-xs flex items-start gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                              <span style={{ color: 'var(--accent-red)' }}>–</span> {c}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <ScoreExplainability opt={opt} simulation={simulation} revenueAtRisk={revenueAtRisk} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="px-4 pb-2">
              <p className="text-xs" style={{ color: 'var(--text-secondary)', opacity: 0.5 }}>
                {expandedIdx === i ? '▲ Hide details' : '▼ Show pros & cons'}
              </p>
            </div>
          </motion.div>
        );
        })}
      </div>

      {safeOptions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(66,133,244,0.1)', border: '1px solid rgba(66,133,244,0.2)' }}
        >
          <img src="/gemini-logo.png" alt="" width="18" height="18" />
          <span className="text-sm font-semibold" style={{ color: 'var(--accent-blue)' }}>
            Recommended: {safeOptions[highestScoreIdx]?.option}
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}
