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

export default function RiskAssessment({ response }) {
  const { risk_score, revenue_at_risk, orders_affected, sla_risk, stockout_probability } = response;
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

        {response.explanation && (
          <p className="text-sm text-center mt-3 max-w-sm" style={{ color: 'var(--text-secondary)' }}>
            {response.explanation}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Revenue at Risk"
          value={`$${(revenue_at_risk / 1000).toFixed(0)}K`}
          delay={0.1}
        />
        <StatCard
          label="Orders Affected"
          value={orders_affected}
          delay={0.2}
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
    </motion.div>
  );
}
