"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";

/**
 * Global coin search (CoinGecko /search) — finds any coin by name/symbol, not
 * just the current page. Debounced, dropdown navigates to the asset detail page.
 */
export function MarketSearch(): React.JSX.Element {
  const tx = useTranslations("markets");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ["markets", "search", debounced],
    queryFn: () => api.marketsSearch({ q: debounced }),
    enabled: debounced.length >= 2,
  });
  const results = data?.coins ?? [];
  const show = open && debounced.length >= 2;

  return (
    <div ref={boxRef} className="relative w-full sm:w-80">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
      <Input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={tx("globalSearch")}
        className="pl-9"
        aria-label={tx("globalSearch")}
      />
      {show && (
        <div className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-xl border border-border bg-surface-2 shadow-lg">
          {isFetching && results.length === 0 ? (
            <p className="p-3 text-sm text-text-3">{tx("searching")}</p>
          ) : results.length === 0 ? (
            <p className="p-3 text-sm text-text-3">{tx("noResults")}</p>
          ) : (
            results.map((c) => (
              <Link
                key={c.id}
                href={`/markets/${c.id}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 hover:bg-surface-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.image} alt="" width={20} height={20} loading="lazy" className="rounded-full" />
                <span className="text-sm font-medium">{c.symbol}</span>
                <span className="truncate text-xs text-text-3">{c.name}</span>
                {c.rank !== null && <span className="ml-auto text-xs text-text-3">#{c.rank}</span>}
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
