import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import CompanySelector from './CompanySelector';
import CompanyProfile from './CompanyProfile';
import DisruptionFeed from './DisruptionFeed';
import AgentResponse from './AgentResponse';
import ReasoningTrace from './ReasoningTrace';
import GeminiGradientText from './GeminiGradientText';
import { useAgent } from '../hooks/useAgent';
import { getCompanies, getDisruptions } from '../utils/api';

export default function Dashboard() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [disruptions, setDisruptions] = useState([]);
  const [selectedDisruption, setSelectedDisruption] = useState(null);
  const [showTrace, setShowTrace] = useState(true);

  const { stage, response, streamedSteps, analyze, sendFeedback, reset } = useAgent();

  useEffect(() => {
    getCompanies().then(data => {
      setCompanies(data);
      setSelectedCompany(data[0]);
    });
  }, []);

  useEffect(() => {
    if (!selectedCompany) return;
    setSelectedDisruption(null);
    reset();
    getDisruptions(selectedCompany.id).then(setDisruptions);
  }, [selectedCompany]);

  const handleDisruptionSelect = (disruption) => {
    setSelectedDisruption(disruption);
    analyze(selectedCompany.id, disruption);
  };

  const handleFeedback = async (payload) => {
    await sendFeedback({
      ...payload,
      company_id: selectedCompany?.id,
      disruption_id: selectedDisruption?.id,
    });
  };

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* Top bar */}
      <header
        className="flex items-center justify-between px-6 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-primary)' }}
      >
        <div className="flex items-center gap-3">
          <img src="/gemini-logo.png" alt="Gemini" width="28" height="28" />
          <GeminiGradientText className="text-base font-semibold">
            Supply Chain Resilience Agent
          </GeminiGradientText>
        </div>

        <div className="flex items-center gap-3">
          {stage !== 'idle' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs"
              style={{
                background: stage === 'thinking' ? 'rgba(66,133,244,0.12)' : 'rgba(52,168,83,0.12)',
                color: stage === 'thinking' ? 'var(--accent-blue)' : 'var(--accent-green)',
                border: `1px solid ${stage === 'thinking' ? 'rgba(66,133,244,0.25)' : 'rgba(52,168,83,0.25)'}`,
              }}
            >
              <motion.div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: stage === 'thinking' ? 'var(--accent-blue)' : 'var(--accent-green)' }}
                animate={{ opacity: stage === 'thinking' ? [1, 0.3, 1] : 1 }}
                transition={{ duration: 1, repeat: stage === 'thinking' ? Infinity : 0 }}
              />
              {stage === 'thinking' ? 'Analyzing…' : 'Analysis Complete'}
            </motion.div>
          )}

          <button
            onClick={() => setShowTrace(v => !v)}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{
              background: showTrace ? 'rgba(66,133,244,0.12)' : 'rgba(255,255,255,0.05)',
              color: showTrace ? 'var(--accent-blue)' : 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {showTrace ? 'Hide' : 'Show'} Reasoning
          </button>
        </div>
      </header>

      {/* Main 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside
          className="w-72 flex-shrink-0 flex flex-col gap-4 p-4 overflow-y-auto"
          style={{ borderRight: '1px solid var(--border-subtle)' }}
        >
          <CompanySelector
            companies={companies}
            selected={selectedCompany}
            onSelect={setSelectedCompany}
          />
          <CompanyProfile company={selectedCompany} />
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
            <DisruptionFeed
              disruptions={disruptions}
              selected={selectedDisruption}
              onSelect={handleDisruptionSelect}
            />
          </div>
        </aside>

        {/* Center - Agent Response */}
        <main className="flex-1 overflow-y-auto p-6">
          {selectedDisruption && (
            <motion.div
              key={selectedDisruption.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 px-4 py-3 rounded-xl"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
            >
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Active Disruption</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {selectedDisruption.title}
              </p>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {selectedDisruption.details}
              </p>
            </motion.div>
          )}

          <AgentResponse
            stage={stage}
            response={response}
            streamedSteps={streamedSteps}
            onFeedback={handleFeedback}
          />
        </main>

        {/* Right sidebar - Reasoning Trace */}
        {showTrace && (
          <motion.aside
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            className="w-72 flex-shrink-0 p-4 overflow-y-auto"
            style={{ borderLeft: '1px solid var(--border-subtle)' }}
          >
            <ReasoningTrace
              steps={response ? response.reasoning_trace : streamedSteps}
              isThinking={stage === 'thinking'}
            />
          </motion.aside>
        )}
      </div>
    </div>
  );
}
