import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Anchor, Shield, Building2, Truck, Cloud, AlertTriangle, ThumbsUp, ThumbsDown, Brain, RefreshCw } from 'lucide-react';
import { saveNewsRelevanceFeedback, getNewsFeedbackCount } from '../utils/api';

const SEVERITY_CONFIG = {
  critical: { color: 'var(--accent-red)',    bg: 'rgba(234,67,53,0.12)',  label: 'Critical' },
  high:     { color: 'var(--accent-yellow)', bg: 'rgba(251,188,4,0.1)',  label: 'High' },
  medium:   { color: '#60A5FA',              bg: 'rgba(96,165,250,0.1)', label: 'Medium' },
  low:      { color: 'var(--accent-green)',  bg: 'rgba(52,168,83,0.1)',  label: 'Low' },
};

const TYPE_ICONS = {
  port_congestion:     Anchor,
  geopolitical:        Shield,
  supplier_disruption: Building2,
  supplier:            Building2,
  logistics:           Truck,
  weather:             Cloud,
};

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function getRiskLabelFromScore(score) {
  if (score >= 75) return { label: 'Critical', color: 'var(--accent-red)',    bg: 'rgba(234,67,53,0.12)' };
  if (score >= 50) return { label: 'High',     color: 'var(--accent-yellow)', bg: 'rgba(251,188,4,0.1)' };
  if (score >= 30) return { label: 'Medium',   color: '#60A5FA',              bg: 'rgba(96,165,250,0.1)' };
  return             { label: 'Low',      color: 'var(--accent-green)',  bg: 'rgba(52,168,83,0.1)' };
}

