import { motion } from 'framer-motion';
import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Check, MessageSquare } from 'lucide-react';
import { getFeedbackCount } from '../utils/api';

export default function FeedbackPanel({ onSubmit, companyId }) {
  const [helpful, setHelpful] = useState(null);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const feedbackCount = getFeedbackCount(companyId);

  const handleSubmit = () => {
    if (helpful === null) return;
    onSubmit({ helpful, comment });
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
          Feedback logged to agent memory
        </p>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {feedbackCount + 1} total feedback entries stored. Future recommendations will incorporate your input.
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
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <img src="/gemini-logo.png" alt="" width="16" height="16" />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Was this recommendation helpful?
          </h3>
        </div>
        {feedbackCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(66,133,244,0.1)', color: 'var(--accent-blue)' }}>
            <MessageSquare size={10} className="inline mr-1" style={{ verticalAlign: 'middle' }} />
            {feedbackCount} logged
          </span>
        )}
      </div>

      <div className="flex gap-3 mb-4">
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

      {/* Optional comment */}
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Optional: Tell the agent what to improve..."
        rows={2}
        className="w-full mb-4 px-3 py-2 rounded-xl text-xs resize-none"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-primary)',
          outline: 'none',
        }}
      />

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
