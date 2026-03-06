import { motion, AnimatePresence } from 'framer-motion';
import { Anchor, Shield, Building2, Truck, Cloud, AlertTriangle } from 'lucide-react';

const SEVERITY_CONFIG = {
  critical: { color: 'var(--accent-red)',    bg: 'rgba(234,67,53,0.12)',  label: 'Critical' },
  high:     { color: 'var(--accent-yellow)', bg: 'rgba(251,188,4,0.1)',  label: 'High' },
  medium:   { color: '#60A5FA',              bg: 'rgba(96,165,250,0.1)', label: 'Medium' },
  low:      { color: 'var(--accent-green)',  bg: 'rgba(52,168,83,0.1)',  label: 'Low' },
};

const TYPE_ICONS = {
  port_congestion: Anchor,
  geopolitical:    Shield,
  supplier:        Building2,
  logistics:       Truck,
  weather:         Cloud,
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

export default function DisruptionFeed({ disruptions, selected, onSelect, analysisResponse, analysisStage }) {
  if (!disruptions || disruptions.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No disruptions detected.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
        Live Disruption Feed
      </h3>
      <AnimatePresence>
        {disruptions.map((d, i) => {
          const cfg = SEVERITY_CONFIG[d.severity] || SEVERITY_CONFIG.low;
          const isSelected = selected?.id === d.id;
          const Icon = TYPE_ICONS[d.type] || AlertTriangle;

          const postThinkingStages = ['risk', 'tradeoff', 'actions', 'done'];
          const isAnalyzed = isSelected && postThinkingStages.includes(analysisStage) && analysisResponse?.risk_score != null;
          const analyzedRisk = isAnalyzed ? getRiskLabelFromScore(analysisResponse.risk_score) : null;
          const badgeLabel = isAnalyzed ? analyzedRisk.label : (analysisStage === 'thinking' && isSelected ? 'Analyzing…' : 'Pending');
          const badgeColor = isAnalyzed ? analyzedRisk.color : 'var(--text-secondary)';
          const badgeBg = isAnalyzed ? analyzedRisk.bg : 'rgba(255,255,255,0.06)';
          return (
            <motion.button
              key={d.id}
              onClick={() => onSelect(d)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
              className="w-full text-left px-3 py-3 rounded-xl transition-all"
              style={{
                background: isSelected ? cfg.bg : 'rgba(255,255,255,0.02)',
                border: isSelected ? `1px solid ${cfg.color}44` : '1px solid var(--border-subtle)',
              }}
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
                  </div>
                </div>
              </div>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