export default function DisruptionFeed({ disruptions, selected, onSelect, analysisResponse, analysisStage, isFetchingLive, companyId, onRefresh }) {
  const [feedbackState, setFeedbackState] = useState({}); // { [disruptionId]: 'relevant' | 'irrelevant' }
  const feedbackCount = getNewsFeedbackCount(companyId);

  // Restore feedback state from localStorage whenever disruptions or company changes.
  // Fully recomputes state (no merging with stale IDs from pre-refresh).
  useEffect(() => {
    const restored = {};
    try {
      const all = JSON.parse(localStorage.getItem('news_relevance_memory') || '{}');
      const memory = all[companyId];
      if (memory && disruptions) {
        const likedTitles = new Set((memory.liked || []).map(e => (e.title || '').toLowerCase().substring(0, 40)));
        const dislikedTitles = new Set((memory.disliked || []).map(e => (e.title || '').toLowerCase().substring(0, 40)));
        disruptions.forEach(d => {
          if (!d.id?.startsWith('live_')) return;
          const key = (d.title || '').toLowerCase().substring(0, 40);
          if (likedTitles.has(key)) restored[d.id] = 'relevant';
          else if (dislikedTitles.has(key)) restored[d.id] = 'irrelevant';
        });
      }
    } catch {}
    setFeedbackState(restored);
  }, [disruptions, companyId]);

  const handleNewsFeedback = (e, disruption, relevant) => {
    e.stopPropagation();
    saveNewsRelevanceFeedback(companyId, disruption, relevant);
    setFeedbackState(prev => ({ ...prev, [disruption.id]: relevant ? 'relevant' : 'irrelevant' }));
  };

  if (!disruptions || disruptions.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No disruptions detected.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          Live Disruption Feed
        </h3>
        <div className="flex items-center gap-2">
          {feedbackCount > 0 && (
            <span
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(66,133,244,0.1)', color: 'var(--accent-blue)' }}
            >
              <Brain size={10} />
              {feedbackCount} learned
            </span>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isFetchingLive}
              className="p-1 rounded-md transition-all"
              style={{
                color: isFetchingLive ? 'var(--text-secondary)' : 'var(--accent-blue)',
                opacity: isFetchingLive ? 0.4 : 0.7,
                cursor: isFetchingLive ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={e => { if (!isFetchingLive) e.currentTarget.style.opacity = '1'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = isFetchingLive ? '0.4' : '0.7'; }}
              title="Refresh news feed (applies your feedback)"
            >
              <RefreshCw size={13} className={isFetchingLive ? 'animate-spin' : ''} />
            </button>
          )}
          {isFetchingLive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ 
                color: 'var(--accent-blue)', 
                background: 'rgba(66,133,244,0.1)' 
              }}
            >
              <motion.div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: 'var(--accent-blue)' }}
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              />
              Gathering Intel…
            </motion.div>
          )}
        </div>
      </div>
      <AnimatePresence>
        {disruptions.map((d, i) => {
          const cfg = SEVERITY_CONFIG[d.severity] || SEVERITY_CONFIG.low;
          const isSelected = selected?.id === d.id;
          const Icon = TYPE_ICONS[d.type] || AlertTriangle;
          const isLive = d.id?.startsWith('live_');
          const feedback = feedbackState[d.id];

          const postThinkingStages = ['risk', 'tradeoff', 'actions', 'done'];
          const isAnalyzed = isSelected && postThinkingStages.includes(analysisStage) && analysisResponse?.risk_score != null;
          const analyzedRisk = isAnalyzed ? getRiskLabelFromScore(analysisResponse.risk_score) : null;
          const badgeLabel = isAnalyzed ? analyzedRisk.label : (analysisStage === 'thinking' && isSelected ? 'Analyzing…' : 'Pending');
          const badgeColor = isAnalyzed ? analyzedRisk.color : 'var(--text-secondary)';
          const badgeBg = isAnalyzed ? analyzedRisk.bg : 'rgba(255,255,255,0.06)';
          return (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
              className="rounded-xl transition-all"
              style={{
                background: isSelected ? cfg.bg : 'rgba(255,255,255,0.02)',
                border: isSelected ? `1px solid ${cfg.color}44` : '1px solid var(--border-subtle)',
              }}
            >
              <button
                onClick={() => onSelect(d)}
                className="w-full text-left px-3 py-3"
              >
                <div className="flex items-start gap-2.5">
                  <Icon
                    size={15}
                    style={{ color: cfg.color, flexShrink: 0, marginTop: 2 }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-medium leading-tight" style={{ color: 'var(--text-primary)' }}>
                        {d.title}
                      </p>
                      <span
                        className="text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{ background: badgeBg, color: badgeColor }}
                      >
                        {badgeLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{d.region}</span>
                      <span style={{ color: 'var(--border-subtle)' }}>·</span>
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatTime(d.timestamp)}</span>
                      {isLive && (
                        <>
                          <span style={{ color: 'var(--border-subtle)' }}>·</span>
                          <span className="text-xs font-medium" style={{ color: 'var(--accent-blue)' }}>LIVE</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </button>

              {/* News Relevance Feedback — only on live articles */}
              {isLive && (
                <div
                  className="flex items-center gap-1.5 px-3 pb-2.5"
                  style={{ marginTop: -4 }}
                >
                  {feedback ? (
                    <span
                      className="text-xs flex items-center gap-1 px-2 py-0.5 rounded-full"
                      style={{
                        background: feedback === 'relevant' ? 'rgba(52,168,83,0.1)' : 'rgba(234,67,53,0.1)',
                        color: feedback === 'relevant' ? 'var(--accent-green)' : 'var(--accent-red)',
                      }}
                    >
                      {feedback === 'relevant' ? <ThumbsUp size={10} /> : <ThumbsDown size={10} />}
                      {feedback === 'relevant' ? 'Marked relevant' : 'Marked irrelevant'}
                    </span>
                  ) : (
                    <>
                      <span className="text-xs mr-auto" style={{ color: 'var(--text-secondary)', opacity: 0.5 }}>
                        Relevant?
                      </span>
                      <button
                        onClick={(e) => handleNewsFeedback(e, d, true)}
                        className="p-1 rounded-md transition-colors"
                        style={{ color: 'var(--text-secondary)', opacity: 0.5 }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--accent-green)'; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                        title="This article is relevant to our supply chain"
                      >
                        <ThumbsUp size={12} />
                      </button>
                      <button
                        onClick={(e) => handleNewsFeedback(e, d, false)}
                        className="p-1 rounded-md transition-colors"
                        style={{ color: 'var(--text-secondary)', opacity: 0.5 }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--accent-red)'; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                        title="This article is not relevant / too noisy"
                      >
                        <ThumbsDown size={12} />
                      </button>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
