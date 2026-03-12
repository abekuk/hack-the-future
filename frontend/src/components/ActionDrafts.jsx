import { motion } from 'framer-motion';
import { useState } from 'react';
import { Check, X, RotateCcw, Lock, ShieldCheck, UserCheck, RefreshCw, Loader2, SkipForward } from 'lucide-react';

// ============================================================
// HITL AUTONOMY CLASSIFICATION
// Determines the oversight tier for each action based on cost & risk.
// ============================================================
const AUTONOMY_TIERS = {
  auto: {
    label: 'Auto-Execute',
    description: 'Low-risk action — agent can handle autonomously',
    color: 'var(--accent-green)',
    bg: 'rgba(52,168,83,0.10)',
    border: 'rgba(52,168,83,0.25)',
    icon: ShieldCheck,
  },
  review: {
    label: 'Human Review Required',
    description: 'Moderate risk — requires operator approval',
    color: 'var(--accent-yellow, #FBBC04)',
    bg: 'rgba(251,188,4,0.10)',
    border: 'rgba(251,188,4,0.25)',
    icon: UserCheck,
  },
  escalation: {
    label: 'Executive Approval Required',
    description: 'High-risk action — locked until executive sign-off',
    color: 'var(--accent-red)',
    bg: 'rgba(234,67,53,0.10)',
    border: 'rgba(234,67,53,0.25)',
    icon: Lock,
  },
};

function getAutonomyTier(action, riskScore) {
  const cost = action?.estimated_cost || action?.cost || 0;
  // 🟢 Auto-execute: low cost AND low risk
  if (cost < 10000 && riskScore < 30) return 'auto';
  // 🔴 Executive escalation: very high cost OR very high risk
  if (cost > 100000 || riskScore > 75) return 'escalation';
  // 🟡 Default: human review
  return 'review';
}

function AutonomyBadge({ tier }) {
  const config = AUTONOMY_TIERS[tier];
  const Icon = config.icon;
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-t-xl text-xs font-semibold"
      style={{
        background: config.bg,
        borderBottom: `1px solid ${config.border}`,
        color: config.color,
      }}
    >
      <Icon size={13} />
      <span>{config.label}</span>
      <span className="ml-auto font-normal" style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>{config.description}</span>
    </div>
  );
}

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

