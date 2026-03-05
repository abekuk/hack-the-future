import { motion, AnimatePresence } from 'framer-motion';
import ThinkingState from './ThinkingState';
import RiskAssessment from './RiskAssessment';
import TradeoffTable from './TradeoffTable';
import ActionDrafts from './ActionDrafts';
import FeedbackPanel from './FeedbackPanel';

export default function AgentResponse({ stage, response, streamedSteps, onFeedback }) {
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

      <AnimatePresence>
        {showTradeoff && response && (
          <motion.div key="tradeoff" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <TradeoffTable options={response.mitigation_options} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showActions && response && (
          <motion.div key="actions" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <ActionDrafts actions={response.actions} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFeedback && (
          <motion.div key="feedback" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
            <FeedbackPanel onSubmit={onFeedback} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
