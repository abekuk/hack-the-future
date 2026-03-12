import { motion } from 'framer-motion';
import { Radio, Cpu, Brain, Shield, FileOutput } from 'lucide-react';

const FLOW_NODES = [
  { id: 'perception', label: 'Perception Layer', icon: Radio, activeAt: 'thinking' },
  { id: 'simulation', label: 'Simulation Engine', icon: Cpu, activeAt: 'thinking' },
  { id: 'master', label: 'Master Agent', icon: Brain, activeAt: 'thinking' },
  { id: 'risk_intel', label: 'Risk Intelligence', icon: Shield, activeAt: 'risk' },
  { id: 'output', label: 'Output', icon: FileOutput, activeAt: 'tradeoff' },
];

// Maps stage → how many nodes are completed (0-indexed, exclusive)
const STAGE_PROGRESS = {
  idle: -1,
  thinking: 0,   // perception is pulsing
  risk: 3,        // perception, simulation, master done → risk_intel pulsing
  tradeoff: 4,    // all agent nodes done → output pulsing
  actions: 5,     // all done
  done: 5,        // all done
};

export default function AgentFlowBar({ stage }) {
  if (stage === 'idle') return null;

  const completedCount = STAGE_PROGRESS[stage] ?? -1;

  // During "thinking", nodes light up progressively over time
  // We stagger: perception at 0s, simulation at 1s, master at 2.5s
  const thinkingDelays = [0, 1.0, 2.5, 0, 0];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex items-center justify-center gap-0 px-4 py-3 mb-4 rounded-2xl"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {FLOW_NODES.map((node, i) => {
        const Icon = node.icon;
        const isComplete = i < completedCount;
        const isActive =
          (stage === 'thinking' && i <= 2) ||
          (stage === 'risk' && i === 3) ||
          (stage === 'tradeoff' && i === 4) ||
          (stage === 'actions' && i === 4);
        const isPulsing = isActive && !isComplete;
        const isInactive = !isComplete && !isActive;

        // During "thinking" stage, stagger the nodes
        const thinkingComplete = stage === 'thinking' ? false : isComplete;

        return (
          <div key={node.id} className="flex items-center">
            {/* Node */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{
                scale: 1,
                opacity: isInactive ? 0.3 : 1,
              }}
              transition={{
                delay: stage === 'thinking' ? thinkingDelays[i] : i * 0.08,
                duration: 0.3,
              }}
              className="flex flex-col items-center gap-1.5 relative"
              style={{ minWidth: 80 }}
            >
              {/* Icon circle */}
              <motion.div
                className="w-9 h-9 rounded-full flex items-center justify-center relative"
                style={{
                  background: isComplete || (stage === 'done')
                    ? 'rgba(52,168,83,0.15)'
                    : isPulsing
                      ? 'rgba(66,133,244,0.15)'
                      : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${
                    isComplete || (stage === 'done')
                      ? 'rgba(52,168,83,0.4)'
                      : isPulsing
                        ? 'rgba(66,133,244,0.4)'
                        : 'rgba(255,255,255,0.08)'
                  }`,
                }}
                animate={
                  isPulsing
                    ? { boxShadow: ['0 0 0px rgba(66,133,244,0)', '0 0 12px rgba(66,133,244,0.4)', '0 0 0px rgba(66,133,244,0)'] }
                    : {}
                }
                transition={isPulsing ? { duration: 1.5, repeat: Infinity } : {}}
              >
                <Icon
                  size={15}
                  style={{
                    color: isComplete || (stage === 'done')
                      ? 'var(--accent-green)'
                      : isPulsing
                        ? 'var(--accent-blue)'
                        : 'var(--text-secondary)',
                  }}
                />

                {/* Completed checkmark */}
                {(isComplete || stage === 'done') && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--accent-green)', boxShadow: '0 0 6px rgba(52,168,83,0.5)' }}
                  >
                    <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </motion.div>
                )}
              </motion.div>

              {/* Label */}
              <span
                className="text-[10px] font-medium text-center leading-tight"
                style={{
                  color: isComplete || (stage === 'done')
                    ? 'var(--accent-green)'
                    : isPulsing
                      ? 'var(--accent-blue)'
                      : 'var(--text-secondary)',
                  opacity: isInactive ? 0.4 : 1,
                }}
              >
                {node.label}
              </span>
            </motion.div>

            {/* Connector line between nodes */}
            {i < FLOW_NODES.length - 1 && (
              <div className="relative mx-1" style={{ width: 32, height: 2 }}>
                {/* Background track */}
                <div
                  className="absolute inset-0 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                />
                {/* Filled portion */}
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    background: i < completedCount - 1 || stage === 'done'
                      ? 'var(--accent-green)'
                      : 'var(--accent-blue)',
                  }}
                  initial={{ width: '0%' }}
                  animate={{
                    width: (i < completedCount - 1 || stage === 'done')
                      ? '100%'
                      : (i === completedCount - 1 && stage !== 'done')
                        ? '100%'
                        : '0%',
                  }}
                  transition={{
                    duration: 0.6,
                    delay: stage === 'thinking' ? thinkingDelays[i + 1] - 0.3 : 0,
                    ease: 'easeOut',
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </motion.div>
  );
}
