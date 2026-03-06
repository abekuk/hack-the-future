import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Building2, Package, BarChart2, SlidersHorizontal, Target, FileText, Circle } from 'lucide-react';

const STEP_ICONS = {
  1: Radio,
  2: Building2,
  3: Package,
  4: BarChart2,
  5: SlidersHorizontal,
  6: Target,
  7: FileText,
};

export default function ReasoningTrace({ steps, isThinking }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <img src="/gemini-logo.png" alt="" width="16" height="16" />
        <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          Reasoning Trace
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {steps.length === 0 && !isThinking && (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <div
              className="rounded-full p-3"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
            >
              <img src="/gemini-logo.png" alt="" width="22" height="22" style={{ opacity: 0.4 }} />
            </div>
            <p className="text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
              Select a disruption to see<br />the agent's reasoning
            </p>
          </div>
        )}

        <div className="relative flex flex-col gap-0">
          <AnimatePresence>
            {steps.map((step, i) => {
              const Icon = STEP_ICONS[step.step] || Circle;
              return (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, delay: 0.05 }}
                  className="flex gap-3 relative pb-4"
                >
                  {/* Vertical line */}
                  {i < steps.length - 1 && (
                    <div
                      className="absolute left-4 top-8 bottom-0 w-px"
                      style={{ background: 'var(--border-subtle)' }}
                    />
                  )}

                  {/* Step icon */}
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center z-10"
                    style={{
                      background: 'rgba(66,133,244,0.15)',
                      border: '1px solid rgba(66,133,244,0.3)',
                    }}
                  >
                    <Icon size={13} style={{ color: 'var(--accent-blue)' }} />
                  </div>

                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {step.action}
                      </p>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {step.detail}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Thinking indicator */}
          {isThinking && (
            <motion.div
              className="flex gap-3"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              <div
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(66,133,244,0.1)', border: '1px dashed rgba(66,133,244,0.3)' }}
              >
                <Circle size={10} style={{ color: 'var(--accent-blue)' }} />
              </div>
              <div className="pt-1.5">
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Processing…</p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
