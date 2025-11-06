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

export function useCalendarData(params: UseCalendarDataParams) {
  const key = useMemo(() => JSON.stringify(params), [params]);
  const [data, setData] = useState<CalendarApiResponse | null>(() => {
    const cached = calendarCache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.fetchedAt > CACHE_TTL) return null;
    return cached.data;
  });
  const [isLoading, setIsLoading] = useState(() => !data);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(
    async (forceRefresh = false) => {
      const cached = calendarCache.get(key);
      if (!forceRefresh && cached && Date.now() - cached.fetchedAt <= CACHE_TTL) {
        setData(cached.data);
        setIsLoading(false);
        setError(null);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(!cached);
      setError(null);

      const search = new URLSearchParams({
        query: params.query,
        from: params.from,
        to: params.to,
        rangeDays: String(params.rangeDays),
      });

      try {
        const response = await fetch(`/api/calendar?${search.toString()}`, {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch calendar data: ${response.status}`);
        }
        const json = (await response.json()) as CalendarApiResponse;
        calendarCache.set(key, { data: json, fetchedAt: Date.now() });
        setData(json);
        setError(null);
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          return;
        }
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    },
    [key, params.from, params.query, params.rangeDays, params.to],
  );

  useEffect(() => {
    fetchData().catch((err) => setError(err instanceof Error ? err : new Error("Unknown error")));
    return () => abortRef.current?.abort();
  }, [fetchData]);

  const refresh = useCallback(() => fetchData(true), [fetchData]);

  return {
    data,
    isLoading,
    error,
    refresh,
  };
}
