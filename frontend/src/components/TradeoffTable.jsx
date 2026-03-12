import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { Info, DollarSign, Calculator, CheckCircle, Loader2, MousePointerClick, Activity, Shield } from 'lucide-react';

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

function ServiceScoreDerivation({ opt, simulation }) {
  const service = opt.service_score ?? opt.service ?? 0;
  const cost = opt.cost ?? 0;
  const simInputs = simulation?._simulation_inputs;
  const leadTime = simInputs?.lead_time_days || 30;
  const disruptionDays = simInputs?.disruption_days || 5;
  const bufferDays = simInputs?.buffer_days || 10;

  // Service score factors explanation
  const factors = [];
  if (service >= 8) {
    factors.push({ label: 'SLA recovery speed', impact: 'Fast', detail: 'Restores normal delivery timelines within days' });
    factors.push({ label: 'Order fulfillment continuity', impact: 'High', detail: 'Minimal customer-facing delays during disruption' });
  } else if (service >= 5) {
    factors.push({ label: 'SLA recovery speed', impact: 'Moderate', detail: 'Partial restoration within lead time window' });
    factors.push({ label: 'Order fulfillment continuity', impact: 'Moderate', detail: 'Some orders may face delays' });
  } else {
    factors.push({ label: 'SLA recovery speed', impact: 'Slow', detail: 'Extended timeline to normalize deliveries' });
    factors.push({ label: 'Order fulfillment continuity', impact: 'Low', detail: 'Significant order delays expected' });
  }

  // Add cost-based factor
  if (cost > 50000) {
    factors.push({ label: 'Investment level', impact: 'Premium', detail: `${formatCost(cost)} enables faster activation & priority handling` });
  } else if (cost > 10000) {
    factors.push({ label: 'Investment level', impact: 'Standard', detail: `${formatCost(cost)} covers essential mitigation steps` });
  } else {
    factors.push({ label: 'Investment level', impact: 'Minimal', detail: `${formatCost(cost)} limits scope of intervention` });
  }

  return (
    <div className="rounded-lg p-3" style={{ background: 'rgba(52,168,83,0.04)', border: '1px solid rgba(52,168,83,0.15)' }}>
      <div className="flex items-center gap-1.5 mb-2">
        <Activity size={12} style={{ color: 'var(--accent-green)' }} />
        <p className="text-xs font-semibold" style={{ color: 'var(--accent-green)' }}>Service Score Derivation ({(service * 10).toFixed(0)}/100)</p>
      </div>
      <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
        Measures how well this option maintains customer SLAs and order fulfillment during the disruption.
      </p>
      <div className="flex flex-col gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
        {factors.map(f => (
          <div key={f.label} className="flex justify-between items-start gap-2">
            <div className="flex-1">
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{f.label}</span>
              <span className="ml-1" style={{ opacity: 0.6 }}>— {f.detail}</span>
            </div>
            <span className="font-mono flex-shrink-0" style={{
              color: f.impact === 'Fast' || f.impact === 'High' || f.impact === 'Premium' ? 'var(--accent-green)' :
                     f.impact === 'Moderate' || f.impact === 'Standard' ? 'var(--accent-yellow, #FBBC04)' : 'var(--accent-red)',
            }}>{f.impact}</span>
          </div>
        ))}
        <div className="pt-1.5 mt-1" style={{ borderTop: '1px solid rgba(52,168,83,0.15)' }}>
          <p style={{ opacity: 0.6 }}>
            Context: {disruptionDays}-day disruption, {bufferDays}-day buffer, {leadTime}-day lead time
          </p>
        </div>
      </div>
    </div>
  );
}

