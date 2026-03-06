import { useState, useCallback } from 'react';
import { analyzeDisruption, submitFeedback } from '../utils/api';
import { useStreamSimulation } from './useStreamSimulation';

export function useAgent() {
  const [stage, setStage] = useState('idle'); // idle | thinking | risk | tradeoff | actions | done
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const { streamedSteps, startStream, resetStream } = useStreamSimulation();

  const analyze = useCallback(async (companyId, disruption) => {
    setStage('thinking');
    setResponse(null);
    setError(null);
    resetStream();

    try {
      const data = await analyzeDisruption(companyId, disruption.id);
      setResponse(data);

      // Stream reasoning trace steps, then advance through stages
      startStream(data.reasoning_trace, 450, () => {
        setStage('risk');
        setTimeout(() => setStage('tradeoff'), 900);
        setTimeout(() => setStage('actions'), 1800);
        setTimeout(() => setStage('done'), 2400);
      });
    } catch (err) {
      setError(err.message || 'Agent analysis failed');
      setStage('idle');
    }
  }, [startStream, resetStream]);

  const sendFeedback = useCallback(async (payload) => {
    return submitFeedback(payload);
  }, []);

  const reset = useCallback(() => {
    setStage('idle');
    setResponse(null);
    setError(null);
    resetStream();
  }, [resetStream]);

  const restore = useCallback((cachedResponse) => {
    setResponse(cachedResponse);
    setStage('done');
    setError(null);
  }, []);

  return { stage, response, streamedSteps, error, analyze, sendFeedback, reset, restore };
}
