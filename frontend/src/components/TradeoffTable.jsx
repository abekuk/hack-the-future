import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

function ScoreBar({ value, color }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, background: 'rgba(255,255,255,0.08)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.round(value * 100)}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)', minWidth: 32 }}>
        {value.toFixed(2)}
      </span>
    </div>
  );
}

function formatCost(value) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

export default function TradeoffTable({ options }) {
  const [expandedIdx, setExpandedIdx] = useState(null);

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
        {options.map((opt, i) => (
          <motion.div
            key={opt.option}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.12, duration: 0.4 }}
            className="rounded-2xl overflow-hidden cursor-pointer"
            style={{
              background: opt.recommended ? 'rgba(66,133,244,0.08)' : 'var(--bg-surface)',
              border: opt.recommended
                ? '1px solid rgba(66,133,244,0.3)'
                : '1px solid var(--border-subtle)',
              boxShadow: opt.recommended ? '0 0 0 1px rgba(66,133,244,0.15) inset' : 'none',
            }}
            onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
          >
            {/* Recommended gradient left border */}
            {opt.recommended && (
              <div
                className="gemini-gradient"
                style={{ height: 3, width: '100%' }}
              />
            )}

            <div className="p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  {opt.recommended && (
                    <img src="/gemini-logo.png" alt="" width="15" height="15" />
                  )}
                  <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                    {opt.option}
                  </span>
                  {opt.recommended && (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(66,133,244,0.2)', color: 'var(--accent-blue)' }}
                    >
                      Recommended
                    </span>
                  )}
                </div>
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  {formatCost(opt.cost)}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs w-24" style={{ color: 'var(--text-secondary)' }}>Service</span>
                  <ScoreBar value={opt.service_score} color="var(--accent-green)" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs w-24" style={{ color: 'var(--text-secondary)' }}>Resilience</span>
                  <ScoreBar value={opt.resilience_score} color="var(--accent-blue)" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs w-24 font-semibold" style={{ color: 'var(--text-primary)' }}>Score</span>
                  <ScoreBar
                    value={opt.final_score}
                    color={opt.recommended ? '#4285F4' : 'rgba(255,255,255,0.4)'}
                  />
                </div>
              </div>
            </div>

            {/* Expandable pros/cons */}
            <AnimatePresence>
              {expandedIdx === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div
                    className="px-4 pb-4 grid grid-cols-2 gap-3"
                    style={{ borderTop: '1px solid var(--border-subtle)' }}
                  >
                    <div className="pt-3">
                      <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--accent-green)' }}>Pros</p>
                      <ul className="flex flex-col gap-1">
                        {opt.pros.map((p) => (
                          <li key={p} className="text-xs flex items-start gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                            <span style={{ color: 'var(--accent-green)' }}>+</span> {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="pt-3">
                      <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--accent-red)' }}>Cons</p>
                      <ul className="flex flex-col gap-1">
                        {opt.cons.map((c) => (
                          <li key={c} className="text-xs flex items-start gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                            <span style={{ color: 'var(--accent-red)' }}>–</span> {c}
                          </li>
                        ))}
                      </ul>
                    </div>
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
        ))}
      </div>

      {/* Recommended badge */}
      {options.find(o => o.recommended) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(66,133,244,0.1)', border: '1px solid rgba(66,133,244,0.2)' }}
        >
          <img src="/gemini-logo.png" alt="" width="18" height="18" />
          <span className="text-sm font-semibold" style={{ color: 'var(--accent-blue)' }}>
            Recommended: {options.find(o => o.recommended)?.option}
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}