function ApprovalBar({ actionKey, status, isRegenerating, onApprove, onReject, onRegenerate }) {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [regeneratePrompt, setRegeneratePrompt] = useState('');
  const [showRegenerateInput, setShowRegenerateInput] = useState(false);

  // ── Regenerating state ──
  if (isRegenerating) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-b-xl" style={{ background: 'rgba(66,133,244,0.08)', borderTop: '1px solid rgba(66,133,244,0.2)' }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 size={14} style={{ color: 'var(--accent-blue)' }} />
        </motion.div>
        <span className="text-xs font-semibold" style={{ color: 'var(--accent-blue)' }}>Regenerating with your feedback…</span>
      </div>
    );
  }

  // ── Approved state ──
  if (status === 'approved') {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-b-xl" style={{ background: 'rgba(52,168,83,0.08)', borderTop: '1px solid rgba(52,168,83,0.2)' }}>
        <Check size={14} style={{ color: 'var(--accent-green)' }} />
        <span className="text-xs font-semibold" style={{ color: 'var(--accent-green)' }}>Approved by operator</span>
      </div>
    );
  }

  // ── Rejected state — show regenerate option ──
  if (status === 'rejected') {
    if (showRegenerateInput) {
      return (
        <div className="px-4 py-3 flex flex-col gap-2.5" style={{ borderTop: '1px solid rgba(234,67,53,0.2)', background: 'rgba(66,133,244,0.04)' }}>
          <div className="flex items-center gap-2">
            <RefreshCw size={12} style={{ color: 'var(--accent-blue)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--accent-blue)' }}>How should this be improved?</span>
          </div>
          <textarea
            value={regeneratePrompt}
            onChange={e => setRegeneratePrompt(e.target.value)}
            placeholder="E.g., 'Make the tone more urgent', 'Include alternative supplier options', 'Add specific deadlines'…"
            rows={3}
            className="w-full px-3 py-2 rounded-lg text-xs resize-none"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(66,133,244,0.3)',
              color: 'var(--text-primary)',
              outline: 'none',
              lineHeight: '1.5',
            }}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (regeneratePrompt.trim()) {
                  onRegenerate(actionKey, regeneratePrompt.trim());
                  setShowRegenerateInput(false);
                  setRegeneratePrompt('');
                }
              }}
              disabled={!regeneratePrompt.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: regeneratePrompt.trim() ? 'rgba(66,133,244,0.2)' : 'rgba(66,133,244,0.08)',
                color: regeneratePrompt.trim() ? 'var(--accent-blue)' : 'var(--text-secondary)',
                border: `1px solid ${regeneratePrompt.trim() ? 'rgba(66,133,244,0.4)' : 'rgba(66,133,244,0.15)'}`,
                cursor: regeneratePrompt.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              <RefreshCw size={11} /> Regenerate
            </button>
            <button
              onClick={() => { setShowRegenerateInput(false); setRegeneratePrompt(''); }}
              className="py-2 px-3 rounded-lg text-xs"
              style={{ color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-b-xl" style={{ background: 'rgba(234,67,53,0.08)', borderTop: '1px solid rgba(234,67,53,0.2)' }}>
        <X size={14} style={{ color: 'var(--accent-red)' }} />
        <span className="text-xs font-semibold" style={{ color: 'var(--accent-red)' }}>Rejected by operator</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setShowRegenerateInput(true)}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
            style={{
              color: 'var(--accent-blue)',
              background: 'rgba(66,133,244,0.12)',
              border: '1px solid rgba(66,133,244,0.25)',
            }}
          >
            <RefreshCw size={10} /> Regenerate
          </button>
          <button
            onClick={() => onApprove(actionKey)}
            className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg"
            style={{ color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.06)' }}
          >
            <RotateCcw size={10} /> Undo
          </button>
        </div>
      </div>
    );
  }

  // ── Reject input state (entering reason) ──
  if (showRejectInput) {
    return (
      <div className="px-4 py-3 flex flex-col gap-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <input
          value={rejectReason}
          onChange={e => setRejectReason(e.target.value)}
          placeholder="Why are you rejecting? (optional)"
          className="w-full px-3 py-2 rounded-lg text-xs"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', outline: 'none' }}
        />
        <div className="flex gap-2">
          <button onClick={() => { onReject(actionKey, rejectReason); setShowRejectInput(false); }} className="flex-1 py-1.5 rounded-lg text-xs font-semibold" style={{ background: 'rgba(234,67,53,0.2)', color: 'var(--accent-red)' }}>
            Confirm Reject
          </button>
          <button onClick={() => setShowRejectInput(false)} className="py-1.5 px-3 rounded-lg text-xs" style={{ color: 'var(--text-secondary)' }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Default: approve/reject buttons ──
  return (
    <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <span className="text-xs mr-auto" style={{ color: 'var(--text-secondary)' }}>Human-in-the-loop review:</span>
      <button onClick={() => onApprove(actionKey)} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors" style={{ background: 'rgba(52,168,83,0.15)', color: 'var(--accent-green)', border: '1px solid rgba(52,168,83,0.3)' }}>
        <Check size={12} /> Approve
      </button>
      <button onClick={() => setShowRejectInput(true)} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors" style={{ background: 'rgba(234,67,53,0.1)', color: 'var(--accent-red)', border: '1px solid rgba(234,67,53,0.25)' }}>
        <X size={12} /> Reject
      </button>
    </div>
  );
}

// ── Version indicator (shows when content has been regenerated) ──
function RegeneratedBadge({ version }) {
  if (!version || version <= 1) return null;
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{
        background: 'rgba(66,133,244,0.15)',
        color: 'var(--accent-blue)',
        border: '1px solid rgba(66,133,244,0.25)',
      }}
    >
      v{version} — Regenerated
    </motion.span>
  );
}

function EmailCard({ action, status, isRegenerating, version, onApprove, onReject, onRegenerate }) {
  return (
    <div className="overflow-hidden">
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ background: 'rgba(66,133,244,0.08)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>To: {action.to}</p>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{action.subject}</p>
        </div>
        <div className="flex items-center gap-2">
          <RegeneratedBadge version={version} />
          <CopyButton text={action.body} />
        </div>
      </div>
      <div className="p-4">
        <pre className="text-xs whitespace-pre-wrap leading-relaxed font-sans" style={{ color: 'var(--text-secondary)' }}>
          {action.body}
        </pre>
      </div>
      <ApprovalBar actionKey="supplier_email" status={status} isRegenerating={isRegenerating} onApprove={onApprove} onReject={onReject} onRegenerate={onRegenerate} />
    </div>
  );
}

function POCard({ action, status, isRegenerating, version, onApprove, onReject, onRegenerate }) {
  const fields = [
    { label: 'Type', value: action.type },
    { label: 'SKU', value: action.sku },
    { label: 'Quantity', value: action.quantity?.toLocaleString() || 'N/A' },
    { label: 'Carrier', value: action.carrier || 'TBD' },
    { label: 'Est. Cost', value: (() => {
        const v = action.estimated_cost;
        if (!v) return 'N/A';
        if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
        if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
        return `$${v}`;
      })() },
    { label: 'Est. Arrival', value: action.estimated_arrival || 'TBD' },
  ];
  return (
    <div className="overflow-hidden">
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ background: 'rgba(251,188,4,0.08)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Purchase Order Draft</p>
          <RegeneratedBadge version={version} />
        </div>
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
      <ApprovalBar actionKey="po_suggestion" status={status} isRegenerating={isRegenerating} onApprove={onApprove} onReject={onReject} onRegenerate={onRegenerate} />
    </div>
  );
}

function EscalationCard({ action, status, isRegenerating, version, onApprove, onReject, onRegenerate }) {
  return (
    <div className="overflow-hidden">
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ background: 'rgba(234,67,53,0.08)', borderBottom: '1px solid rgba(234,67,53,0.2)' }}
      >
        <div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>To: {action.to}</p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full inline-block"
              style={{ background: 'rgba(234,67,53,0.2)', color: 'var(--accent-red)' }}
            >
              {action.priority?.toUpperCase()} PRIORITY
            </span>
            <RegeneratedBadge version={version} />
          </div>
        </div>
        <CopyButton text={action.note} />
      </div>
      <div className="p-4">
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{action.note}</p>
      </div>
      <ApprovalBar actionKey="escalation" status={status} isRegenerating={isRegenerating} onApprove={onApprove} onReject={onReject} onRegenerate={onRegenerate} />
    </div>
  );
}

