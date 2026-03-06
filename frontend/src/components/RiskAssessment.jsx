import { motion } from 'framer-motion';
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';

function getRiskColor(score) {
  if (score >= 75) return 'var(--accent-red)';
  if (score >= 50) return 'var(--accent-yellow)';
  return 'var(--accent-green)';
}

function getRiskLabel(score) {
  if (score >= 75) return 'Critical';
  if (score >= 50) return 'High';
  if (score >= 30) return 'Medium';
  return 'Low';
}

function StatCard({ label, value, format = 'text', delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="rounded-2xl p-4"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
    >
      <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
    </motion.div>
  );
}

function renderInlineBold(text) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{part}</strong>
      : part
  );
}

function normalizeExplanation(text) {
  return text
    .replace(/^#{1,3}\s+[^\n]*/m, '')              // strip ### title line
    .replace(/(?<!\n)(\*\*[^*\n]+:\*\*)/g, '\n$1') // break before **Section:** headers
    .replace(/(?<!\*)\*(?!\*)\s+/g, '\n* ')         // break before * bullets — lookbehind prevents matching ** closing pairs
    .trim();
}

function ExplanationBlock({ text }) {
  const normalized = normalizeExplanation(text);
  const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);

  const elements = [];
  let bulletBuffer = [];

  const flushBullets = (key) => {
    if (bulletBuffer.length === 0) return;
    elements.push(
      <ul key={key} className="flex flex-col gap-2">
        {bulletBuffer.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--accent-blue)' }} />
            <span>{renderInlineBold(item)}</span>
          </li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  };

  lines.forEach((line, i) => {
    // Skip lone stars (artefacts from malformed input)
    if (/^\*+$/.test(line)) return;

    // Bullet point
    const bulletMatch = line.match(/^\*\s+(.*)/);
    if (bulletMatch) {
      bulletBuffer.push(bulletMatch[1]);
      return;
    }

    flushBullets(`ul-${i}`);

    // Section heading: line is **something** or **something:**
    const headingMatch = line.match(/^\*\*([^*]+)\*\*:?$/);
    if (headingMatch) {
      elements.push(
        <p key={i} className="text-sm font-bold pt-3 pb-0.5" style={{ color: 'var(--text-primary)' }}>
          {headingMatch[1].replace(/:$/, '')}
        </p>
      );
      return;
    }

    // Plain paragraph
    elements.push(
      <p key={i} className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {renderInlineBold(line)}
      </p>
    );
  });

  flushBullets('ul-final');
  return <div className="flex flex-col gap-2">{elements}</div>;
}

function formatCurrency(value) {
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.]/g, '')) : value;
  if (isNaN(num)) return '$0';
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num.toFixed(0)}`;
}

export default function RiskAssessment({ response }) {
  const { risk_score, revenue_at_risk, sla_risk, stockout_probability } = response;
  const color = getRiskColor(risk_score);
  const chartData = [{ value: risk_score, fill: color }];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-secondary)' }}>
        Risk Assessment
      </h3>

      <div className="flex flex-col items-center mb-6">
        <div style={{ width: 180, height: 180, position: 'relative' }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%" cy="50%"
              innerRadius="70%" outerRadius="100%"
              startAngle={90} endAngle={-270}
              data={chartData}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar
                background={{ fill: 'rgba(255,255,255,0.05)' }}
                dataKey="value"
                cornerRadius={8}
                angleAxisId={0}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          {/* Score overlay */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ pointerEvents: 'none' }}
          >
            <span className="text-4xl font-bold" style={{ color }}>{risk_score}</span>
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color }}>{getRiskLabel(risk_score)}</span>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Revenue at Risk"
          value={formatCurrency(revenue_at_risk)}
          delay={0.1}
        />
        <StatCard
          label="SLA Risk"
          value={`${Math.round(sla_risk * 100)}%`}
          delay={0.3}
        />
        <StatCard
          label="Stockout Probability"
          value={`${Math.round(stockout_probability * 100)}%`}
          delay={0.4}
        />
      </div>

      {response.explanation && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="mt-2 rounded-2xl p-4"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>
            Analysis Summary
          </p>
          <ExplanationBlock text={response.explanation} />
        </motion.div>
      )}
    </motion.div>
  );
}
