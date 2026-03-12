import { motion, AnimatePresence } from 'framer-motion';
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { useState } from 'react';
import { X, Info, ArrowRight, Calculator, AlertTriangle, TrendingUp } from 'lucide-react';

function getRiskColor(score) {
  if (score >= 75) return 'var(--accent-red)';
  if (score >= 50) return 'var(--accent-yellow)';
  return 'var(--accent-green)';
}

function getRiskLabel(score) {
  if (score >= 75) return 'Critical';
  if (score >= 50) return 'High';
  if (score >= 30) return 'Medium';
  return 'Low';
}

function formatCurrency(value) {
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.]/g, '')) : value;
  if (isNaN(num)) return '$0';
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num.toFixed(0)}`;
}

/* ── Flow Step ── */
function FlowStep({ icon: Icon, label, value, color, isLast = false }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 flex-1 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
        <Icon size={14} style={{ color: color || 'var(--accent-blue)', flexShrink: 0 }} />
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="text-xs font-bold ml-auto" style={{ color: color || 'var(--text-primary)' }}>{value}</span>
      </div>
      {!isLast && <ArrowRight size={12} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />}
    </div>
  );
}

/* ── Formula Bar ── */
function FormulaBar({ parts, result, resultColor }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap px-3 py-2.5 rounded-lg" style={{ background: 'rgba(66,133,244,0.06)', border: '1px solid rgba(66,133,244,0.15)' }}>
      <Calculator size={12} style={{ color: 'var(--accent-blue)' }} />
      {parts.map((p, i) => (
        <span key={i} className="text-xs font-mono" style={{ color: typeof p === 'object' ? (p.color || 'var(--accent-blue)') : 'var(--text-secondary)' }}>
          {typeof p === 'object' ? p.text : p}
        </span>
      ))}
      <span className="text-xs font-mono font-bold" style={{ color: resultColor || 'var(--accent-blue)' }}> = {result}</span>
    </div>
  );
}

/* ── Explainability Modal ── */
function ExplainModal({ metric, response, onClose }) {
  const sim = response._simulation || {};
  const inputs = sim._simulation_inputs || {};
  const reasoning = response.reasoning || {};

  const content = {
    revenue: {
      title: 'Revenue at Risk — Calculation Breakdown',
      icon: TrendingUp,
      color: 'var(--accent-yellow)',
      render: () => {
        const dailyRev = inputs.daily_revenue || 0;
        const days = inputs.disruption_days || 0;
        const mult = inputs.severity_multiplier || 0;
        const computed = sim.revenue_at_risk || 0;
        const final = response.revenue_at_risk || 0;
        return (
          <>
            <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
              Computed from real company data using the simulation engine:
            </p>
            {/* Visual flow */}
            <div className="flex flex-col gap-1.5 mb-4">
              <FlowStep icon={TrendingUp} label="Daily Revenue" value={`$${dailyRev.toLocaleString()}/day`} />
              <FlowStep icon={AlertTriangle} label="Disruption Duration" value={`${days} days`} color="var(--accent-yellow)" />
              <FlowStep icon={Info} label="Severity Multiplier" value={`${mult}x`} isLast />
            </div>
            <FormulaBar
              parts={[
                `$${dailyRev.toLocaleString()}`, ' × ', { text: `${days}d`, color: 'var(--accent-yellow)' }, ' × ', `${mult}x`
              ]}
              result={formatCurrency(computed)}
              resultColor="var(--accent-yellow)"
            />
            {computed !== final && (
              <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--accent-blue)' }}>Note:</span> LLM adjusted to {formatCurrency(final)} based on qualitative factors. Validation kept it within ±3x of simulation.
              </p>
            )}
            {reasoning.revenue_impact_logic && (
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>LLM Reasoning:</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{reasoning.revenue_impact_logic}</p>
              </div>
            )}
          </>
        );
      }
    },
    sla: {
      title: 'SLA Risk — Calculation Breakdown',
      icon: AlertTriangle,
      color: 'var(--accent-red)',
      render: () => {
        const days = inputs.disruption_days || 0;
        const lead = inputs.lead_time_days || 1;
        const computed = sim.sla_risk || 0;
        const final = response.sla_risk || 0;
        return (
          <>
            <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
              SLA Risk measures how much of the normal lead time is consumed by the disruption:
            </p>
            <div className="flex flex-col gap-1.5 mb-4">
              <FlowStep icon={AlertTriangle} label="Disruption Duration" value={`${days} days`} color="var(--accent-yellow)" />
              <FlowStep icon={Info} label="Normal Lead Time" value={`${lead} days`} isLast />
            </div>
            <FormulaBar
              parts={[
                { text: `${days}d`, color: 'var(--accent-yellow)' }, ' ÷ ', `${lead}d`, ' (capped at 1.0)'
              ]}
              result={`${(computed * 100).toFixed(1)}%`}
              resultColor={computed > 0.5 ? 'var(--accent-red)' : 'var(--accent-green)'}
            />
            {/* Visual bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                <span>0%</span><span>Lead Time Consumed</span><span>100%</span>
              </div>
              <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, computed * 100)}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ background: computed > 0.5 ? 'var(--accent-red)' : computed > 0.3 ? 'var(--accent-yellow)' : 'var(--accent-green)' }}
                />
              </div>
            </div>
            {Math.abs(computed - final) > 0.05 && (
              <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--accent-blue)' }}>Note:</span> LLM adjusted from {(computed * 100).toFixed(1)}% to {(final * 100).toFixed(1)}% based on qualitative risk factors.
              </p>
            )}
            {reasoning.sla_risk_factors && (
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>LLM Reasoning:</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{reasoning.sla_risk_factors}</p>
              </div>
            )}
          </>
        );
      }
    },
    stockout: {
      title: 'Stockout Probability — Calculation Breakdown',
      icon: AlertTriangle,
      color: 'var(--accent-red)',
      render: () => {
        const days = inputs.disruption_days || 0;
        const buffer = inputs.buffer_days || 0;
        const bufferLabel = inputs.buffer_label || 'Medium';
        const isSingle = inputs.is_single_source || false;
        const computed = sim.stockout_probability || 0;
        const final = response.stockout_probability || 0;
        return (
          <>
            <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
              Stockout probability models how likely inventory runs out before the disruption resolves.
              Buffer is derived from the company's "{bufferLabel}" inventory level ({Math.round((buffer / (inputs.lead_time_days || 1)) * 100)}% of lead time).
            </p>
            <div className="flex flex-col gap-1.5 mb-4">
              <FlowStep icon={AlertTriangle} label="Disruption Duration" value={`${days} days`} color="var(--accent-yellow)" />
              <FlowStep icon={Info} label="Inventory Buffer" value={`${buffer} days`} color="var(--accent-green)" />
              <FlowStep icon={Info} label="Net Exposure" value={days > buffer ? `${days - buffer} days uncovered` : 'Fully covered'} color={days > buffer ? 'var(--accent-red)' : 'var(--accent-green)'} isLast />
            </div>
            <FormulaBar
              parts={[
                '1 − (', { text: `${buffer}d`, color: 'var(--accent-green)' }, ' ÷ (', { text: `${days}d`, color: 'var(--accent-yellow)' }, ' + ', `${buffer}d`, ')) × severity × 1.5'
              ]}
              result={`${(computed * 100).toFixed(1)}%`}
              resultColor={computed > 0.5 ? 'var(--accent-red)' : 'var(--accent-green)'}
            />
            {/* Visual comparison */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="px-3 py-2 rounded-lg text-center" style={{ background: 'rgba(52,168,83,0.08)', border: '1px solid rgba(52,168,83,0.2)' }}>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Buffer</p>
                <p className="text-sm font-bold" style={{ color: 'var(--accent-green)' }}>{buffer} days</p>
              </div>
              <div className="px-3 py-2 rounded-lg text-center" style={{ background: days > buffer ? 'rgba(234,67,53,0.08)' : 'rgba(52,168,83,0.08)', border: `1px solid ${days > buffer ? 'rgba(234,67,53,0.2)' : 'rgba(52,168,83,0.2)'}` }}>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Disruption</p>
                <p className="text-sm font-bold" style={{ color: days > buffer ? 'var(--accent-red)' : 'var(--accent-green)' }}>{days} days</p>
              </div>
            </div>
            {reasoning.stockout_probability_rationale && (
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>LLM Reasoning:</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{reasoning.stockout_probability_rationale}</p>
              </div>
            )}
          </>
        );
      }
    }
  };

  const c = content[metric];
  if (!c) return null;
  const Icon = c.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="rounded-2xl p-6 w-full max-w-md mx-4"
        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${c.color}20` }}>
              <Icon size={14} style={{ color: c.color }} />
            </div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{c.title}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg transition-colors" style={{ color: 'var(--text-secondary)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        {c.render()}

        {/* Validation badge */}
        {response._validation_overrides && response._validation_overrides.length > 0 && (
          <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <p className="text-xs font-semibold mb-1" style={{ color: 'var(--accent-blue)' }}>
              ✓ Validation Applied
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {response._validation_overrides.join(' · ')}
            </p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ── Stat Card (Click-to-Open) ── */
function StatCard({ label, value, metricKey, delay = 0, onClick }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="rounded-2xl p-4 cursor-pointer relative group text-left w-full"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
      onClick={() => onClick(metricKey)}
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</p>
        <Info size={14} className="opacity-40 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--accent-blue)' }} />
      </div>
      <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
      <p className="text-xs mt-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--accent-blue)' }}>
        Click to see calculation →
      </p>
    </motion.button>
  );
}

/* ── Explanation Block (for analysis summary) ── */
function renderInlineBold(text) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{part}</strong>
      : part
  );
}