const TABS = ['Supplier Email', 'PO Suggestion', 'Escalation'];

export default function ActionDrafts({ actions, riskScore = 50, onRegenerate, regeneratingKey, selectingPlan }) {
  const [activeTab, setActiveTab] = useState(0);
  const [approvalStatus, setApprovalStatus] = useState({});
  const [versions, setVersions] = useState({}); // track regeneration versions

  // Safe fallback if LLM omitted actions entirely
  const safeActions = actions || {};

  // Compute autonomy tier for each action
  const actionTiers = {
    supplier_email: getAutonomyTier(safeActions.supplier_email, riskScore),
    po_suggestion: getAutonomyTier(safeActions.po_suggestion, riskScore),
    escalation: 'escalation', // Escalation is always executive-level
  };

  const handleApprove = (key) => {
    setApprovalStatus(prev => ({ ...prev, [key]: 'approved' }));
    // Persist to localStorage
    try {
      const log = JSON.parse(localStorage.getItem('action_approvals') || '[]');
      log.push({ action: key, status: 'approved', timestamp: new Date().toISOString() });
      localStorage.setItem('action_approvals', JSON.stringify(log));
    } catch (e) { console.warn('Failed to persist approval:', e); }
  };

  const handleReject = (key, reason) => {
    setApprovalStatus(prev => ({ ...prev, [key]: 'rejected' }));
    try {
      const log = JSON.parse(localStorage.getItem('action_approvals') || '[]');
      log.push({ action: key, status: 'rejected', reason, timestamp: new Date().toISOString() });
      localStorage.setItem('action_approvals', JSON.stringify(log));
    } catch (e) { console.warn('Failed to persist rejection:', e); }
  };

  const handleRegenerate = async (key, prompt) => {
    if (!onRegenerate) return;
    try {
      await onRegenerate(key, safeActions[key], prompt);
      // Reset approval status so user can review the new version
      setApprovalStatus(prev => ({ ...prev, [key]: undefined }));
      // Increment version counter
      setVersions(prev => ({ ...prev, [key]: (prev[key] || 1) + 1 }));
    } catch (err) {
      console.error('Regeneration failed:', err);
    }
  };

  const availableTabs = TABS.filter((t, i) => {
    if (i === 0) return !!safeActions.supplier_email;
    if (i === 1) return !!safeActions.po_suggestion;
    if (i === 2) return !!safeActions.escalation;
    return false;
  });

  // Map tab names to action keys
  const tabToKey = (tab) => tab === 'Supplier Email' ? 'supplier_email' : tab === 'PO Suggestion' ? 'po_suggestion' : 'escalation';

  if (availableTabs.length === 0) {
    return (
      <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
        <p className="text-sm">No action drafts generated for this disruption.</p>
      </div>
    );
  }

  // Ensure activeTab is valid
  const currentTabName = availableTabs[activeTab] || availableTabs[0];
  const safeActiveTabIdx = availableTabs.indexOf(currentTabName);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          Action Drafts — Human-in-the-Loop Review
        </h3>
        {selectingPlan && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(66,133,244,0.12)', border: '1px solid rgba(66,133,244,0.25)' }}
          >
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
              <Loader2 size={11} style={{ color: 'var(--accent-blue)' }} />
            </motion.div>
            <span className="text-xs font-semibold" style={{ color: 'var(--accent-blue)' }}>Generating new action drafts…</span>
          </motion.div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ background: 'var(--bg-surface)' }}>
        {availableTabs.map((tab, i) => {
          const tabKey = tabToKey(tab);
          const status = approvalStatus[tabKey];
          const tier = actionTiers[tabKey];
          const tierColor = AUTONOMY_TIERS[tier]?.color || 'var(--text-secondary)';
          const isTabRegenerating = regeneratingKey === tabKey;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className="flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1"
              style={{
                background: safeActiveTabIdx === i ? 'rgba(66,133,244,0.2)' : 'transparent',
                color: safeActiveTabIdx === i ? 'var(--accent-blue)' : 'var(--text-secondary)',
                border: safeActiveTabIdx === i ? '1px solid rgba(66,133,244,0.3)' : '1px solid transparent',
              }}
            >
              {isTabRegenerating && (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <Loader2 size={10} style={{ color: 'var(--accent-blue)' }} />
                </motion.div>
              )}
              {!isTabRegenerating && status === 'approved' && <Check size={10} style={{ color: 'var(--accent-green)' }} />}
              {!isTabRegenerating && status === 'rejected' && <X size={10} style={{ color: 'var(--accent-red)' }} />}
              {!isTabRegenerating && !status && <span style={{ width: 6, height: 6, borderRadius: '50%', background: tierColor, display: 'inline-block', flexShrink: 0 }} />}
              {tab}
            </button>
          );
        })}
      </div>

      {/* Tab content — with autonomy badge */}
      <motion.div key={currentTabName} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
        {currentTabName === 'Supplier Email' && safeActions.supplier_email && (
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${AUTONOMY_TIERS[actionTiers.supplier_email].border}` }}>
            <AutonomyBadge tier={actionTiers.supplier_email} />
            <EmailCard
              action={safeActions.supplier_email}
              status={approvalStatus.supplier_email}
              isRegenerating={regeneratingKey === 'supplier_email'}
              version={versions.supplier_email}
              onApprove={handleApprove}
              onReject={handleReject}
              onRegenerate={handleRegenerate}
            />
          </div>
        )}
        {currentTabName === 'PO Suggestion' && safeActions.po_suggestion && (
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${AUTONOMY_TIERS[actionTiers.po_suggestion].border}` }}>
            <AutonomyBadge tier={actionTiers.po_suggestion} />
            <POCard
              action={safeActions.po_suggestion}
              status={approvalStatus.po_suggestion}
              isRegenerating={regeneratingKey === 'po_suggestion'}
              version={versions.po_suggestion}
              onApprove={handleApprove}
              onReject={handleReject}
              onRegenerate={handleRegenerate}
            />
          </div>
        )}
        {currentTabName === 'Escalation' && safeActions.escalation && (
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${AUTONOMY_TIERS[actionTiers.escalation].border}` }}>
            <AutonomyBadge tier={actionTiers.escalation} />
            <EscalationCard
              action={safeActions.escalation}
              status={approvalStatus.escalation}
              isRegenerating={regeneratingKey === 'escalation'}
              version={versions.escalation}
              onApprove={handleApprove}
              onReject={handleReject}
              onRegenerate={handleRegenerate}
            />
          </div>
        )}
        {currentTabName === 'Escalation' && !safeActions.escalation && (
          <div className="flex items-center justify-center py-8 rounded-xl" style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
            <p className="text-sm">No escalation required for this scenario.</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
