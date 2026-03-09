import { motion } from 'framer-motion';
import { Cpu, Leaf, Wrench, Building2 } from 'lucide-react';

const INDUSTRY_ICONS = {
  'Industrial Electronics / IoT': Cpu,
  'Packaged Fresh Foods / Produce': Leaf,
  'Precision Metal Fabrication': Wrench,
};

export default function CompanySelector({ companies, selected, onSelect }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
        Company
      </h3>
      {companies.map((company, i) => {
        const isSelected = selected?.id === company.id;
        const Icon = INDUSTRY_ICONS[company.industry] || Building2;
        return (
          <motion.button
            key={company.id}
            onClick={() => onSelect(company)}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="w-full text-left px-3 py-3 rounded-xl transition-all"
            style={{
              background: isSelected ? 'rgba(66,133,244,0.12)' : 'rgba(255,255,255,0.03)',
              border: isSelected ? '1px solid rgba(66,133,244,0.3)' : '1px solid var(--border-subtle)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <Icon
                size={15}
                style={{ color: isSelected ? 'var(--accent-blue)' : 'var(--text-secondary)', flexShrink: 0 }}
              />
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: isSelected ? 'var(--accent-blue)' : 'var(--text-primary)' }}
                >
                  {company.name}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                  {company.industry}
                </p>
              </div>
              {isSelected && (
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: 'var(--accent-blue)' }}
                />
              )}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
