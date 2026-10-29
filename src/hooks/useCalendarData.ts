"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CalendarApiResponse } from "@/types/calendar";

type UseCalendarDataParams = {
  query: string;
  from: string;
  to: string;
  rangeDays: number;
};

type CalendarCacheEntry = {
  data: CalendarApiResponse;
  fetchedAt: number;
};

const CACHE_TTL = 60 * 1000; // 1 minute
const calendarCache = new Map<string, CalendarCacheEntry>();

// TTL 内のキャッシュがあれば返す
function getFreshCache(key: string) {
  const cached = calendarCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.fetchedAt > CACHE_TTL) return null;
  return cached;
}

export function useCalendarData(params: UseCalendarDataParams) {
  const key = useMemo(() => JSON.stringify(params), [params]);
  const [data, setData] = useState<CalendarApiResponse | null>(
    () => getFreshCache(key)?.data ?? null,
  );
  // 期限切れでもキャッシュがあれば読み込み中表示にしない
  const [isLoading, setIsLoading] = useState(() => !calendarCache.has(key));
  const [error, setError] = useState<Error | null>(null);
  const [prevKey, setPrevKey] = useState(key);
  const abortRef = useRef<AbortController | null>(null);

  // 条件が変わったら、取得前の状態を描画中に合わせる
  if (prevKey !== key) {
    setPrevKey(key);
    const fresh = getFreshCache(key);
    if (fresh) {
      setData(fresh.data);
    }
    setIsLoading(!calendarCache.has(key));
    setError(null);
  }

  const fetchData = useCallback(
    async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const search = new URLSearchParams({
        query: params.query,
        from: params.from,
        to: params.to,
        rangeDays: String(params.rangeDays),
      });

      // 状態の更新はすべて応答後のコールバック内で行う
      return fetch(`/api/calendar?${search.toString()}`, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Failed to fetch calendar data: ${response.status}`);
          }
          const json = (await response.json()) as CalendarApiResponse;
          calendarCache.set(key, { data: json, fetchedAt: Date.now() });
          setData(json);
          setError(null);
        })
        .catch((err) => {
          if ((err as Error).name === "AbortError") {
            return;
          }
          setError(err as Error);
        })
        .finally(() => {
          // 中断された古い取得が、後続の取得の読み込み中表示を消さないようにする
          if (!controller.signal.aborted) {
            setIsLoading(false);
          }
        });
    },
    [key, params.from, params.query, params.rangeDays, params.to],
  );

  useEffect(() => {
    // TTL 内のキャッシュは描画中に反映済みのため取得しない
    if (!getFreshCache(key)) {
      fetchData().catch((err) => setError(err instanceof Error ? err : new Error("Unknown error")));
    }
    return () => abortRef.current?.abort();
  }, [fetchData, key]);

  const refresh = useCallback(() => {
    setIsLoading(!calendarCache.has(key));
    setError(null);
    return fetchData();
  }, [fetchData, key]);

  return {
    data,
    isLoading,
    error,
    refresh,
  };
}
