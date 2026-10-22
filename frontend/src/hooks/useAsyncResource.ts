import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';

interface ResourceState<T> {
  key: string | null;
  data: T;
  error: string | null;
}

/** Read independently; changed keys hide stale data and cleanup ignores old responses. */
export function useAsyncResource<T>(
  key: string,
  enabled: boolean,
  load: () => Promise<T>,
  fallback: T
): [T, Dispatch<SetStateAction<T>>, boolean, string | null] {
  const [state, setState] = useState<ResourceState<T>>({ key: null, data: fallback, error: null });
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void Promise.resolve().then(() => cancelled ? fallback : load()).then(data => {
      if (!cancelled) setState({ key, data, error: null });
    }).catch(err => {
      if (!cancelled) setState({ key, data: fallback, error: err instanceof Error ? err.message : 'Failed to load data.' });
    });
    return () => { cancelled = true; };
  }, [key, enabled, load, fallback]);

  const setData: Dispatch<SetStateAction<T>> = useCallback(next => {
    setState(previous => {
      const current = previous.key === key ? previous.data : fallback;
      const data = typeof next === 'function' ? (next as (value: T) => T)(current) : next;
      return { key, data, error: null };
    });
  }, [key, fallback]);
  return [state.key === key ? state.data : fallback, setData,
    enabled && state.key !== key, state.key === key ? state.error : null];
}
