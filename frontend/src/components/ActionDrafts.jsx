import { motion } from 'framer-motion';
import { useState } from 'react';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="text-xs px-3 py-1 rounded-lg transition-colors"
      style={{
        background: copied ? 'rgba(52,168,83,0.2)' : 'rgba(255,255,255,0.06)',
        color: copied ? 'var(--accent-green)' : 'var(--text-secondary)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

function EmailCard({ action }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ background: 'rgba(66,133,244,0.08)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>To: {action.to}</p>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{action.subject}</p>
        </div>
        <CopyButton text={action.body} />
      </div>
      <div className="p-4">
        <pre
          className="text-xs whitespace-pre-wrap leading-relaxed font-sans"
          style={{ color: 'var(--text-secondary)' }}
        >
          {action.body}
        </pre>
      </div>
    </div>
  );
}

function POCard({ action }) {
  const fields = [
    { label: 'Type', value: action.type },
    { label: 'SKU', value: action.sku },
    { label: 'Quantity', value: action.quantity.toLocaleString() },
    { label: 'Carrier', value: action.carrier },
    { label: 'Est. Cost', value: (() => {
        const v = action.estimated_cost;
        if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
        if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
        return `$${v}`;
      })() },
    { label: 'Est. Arrival', value: action.estimated_arrival },
  ];
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ background: 'rgba(251,188,4,0.08)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Purchase Order Draft</p>
        <CopyButton text={JSON.stringify(action, null, 2)} />
      </div>
      <div className="p-4 grid grid-cols-2 gap-3">
        {fields.map(({ label, value }) => (
          <div key={label}>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</p>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function EscalationCard({ action }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(234,67,53,0.3)' }}>
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ background: 'rgba(234,67,53,0.08)', borderBottom: '1px solid rgba(234,67,53,0.2)' }}
      >
        <div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>To: {action.to}</p>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full mt-1 inline-block"
            style={{ background: 'rgba(234,67,53,0.2)', color: 'var(--accent-red)' }}
          >
            {action.priority.toUpperCase()} PRIORITY
          </span>
        </div>
        <CopyButton text={action.note} />
      </div>
      <div className="p-4">
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{action.note}</p>
      </div>
    </div>
  );
}

const TABS = ['Supplier Email', 'PO Suggestion', 'Escalation'];

export default function ActionDrafts({ actions }) {
  const [activeTab, setActiveTab] = useState(0);
  const availableTabs = TABS.filter((t, i) => {
    if (i === 0) return !!actions.supplier_email;
    if (i === 1) return !!actions.po_suggestion;
    if (i === 2) return !!actions.escalation;
    return false;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-secondary)' }}>
        Action Drafts
      </h3>

      {/* Tab bar */}
      <div
        className="flex gap-1 mb-4 p-1 rounded-xl"
        style={{ background: 'var(--bg-surface)' }}
      >
        {availableTabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className="flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all"
            style={{
              background: activeTab === i ? 'rgba(66,133,244,0.2)' : 'transparent',
              color: activeTab === i ? 'var(--accent-blue)' : 'var(--text-secondary)',
              border: activeTab === i ? '1px solid rgba(66,133,244,0.3)' : '1px solid transparent',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25 }}
      >
        {activeTab === 0 && actions.supplier_email && <EmailCard action={actions.supplier_email} />}
        {activeTab === 1 && actions.po_suggestion && <POCard action={actions.po_suggestion} />}
        {activeTab === 2 && actions.escalation && <EscalationCard action={actions.escalation} />}
        {activeTab === 2 && !actions.escalation && (
          <div
            className="flex items-center justify-center py-8 rounded-xl"
            style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
          >
            <p className="text-sm">No escalation required for this scenario.</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
