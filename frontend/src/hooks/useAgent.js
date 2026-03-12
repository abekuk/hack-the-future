import { useState, useCallback } from 'react';
import { analyzeDisruption, submitFeedback, regenerateAction as regenerateActionApi, regenerateAllActions as regenerateAllActionsApi } from '../utils/api';
import { useStreamSimulation } from './useStreamSimulation';

export function useAgent() {
  const [stage, setStage] = useState('idle'); // idle | thinking | risk | tradeoff | actions | done
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [regeneratingKey, setRegeneratingKey] = useState(null); // which action is currently regenerating
  const [selectingPlan, setSelectingPlan] = useState(false); // true when regenerating all actions for a new plan
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

  const regenerateAction = useCallback(async (companyId, disruptionId, actionKey, currentAction, userPrompt) => {
    setRegeneratingKey(actionKey);
    try {
      const newAction = await regenerateActionApi(companyId, disruptionId, actionKey, currentAction, userPrompt);
      // Update the response.actions in-place
      setResponse(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          actions: {
            ...prev.actions,
            [actionKey]: newAction,
          },
        };
      });
      return newAction;
    } catch (err) {
      console.error('Regeneration failed:', err);
      throw err;
    } finally {
      setRegeneratingKey(null);
    }
  }, []);

  const selectPlan = useCallback(async (companyId, disruptionId, plan, currentActions) => {
    setSelectingPlan(true);
    setRegeneratingKey('all');
    try {
      const newActions = await regenerateAllActionsApi(companyId, disruptionId, plan, currentActions || {});
      setResponse(prev => {
        if (!prev) return prev;
        return { ...prev, actions: newActions };
      });
      return newActions;
    } catch (err) {
      console.error('Select plan regeneration failed:', err);
      throw err;
    } finally {
      setSelectingPlan(false);
      setRegeneratingKey(null);
    }
  }, []);

  const sendFeedback = useCallback(async (payload) => {
    return submitFeedback(payload);
  }, []);

  const reset = useCallback(() => {
    setStage('idle');
    setResponse(null);
    setError(null);
    setRegeneratingKey(null);
    setSelectingPlan(false);
    resetStream();
  }, [resetStream]);

  const restore = useCallback((cachedResponse) => {
    setResponse(cachedResponse);
    setStage('done');
    setError(null);
  }, []);

  return { stage, response, streamedSteps, error, regeneratingKey, selectingPlan, analyze, regenerateAction, selectPlan, sendFeedback, reset, restore };
}

