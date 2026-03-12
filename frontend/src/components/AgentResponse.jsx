import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { Shield, ChevronDown, CheckCircle } from 'lucide-react';
import ThinkingState from './ThinkingState';
import RiskAssessment from './RiskAssessment';
import TradeoffTable from './TradeoffTable';
import ActionDrafts from './ActionDrafts';
import FeedbackPanel from './FeedbackPanel';

function ResponsibleAISection({ response }) {
  const [expanded, setExpanded] = useState(true);
  const biasStatement = response?.bias_mitigation_statement;
  const overrides = response?._validation_overrides || [];

  if (!biasStatement && overrides.length === 0) return null;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid rgba(66,133,244,0.2)',
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left transition-colors"
        style={{
          background: 'rgba(66,133,244,0.06)',
          borderBottom: expanded ? '1px solid rgba(66,133,244,0.15)' : 'none',
        }}
      >
        <Shield size={14} style={{ color: 'var(--accent-blue)' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent-blue)' }}>
          Responsible AI Engine
        </span>
        <ChevronDown
          size={14}
          style={{
            color: 'var(--text-secondary)',
            marginLeft: 'auto',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="p-4 flex flex-col gap-3">
              {/* Bias mitigation statement */}
              {biasStatement && (
                <div className="flex gap-2">
                  <Shield size={13} style={{ color: 'var(--accent-blue)', flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Bias Mitigation</p>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {biasStatement}
                    </p>
                  </div>
                </div>
              )}

              {/* Guardrails applied */}
              {overrides.length > 0 && (
                <div className="flex gap-2">
                  <CheckCircle size={13} style={{ color: 'var(--accent-green)', flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>
                      Guardrails Applied ({overrides.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {overrides.map((override, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            background: 'rgba(52,168,83,0.10)',
                            color: 'var(--accent-green)',
                            border: '1px solid rgba(52,168,83,0.2)',
                          }}
                        >
                          {override}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AgentResponse({ stage, response, streamedSteps, onFeedback, companyId }) {
  const showRisk = ['risk', 'tradeoff', 'actions', 'done'].includes(stage);
  const showTradeoff = ['tradeoff', 'actions', 'done'].includes(stage);
  const showActions = ['actions', 'done'].includes(stage);
  const showFeedback = stage === 'done';

  if (stage === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-64 gap-4 py-16">
        <div
          className="rounded-full p-5"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          <img src="/gemini-logo.png" alt="Gemini" width="40" height="40" style={{ opacity: 0.5 }} />
        </div>
        <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
          Select a disruption from the feed<br />to trigger agent analysis
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <AnimatePresence mode="wait">
        {stage === 'thinking' && (
          <motion.div key="thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ThinkingState streamedSteps={streamedSteps} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRisk && response && (
          <motion.div key="risk" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <RiskAssessment response={response} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Responsible AI section — shows between risk and tradeoff */}
      <AnimatePresence>
        {showRisk && response && (
          <motion.div key="responsible-ai" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
            <ResponsibleAISection response={response} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTradeoff && response && (
          <motion.div key="tradeoff" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <TradeoffTable
              options={response.mitigation_options}
              simulation={response._simulation}
              revenueAtRisk={response.revenue_at_risk}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showActions && response && (
          <motion.div key="actions" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <ActionDrafts actions={response.actions} riskScore={response.risk_score} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFeedback && (
          <motion.div key="feedback" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
            <FeedbackPanel onSubmit={onFeedback} companyId={companyId} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
