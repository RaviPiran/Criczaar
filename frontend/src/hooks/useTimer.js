import { useState, useEffect, useRef, useCallback } from 'react';

const useTimer = (initialSeconds = 30, onExpire) => {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef(null);
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;

  const stop = useCallback(() => {
    clearInterval(intervalRef.current);
    setIsRunning(false);
  }, []);

  const start = useCallback((secs) => {
    stop();
    setSeconds(secs !== undefined ? secs : initialSeconds);
    setIsRunning(true);
    intervalRef.current = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          setIsRunning(false);
          expireRef.current && expireRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [stop, initialSeconds]);

  const reset = useCallback((secs) => {
    stop();
    setSeconds(secs !== undefined ? secs : initialSeconds);
  }, [stop, initialSeconds]);

  // External tick (from socket)
  const setExternalTick = useCallback((remaining) => {
    setSeconds(remaining);
  }, []);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const pct = seconds / initialSeconds;
  const urgent = seconds <= 5;
  const warning = seconds <= 10;

  return { seconds, isRunning, start, stop, reset, setExternalTick, pct, urgent, warning };
};

export default useTimer;
