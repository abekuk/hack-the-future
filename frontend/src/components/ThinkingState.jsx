import { motion, AnimatePresence } from 'framer-motion';

export default function ThinkingState({ streamedSteps }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-8">
      {/* Pulsing sparkle */}
      <motion.img
        src="/gemini-logo.png"
        alt="Gemini"
        width="72"
        height="72"
        animate={{ scale: [1, 1.18, 1], opacity: [1, 0.75, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.p
        className="text-lg font-medium"
        style={{ color: 'var(--text-secondary)' }}
        animate={{ opacity: [1, 0.5, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        Analyzing disruption impact…
      </motion.p>

      {/* Streaming reasoning steps */}
      <div className="w-full max-w-md flex flex-col gap-2">
        <AnimatePresence>
          {streamedSteps.map((step) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-start gap-3 px-4 py-2 rounded-xl"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
            >
              <span
                className="mt-0.5 text-xs font-mono rounded px-1.5 py-0.5"
                style={{ background: 'rgba(66,133,244,0.15)', color: 'var(--accent-blue)' }}
              >
                {String(step.step).padStart(2, '0')}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {step.action}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                  {step.detail}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
