import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import CompanySelector from './CompanySelector';
import CompanyProfile from './CompanyProfile';
import DisruptionFeed from './DisruptionFeed';
import AgentResponse from './AgentResponse';
import ReasoningTrace from './ReasoningTrace';
import AgentFlowBar from './AgentFlowBar';
import SupplierHealth from './SupplierHealth';
import GeminiGradientText from './GeminiGradientText';
import { useAgent } from '../hooks/useAgent';
import { getCompanies, getDisruptions, getMockDisruptions, clearNewsCache } from '../utils/api';

export default function Dashboard() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [disruptions, setDisruptions] = useState([]);
  const [selectedDisruption, setSelectedDisruption] = useState(null);
  const [showTrace, setShowTrace] = useState(true);
  const [isFetchingLive, setIsFetchingLive] = useState(false);
  const [selectedPlanName, setSelectedPlanName] = useState(null);

  const { stage, response, streamedSteps, regeneratingKey, selectingPlan, analyze, regenerateAction, selectPlan, sendFeedback, reset, restore } = useAgent();
  const companyCache = useRef({});
  const fetchIdRef = useRef(0); // Race condition guard

  useEffect(() => {
    getCompanies().then(data => {
      setCompanies(data);
      setSelectedCompany(data[0]);
    });
  }, []);

  // Fetch live news with race condition protection
  const fetchLiveNews = useCallback((company, forceRefresh = false) => {
    if (!company) return;

    // Increment fetch ID — any older in-flight request will be stale
    const currentFetchId = ++fetchIdRef.current;

    // Show mock disruptions immediately
    setDisruptions(getMockDisruptions(company.id));

    // Clear cache if force refresh
    if (forceRefresh) {
      clearNewsCache(company.id);
    }

    setIsFetchingLive(true);
    getDisruptions(company.id, company)
      .then(data => {
        // Only update if this is still the latest request (guard against race condition)
        if (fetchIdRef.current === currentFetchId) {
          setDisruptions(data);
        } else {
          console.log(`[Dashboard] Discarded stale news fetch for ${company.id} (fetch #${currentFetchId}, current #${fetchIdRef.current})`);
        }
      })
      .finally(() => {
        if (fetchIdRef.current === currentFetchId) {
          setIsFetchingLive(false);
        }
      });
  }, []);

  useEffect(() => {
    if (!selectedCompany) return;
    fetchLiveNews(selectedCompany);

    const cached = companyCache.current[selectedCompany.id];
    if (cached) {
      setSelectedDisruption(cached.disruption);
      restore(cached.response);
    } else {
      setSelectedDisruption(null);
      reset();
    }
  }, [selectedCompany]);

  const handleRefreshNews = () => {
    if (selectedCompany && !isFetchingLive) {
      fetchLiveNews(selectedCompany, true); // force refresh = clear cache
    }
  };

  const handleDisruptionSelect = (disruption) => {
    setSelectedDisruption(disruption);
    setSelectedPlanName(null);
    analyze(selectedCompany.id, disruption);
  };

  useEffect(() => {
    if (stage === 'done' && response && selectedCompany && selectedDisruption) {
      companyCache.current[selectedCompany.id] = { disruption: selectedDisruption, response };
    }
  }, [stage, response]);

  const handleFeedback = async (payload) => {
    await sendFeedback({
      ...payload,
      company_id: selectedCompany?.id,
      disruption_id: selectedDisruption?.id,
    });
  };

  const handleRegenerate = async (actionKey, currentAction, userPrompt) => {
    if (!selectedCompany || !selectedDisruption) return;
    return regenerateAction(selectedCompany.id, selectedDisruption.id, actionKey, currentAction, userPrompt);
  };

  const handleSelectPlan = async (plan) => {
    if (!selectedCompany || !selectedDisruption) return;
    setSelectedPlanName(plan.option);
    try {
      const currentActions = response?.actions || {};
      await selectPlan(selectedCompany.id, selectedDisruption.id, plan, currentActions);
    } catch (err) {
      console.error('Select plan failed:', err);
    }
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
            Weightless Agent
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
              analysisResponse={response}
              analysisStage={stage}
              isFetchingLive={isFetchingLive}
              companyId={selectedCompany?.id}
              onRefresh={handleRefreshNews}
            />
          </div>
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
            <SupplierHealth company={selectedCompany} />
          </div>
        </aside>

        {/* Center - Agent Response */}
        <main className="flex-1 overflow-y-auto p-6">
          <AgentFlowBar stage={stage} />
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
            onRegenerate={handleRegenerate}
            regeneratingKey={regeneratingKey}
            onSelectPlan={handleSelectPlan}
            selectingPlan={selectingPlan}
            selectedPlanName={selectedPlanName}
            companyId={selectedCompany?.id}
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