function normalizeExplanation(text) {
  return text
    .replace(/^#{1,3}\s+[^\n]*/m, '')
    .replace(/(?<!\n)(\*\*[^*\n]+:\*\*)/g, '\n$1')
    .replace(/(?<!\*)\*(?!\*)\s+/g, '\n* ')
    .trim();
}

function ExplanationBlock({ text }) {
  const normalized = normalizeExplanation(text);
  const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);

  const elements = [];
  let bulletBuffer = [];

  const flushBullets = (key) => {
    if (bulletBuffer.length === 0) return;
    elements.push(
      <ul key={key} className="flex flex-col gap-2">
        {bulletBuffer.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--accent-blue)' }} />
            <span>{renderInlineBold(item)}</span>
          </li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  };

  lines.forEach((line, i) => {
    if (/^\*+$/.test(line)) return;

    const bulletMatch = line.match(/^\*\s+(.*)/);
    if (bulletMatch) {
      bulletBuffer.push(bulletMatch[1]);
      return;
    }

    flushBullets(`ul-${i}`);

    const headingMatch = line.match(/^\*\*([^*]+)\*\*:?$/);
    if (headingMatch) {
      elements.push(
        <p key={i} className="text-sm font-bold pt-3 pb-0.5" style={{ color: 'var(--text-primary)' }}>
          {headingMatch[1].replace(/:$/, '')}
        </p>
      );
      return;
    }

    elements.push(
      <p key={i} className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {renderInlineBold(line)}
      </p>
    );
  });

  flushBullets('ul-final');
  return <div className="flex flex-col gap-2">{elements}</div>;
}

/* ── Main Component ── */
export default function RiskAssessment({ response }) {
  const [openMetric, setOpenMetric] = useState(null);
  const { risk_score, revenue_at_risk, sla_risk, stockout_probability } = response;
  const color = getRiskColor(risk_score);
  const chartData = [{ value: risk_score, fill: color }];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-secondary)' }}>
        Risk Assessment
      </h3>

      <div className="flex flex-col items-center mb-6">
        <div style={{ width: 180, height: 180, position: 'relative' }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%" cy="50%"
              innerRadius="70%" outerRadius="100%"
              startAngle={90} endAngle={-270}
              data={chartData}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar
                background={{ fill: 'rgba(255,255,255,0.05)' }}
                dataKey="value"
                cornerRadius={8}
                angleAxisId={0}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ pointerEvents: 'none' }}>
            <span className="text-4xl font-bold" style={{ color }}>{risk_score}</span>
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color }}>{getRiskLabel(risk_score)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Revenue at Risk"
          value={formatCurrency(revenue_at_risk)}
          metricKey="revenue"
          delay={0.1}
          onClick={setOpenMetric}
        />
        <StatCard
          label="SLA Risk"
          value={`${(Number(sla_risk) * 100).toFixed(1)}%`}
          metricKey="sla"
          delay={0.3}
          onClick={setOpenMetric}
        />
        <StatCard
          label="Stockout Probability"
          value={`${Math.round(stockout_probability * 100)}%`}
          metricKey="stockout"
          delay={0.4}
          onClick={setOpenMetric}
        />
      </div>

      {/* Explainability Modal */}
      <AnimatePresence>
        {openMetric && (
          <ExplainModal
            metric={openMetric}
            response={response}
            onClose={() => setOpenMetric(null)}
          />
        )}
      </AnimatePresence>

      {response.explanation && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="mt-2 rounded-2xl p-4"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>
            Analysis Summary
          </p>
          <ExplanationBlock text={response.explanation} />
        </motion.div>
      )}
    </motion.div>
  );
}
