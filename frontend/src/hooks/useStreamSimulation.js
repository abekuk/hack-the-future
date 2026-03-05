import { useState, useCallback, useRef } from 'react';

export function useStreamSimulation() {
  const [streamedSteps, setStreamedSteps] = useState([]);
  const timeoutsRef = useRef([]);

  const startStream = useCallback((steps, intervalMs = 400, onComplete) => {
    // Clear any ongoing stream
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setStreamedSteps([]);

    steps.forEach((step, i) => {
      const t = setTimeout(() => {
        setStreamedSteps(prev => [...prev, step]);
        if (i === steps.length - 1 && onComplete) {
          onComplete();
        }
      }, i * intervalMs);
      timeoutsRef.current.push(t);
    });
  }, []);

  const resetStream = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setStreamedSteps([]);
  }, []);

  return { streamedSteps, startStream, resetStream };
}
