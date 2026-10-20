'use client';

import { useEffect, useState } from 'react';
import type { ReferenceSuggestion } from '@/harness/core/composer';
import { searchHarnessReferences } from '@/app/harness/actions';

export function useReferences(query: string | null, type: string | undefined, sessionId: string) {
  const [result, setResult] = useState<{
    key: string;
    items: ReferenceSuggestion[];
    error?: string;
  }>();
  const key = JSON.stringify([query, type, sessionId]);
  useEffect(() => {
    if (query === null) return;
    let stale = false;
    const timer = setTimeout(() => {
      void searchHarnessReferences({ query, type, sessionId: sessionId || undefined }).then(
        (items) => {
          if (!stale) setResult({ key, items });
        },
        () => {
          if (!stale) setResult({ key, items: [], error: '引用加载失败，请重试' });
        },
      );
    }, 150);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [query, type, sessionId, key]);
  return {
    items: result?.key === key ? result.items : [],
    loading: query !== null && result?.key !== key,
    error: result?.key === key ? result.error : undefined,
  };
}
