import { motion } from 'framer-motion';

function bufferColor(level) {
  if (level === 'high') return 'var(--accent-green)';
  if (level === 'medium') return 'var(--accent-yellow)';
  return 'var(--accent-red)';
}

export default function CompanyProfile({ company }) {
  if (!company) return null;

  const stats = [
    { label: 'Critical Component', value: company.critical_component },
    { label: 'Gross Margin', value: `${Math.round(company.margin_pct * 100)}%` },
    { label: 'Lead Time', value: `${company.lead_time_days} days` },
    { label: 'Sourcing', value: company.sourcing.replace('-', ' ') },
    { label: 'Annual Revenue', value: `$${(company.revenue_annual / 1000000).toFixed(0)}M` },
    { label: 'HQ', value: company.headquarters },
  ];

  return (
    <motion.div
      key={company.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-xl p-4 mt-3"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
    >
      <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {company.description}
      </p>

      <div className="grid grid-cols-2 gap-x-3 gap-y-3">
        {stats.map(({ label, value }) => (
          <div key={label}>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</p>
            <p className="text-sm font-medium capitalize" style={{ color: 'var(--text-primary)' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Inventory buffer indicator */}
      <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Inventory Buffer</span>
          <span
            className="text-xs font-semibold capitalize px-2 py-0.5 rounded-full"
            style={{
              background: `${bufferColor(company.inventory_buffer)}22`,
              color: bufferColor(company.inventory_buffer),
            }}
          >
            {company.inventory_buffer}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