function ResilienceScoreDerivation({ opt, simulation }) {
  const resilience = opt.resilience_score ?? opt.resilience ?? 0;
  const simInputs = simulation?._simulation_inputs;
  const isSingleSource = simInputs?.is_single_source;

  const factors = [];
  if (resilience >= 8) {
    factors.push({ label: 'Supply diversification', impact: 'Strong', detail: 'Reduces single-supplier dependency significantly' });
    factors.push({ label: 'Future disruption protection', impact: 'High', detail: 'Builds structural redundancy into supply chain' });
  } else if (resilience >= 5) {
    factors.push({ label: 'Supply diversification', impact: 'Partial', detail: 'Provides some alternative sourcing capability' });
    factors.push({ label: 'Future disruption protection', impact: 'Moderate', detail: 'Offers temporary buffer against repeat events' });
  } else {
    factors.push({ label: 'Supply diversification', impact: 'Minimal', detail: 'Does not meaningfully diversify supplier base' });
    factors.push({ label: 'Future disruption protection', impact: 'Low', detail: 'Vulnerable to similar future disruptions' });
  }

  // Single source assessment
  if (isSingleSource) {
    factors.push({
      label: 'Single-source risk mitigation',
      impact: resilience >= 7 ? 'Addressed' : 'Unaddressed',
      detail: resilience >= 7
        ? 'This option actively addresses the single-source vulnerability'
        : 'Single-source dependency remains — future disruptions carry same risk',
    });
  }

  return (
    <div className="rounded-lg p-3" style={{ background: 'rgba(66,133,244,0.04)', border: '1px solid rgba(66,133,244,0.15)' }}>
      <div className="flex items-center gap-1.5 mb-2">
        <Shield size={12} style={{ color: 'var(--accent-blue)' }} />
        <p className="text-xs font-semibold" style={{ color: 'var(--accent-blue)' }}>Resilience Score Derivation ({(resilience * 10).toFixed(0)}/100)</p>
      </div>
      <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
        Measures how much this option strengthens the supply chain against future disruptions.
      </p>
      <div className="flex flex-col gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
        {factors.map(f => (
          <div key={f.label} className="flex justify-between items-start gap-2">
            <div className="flex-1">
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{f.label}</span>
              <span className="ml-1" style={{ opacity: 0.6 }}>— {f.detail}</span>
            </div>
            <span className="font-mono flex-shrink-0" style={{
              color: f.impact === 'Strong' || f.impact === 'High' || f.impact === 'Addressed' ? 'var(--accent-blue)' :
                     f.impact === 'Partial' || f.impact === 'Moderate' ? 'var(--accent-yellow, #FBBC04)' : 'var(--accent-red)',
            }}>{f.impact}</span>
          </div>
        ))}
        {isSingleSource && (
          <div className="pt-1.5 mt-1" style={{ borderTop: '1px solid rgba(66,133,244,0.15)' }}>
            <p style={{ opacity: 0.6, color: 'var(--accent-yellow, #FBBC04)' }}>
              ⚠ Company uses single-source supplier strategy — resilience is critical
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreExplainability({ opt, simulation, revenueAtRisk }) {
  const service = opt.service_score ?? opt.service ?? 0;
  const resilience = opt.resilience_score ?? opt.resilience ?? 0;
  const finalScore = opt.final_score ?? 0;
  const cost = opt.cost ?? 0;
  const costAvoidance = opt.cost_avoidance ?? 0;

  const roi = cost > 0 ? costAvoidance / cost : 0;
  const costEfficiencyRaw = Math.min(10, Math.max(0, roi));
  const costEfficiencyPct = Math.round(costEfficiencyRaw * 10);

  const servicePct = Math.round(service * 10);
  const resiliencePct = Math.round(resilience * 10);
  const compositePct = Math.round(finalScore * 10);

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

      {/* Service Score Derivation (replaces Revenue at Risk) */}
      <ServiceScoreDerivation opt={opt} simulation={simulation} />

      {/* Resilience Score Derivation (new) */}
      <ResilienceScoreDerivation opt={opt} simulation={simulation} />

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
                {revenueAtRisk > 0 ? Math.min(100, Math.round(((costAvoidance + cost) / revenueAtRisk) * 100)) : 0}%
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

export default function TradeoffTable({ options, simulation, revenueAtRisk, onSelectPlan, selectingPlan, selectedPlanName }) {
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
          const isSelected = selectedPlanName === opt.option;
          const isOperatorOverride = selectedPlanName && selectedPlanName !== safeOptions[highestScoreIdx]?.option;
          const isExpanded = expandedIdx === i;
          return (
          <motion.div
            key={opt.option}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.12, duration: 0.4 }}
            className="rounded-2xl overflow-hidden"
            style={{
              background: isSelected
                ? 'rgba(52,168,83,0.08)'
                : isRecommended && !isOperatorOverride
                  ? 'rgba(66,133,244,0.08)'
                  : 'var(--bg-surface)',
              border: isSelected
                ? '1px solid rgba(52,168,83,0.3)'
                : isRecommended && !isOperatorOverride
                  ? '1px solid rgba(66,133,244,0.3)'
                  : '1px solid var(--border-subtle)',
              boxShadow: isSelected
                ? '0 0 0 1px rgba(52,168,83,0.15) inset'
                : isRecommended && !isOperatorOverride
                  ? '0 0 0 1px rgba(66,133,244,0.15) inset'
                  : 'none',
            }}
          >
            {isRecommended && !isOperatorOverride && (
              <div className="gemini-gradient" style={{ height: 3, width: '100%' }} />
            )}
            {isSelected && !isRecommended && (
              <div style={{ height: 3, width: '100%', background: 'var(--accent-green)' }} />
            )}

            {/* Clickable header area for expand/collapse */}
            <div
              className="p-4 cursor-pointer"
              onClick={() => setExpandedIdx(isExpanded ? null : i)}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {isRecommended && <img src="/gemini-logo.png" alt="" width="15" height="15" />}
                  <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{opt.option}</span>
                  {isRecommended && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(66,133,244,0.2)', color: 'var(--accent-blue)' }}>
                      Recommended
                    </span>
                  )}
                  {isSelected && !isRecommended && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'rgba(52,168,83,0.2)', color: 'var(--accent-green)' }}>
                      <CheckCircle size={10} /> Selected by operator
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
                  <ScoreBar value={opt.final_score} color={isSelected ? '#34A853' : isRecommended ? '#4285F4' : 'rgba(255,255,255,0.4)'} />
                </div>
              </div>
            </div>

            {/* Expandable: Pros/Cons + Score Explainability + Select button */}
            <AnimatePresence>
              {isExpanded && (
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

                    {/* Select Plan button — separate from Recommended badge */}
                    {onSelectPlan && (
                      <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        {isSelected ? (
                          <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold"
                            style={{ background: 'rgba(52,168,83,0.1)', color: 'var(--accent-green)', border: '1px solid rgba(52,168,83,0.25)' }}
                          >
                            <CheckCircle size={13} /> Currently selected — action drafts aligned to this plan
                          </div>
                        ) : selectingPlan ? (
                          <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold"
                            style={{ background: 'rgba(66,133,244,0.08)', color: 'var(--accent-blue)', border: '1px solid rgba(66,133,244,0.2)' }}
                          >
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                              <Loader2 size={13} />
                            </motion.div>
                            Regenerating action drafts…
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Don't toggle expand/collapse
                              onSelectPlan(opt);
                            }}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all"
                            style={{
                              background: 'rgba(255,255,255,0.04)',
                              color: 'var(--text-primary)',
                              border: '1px solid var(--border-subtle)',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(66,133,244,0.12)';
                              e.currentTarget.style.borderColor = 'rgba(66,133,244,0.3)';
                              e.currentTarget.style.color = 'var(--accent-blue)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                              e.currentTarget.style.borderColor = 'var(--border-subtle)';
                              e.currentTarget.style.color = 'var(--text-primary)';
                            }}
                          >
                            <MousePointerClick size={13} />
                            {isRecommended ? 'Use recommended plan' : 'Use this plan instead'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="px-4 pb-2 cursor-pointer" onClick={() => setExpandedIdx(isExpanded ? null : i)}>
              <p className="text-xs" style={{ color: 'var(--text-secondary)', opacity: 0.5 }}>
                {isExpanded ? '▲ Hide details' : '▼ Show pros & cons'}
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
          {selectedPlanName && selectedPlanName !== safeOptions[highestScoreIdx]?.option && (
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(52,168,83,0.15)', color: 'var(--accent-green)' }}>
              Operator selected: {selectedPlanName}
            </span>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
