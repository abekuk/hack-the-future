import { motion } from 'framer-motion';
import GeminiGradientText from './GeminiGradientText';

export default function Landing({ onLaunch }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* Animated gradient orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute rounded-full blur-3xl opacity-20 gemini-gradient"
          style={{ width: 600, height: 600, top: '-15%', left: '-10%' }}
          animate={{ scale: [1, 1.1, 1], x: [0, 30, 0], y: [0, 20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute rounded-full blur-3xl opacity-15 gemini-gradient"
          style={{ width: 500, height: 500, bottom: '-10%', right: '-8%' }}
          animate={{ scale: [1, 1.15, 1], x: [0, -25, 0], y: [0, -15, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
      </div>

      {/* Content */}
      <motion.div
        className="relative z-10 flex flex-col items-center text-center px-8 max-w-3xl"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        {/* Sparkle icon */}
        <motion.div
          className="mb-8"
          animate={{ scale: [1, 1.12, 1], opacity: [1, 0.8, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <img src="/gemini-logo.png" alt="Gemini" width="90" height="90" />
        </motion.div>

        {/* Headline */}
        <motion.h1
          className="text-5xl font-bold mb-4 leading-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.7 }}
        >
          <GeminiGradientText>Autonomous Supply Chain</GeminiGradientText>
          <br />
          <GeminiGradientText>Resilience</GeminiGradientText>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="text-xl mb-2 font-medium"
          style={{ color: 'var(--text-secondary)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.7 }}
        >
          AI Co-Pilot for Mid-Market Manufacturing Stability
        </motion.p>

        <motion.p
          className="text-sm mb-12"
          style={{ color: 'var(--text-secondary)', opacity: 0.6 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ delay: 0.7, duration: 0.7 }}
        >
          Powered by Google ADK + Gemini · Hack the Future 2026
        </motion.p>

        {/* CTA */}
        <motion.button
          onClick={onLaunch}
          className="px-10 py-4 rounded-lg text-white font-medium text-lg relative overflow-hidden"
          style={{ background: 'var(--accent-blue)' }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
        >
          Launch Agent
        </motion.button>

        {/* Feature pills */}
        <motion.div
          className="flex flex-wrap gap-3 justify-center mt-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 0.6 }}
        >
          {['Real-time Risk Scoring', 'Multi-Option Trade-offs', 'Actionable Drafts', 'Transparent Reasoning'].map((f) => (
            <span
              key={f}
              className="px-4 py-1.5 rounded-full text-xs font-medium"
              style={{
                background: 'var(--bg-surface)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {f}
            </span>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
