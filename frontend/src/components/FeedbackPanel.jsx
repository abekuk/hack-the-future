import { motion } from 'framer-motion';
import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Check } from 'lucide-react';

export default function FeedbackPanel({ onSubmit }) {
  const [helpful, setHelpful] = useState(null);
  const [actionTaken, setActionTaken] = useState('');
  const [outcome, setOutcome] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (helpful === null) return;
    onSubmit({ helpful, action_taken: actionTaken, outcome });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl p-6 flex flex-col items-center gap-3 text-center"
        style={{ background: 'rgba(52,168,83,0.1)', border: '1px solid rgba(52,168,83,0.25)' }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(52,168,83,0.2)' }}
        >
          <Check size={18} style={{ color: 'var(--accent-green)' }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: 'var(--accent-green)' }}>
          Feedback logged
        </p>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          The agent's memory has been updated. Thank you for helping improve future recommendations.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl p-5"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="flex items-center gap-2 mb-4">
        <img src="/gemini-logo.png" alt="" width="16" height="16" />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Was this recommendation helpful?
        </h3>
      </div>

      <div className="flex gap-3 mb-5">
        {[
          { val: true,  Icon: ThumbsUp,   label: 'Helpful' },
          { val: false, Icon: ThumbsDown, label: 'Not helpful' },
        ].map(({ val, Icon, label }) => (
          <button
            key={label}
            onClick={() => setHelpful(val)}
            className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all"
            style={{
              background: helpful === val ? 'rgba(66,133,244,0.2)' : 'rgba(255,255,255,0.04)',
              border: helpful === val ? '1px solid rgba(66,133,244,0.4)' : '1px solid var(--border-subtle)',
              color: helpful === val ? 'var(--accent-blue)' : 'var(--text-secondary)',
            }}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 mb-5">
        <div>
          <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
            What actually happened?
          </label>
          <select
            value={actionTaken}
            onChange={(e) => setActionTaken(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border-subtle)',
              color: actionTaken ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            <option value="" style={{ background: '#1A1A2E' }}>Select action taken…</option>
            <option value="implemented_as_is" style={{ background: '#1A1A2E' }}>Implemented as-is</option>
            <option value="modified" style={{ background: '#1A1A2E' }}>Modified recommendation</option>
            <option value="rejected" style={{ background: '#1A1A2E' }}>Rejected</option>
          </select>
        </div>
        <div>
          <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
            Outcome
          </label>
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border-subtle)',
              color: outcome ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            <option value="" style={{ background: '#1A1A2E' }}>Select outcome…</option>
            <option value="resolved" style={{ background: '#1A1A2E' }}>Disruption resolved</option>
            <option value="partially_mitigated" style={{ background: '#1A1A2E' }}>Partially mitigated</option>
            <option value="escalated" style={{ background: '#1A1A2E' }}>Escalated further</option>
          </select>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={helpful === null}
        className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
        style={{
          background: helpful !== null ? 'var(--accent-blue)' : 'rgba(255,255,255,0.06)',
          color: helpful !== null ? 'white' : 'var(--text-secondary)',
          cursor: helpful !== null ? 'pointer' : 'not-allowed',
        }}
      >
        Log Feedback
      </button>
    </motion.div>
  );
}
