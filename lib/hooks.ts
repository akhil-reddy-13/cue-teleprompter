"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type PersistenceStatus = {
  /** localStorage has been consulted; safe to act on the value. */
  hydrated: boolean;
  /** A value was already saved, i.e. this is a returning visitor. */
  hadStored: boolean;
};

/** State mirrored into localStorage, tolerant of missing or stale shapes. */
export function usePersistentState<T extends object>(
  key: string,
  initial: T,
): [
  T,
  (patch: Partial<T> | ((prev: T) => Partial<T>)) => void,
  PersistenceStatus,
] {
  const [value, setValue] = useState<T>(initial);
  const [status, setStatus] = useState<PersistenceStatus>({
    hydrated: false,
    hadStored: false,
  });
  const hydrated = status.hydrated;

  useEffect(() => {
    let hadStored = false;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        hadStored = true;
        const parsed = JSON.parse(raw) as Partial<T>;
        // Merge over defaults so new fields appear for returning users.
        setValue((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // Corrupt or unavailable storage: carry on with defaults.
    }
    // `hadStored` has to be reported rather than re-read later: the write
    // effect below persists defaults as soon as we hydrate, so by the next
    // commit the key exists and every visitor would look like a returning one.
    setStatus({ hydrated: true, hadStored });
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Private-mode quota errors shouldn't break recording.
    }
  }, [hydrated, key, value]);

  const update = useCallback(
    (patch: Partial<T> | ((prev: T) => Partial<T>)) => {
      setValue((prev) => ({
        ...prev,
        ...(typeof patch === "function" ? patch(prev) : patch),
      }));
    },
    [],
  );

  return [value, update, status];
}

type WakeLockSentinel = { release: () => Promise<void>; released: boolean };

/** Keeps phone screens awake through a take. */
export function useWakeLock(active: boolean) {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    const wakeLock = (
      navigator as unknown as {
        wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
      }
    ).wakeLock;
    if (!wakeLock) return;

    let cancelled = false;

    const acquire = async () => {
      try {
        const sentinel = await wakeLock.request("screen");
        if (cancelled) {
          void sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
      } catch {
        // Not critical; the screen may just dim.
      }
    };

    const release = () => {
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (sentinel && !sentinel.released) {
        void sentinel.release().catch(() => {});
      }
    };

    if (active) {
      void acquire();
      // iOS drops the lock when you switch apps; re-take it on return.
      const onVisible = () => {
        if (document.visibilityState === "visible" && !sentinelRef.current) {
          void acquire();
        }
      };
      document.addEventListener("visibilitychange", onVisible);
      return () => {
        cancelled = true;
        document.removeEventListener("visibilitychange", onVisible);
        release();
      };
    }

    release();
    return () => {
      cancelled = true;
    };
  }, [active]);
}

/** True once mounted — for anything that must not run during SSR. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function useIsTouchPortraitDevice(): boolean | null {
  const [value, setValue] = useState<boolean | null>(null);
  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const narrow = Math.min(window.innerWidth, window.innerHeight) < 820;
    setValue(coarse && narrow);
  }, []);
  return value;
}

/**
 * Matches a media query in JS. Returns null until mounted so the first client
 * render agrees with the server, then settles to the real value.
 */
export function useMediaQuery(query: string): boolean | null {
  const [matches, setMatches] = useState<boolean | null>(null);

  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);

  return matches;
}
