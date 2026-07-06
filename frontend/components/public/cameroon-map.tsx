"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { MapPin, Sparkles, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface CityNode {
  id: string;
  name: string;
  nameFr: string;
  x: number;
  y: number;
  traders: number;
  volume: string;
}

const CITIES: CityNode[] = [
  { id: "maroua", name: "Maroua", nameFr: "Maroua", x: 210, y: 40, traders: 142, volume: "12.5K" },
  { id: "garoua", name: "Garoua", nameFr: "Garoua", x: 170, y: 110, traders: 289, volume: "24.1K" },
  { id: "ngaoundere", name: "Ngaoundéré", nameFr: "Ngaoundéré", x: 160, y: 190, traders: 312, volume: "31.8K" },
  { id: "bamenda", name: "Bamenda", nameFr: "Bamenda", x: 60, y: 240, traders: 410, volume: "45.0K" },
  { id: "bafoussam", name: "Bafoussam", nameFr: "Bafoussam", x: 80, y: 260, traders: 520, volume: "58.2K" },
  { id: "buea", name: "Buea", nameFr: "Buea", x: 50, y: 320, traders: 380, volume: "39.5K" },
  { id: "douala", name: "Douala", nameFr: "Douala", x: 70, y: 310, traders: 2450, volume: "342.0K" },
  { id: "yaounde", name: "Yaoundé", nameFr: "Yaoundé", x: 120, y: 300, traders: 1890, volume: "265.4K" },
];

const CONNECTIONS = [
  { from: "douala", to: "yaounde" },
  { from: "douala", to: "bafoussam" },
  { from: "douala", to: "buea" },
  { from: "yaounde", to: "ngaoundere" },
  { from: "ngaoundere", to: "garoua" },
  { from: "garoua", to: "maroua" },
  { from: "bafoussam", to: "bamenda" },
];

export function CameroonMap({ locale = "en" }: { locale?: string }): React.JSX.Element {
  const reduce = useReducedMotion();
  const [hoveredCity, setHoveredCity] = useState<CityNode | null>(null);

  // Default to Yaounde active if none hovered to show initial details
  const activeCity = hoveredCity || CITIES[6]; // Douala

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-1/40 p-6 md:p-8">
      {/* Blueprint background grid */}
      <div className="absolute inset-0 -z-10 bg-grid-pattern opacity-25" aria-hidden />

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 items-center">
        {/* Left pane: The Map */}
        <div className="relative flex justify-center bg-bg/40 rounded-xl border border-border/60 p-4">
          <svg
            width="280"
            height="390"
            viewBox="0 0 280 390"
            className="w-full max-w-[280px] h-auto select-none"
            role="img"
            aria-label="Interactive map of Cameroon trading routes"
          >
            {/* Abstract boundary of Cameroon */}
            <motion.path
              d="M100 220 L160 180 L180 100 L240 30 L220 70 L190 120 L190 200 L160 220 L180 270 L160 340 L110 380 L80 340 L40 330 L40 280 Z"
              fill="rgba(21, 158, 133, 0.03)"
              stroke="var(--color-border)"
              strokeWidth="1.5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
            />

            {/* Connection Network Lines */}
            {CONNECTIONS.map((conn, idx) => {
              const start = CITIES.find((c) => c.id === conn.from)!;
              const end = CITIES.find((c) => c.id === conn.to)!;
              return (
                <g key={idx}>
                  <line
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    stroke="var(--color-border)"
                    strokeWidth="1"
                    className="opacity-40"
                  />
                  {/* Glowing transaction flow animation line */}
                  {!reduce && (
                    <motion.line
                      x1={start.x}
                      y1={start.y}
                      x2={end.x}
                      y2={end.y}
                      stroke="var(--color-accent-400)"
                      strokeWidth="1.5"
                      strokeDasharray="4 20"
                      animate={{ strokeDashoffset: [-60, 60] }}
                      transition={{
                        duration: 3 + idx,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="opacity-70"
                    />
                  )}
                </g>
              );
            })}

            {/* Interactive City Nodes */}
            {CITIES.map((city) => {
              const isHovered = hoveredCity?.id === city.id;
              const isActive = activeCity.id === city.id;
              return (
                <g
                  key={city.id}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredCity(city)}
                  onMouseLeave={() => setHoveredCity(null)}
                >
                  {/* Hover background halo ring */}
                  <motion.circle
                    cx={city.x}
                    cy={city.y}
                    r={isActive ? 10 : 6}
                    fill="var(--color-accent-400)"
                    animate={reduce ? undefined : { scale: isActive ? [1, 1.4, 1] : 1, opacity: isActive ? [0.15, 0.35, 0.15] : 0 }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  {/* Outer ring */}
                  <circle
                    cx={city.x}
                    cy={city.y}
                    r={isActive ? 5 : 3.5}
                    fill="none"
                    stroke={isActive ? "var(--color-accent-400)" : "var(--color-text-3)"}
                    strokeWidth="1.5"
                  />
                  {/* Core node dot */}
                  <circle
                    cx={city.x}
                    cy={city.y}
                    r="2"
                    fill={isActive ? "var(--color-bg)" : "var(--color-accent-400)"}
                    className="transition-colors duration-200"
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Right pane: Active City Stats Card */}
        <div className="flex flex-col justify-between h-full bg-surface-2/30 rounded-xl border border-border p-5 md:p-6 min-h-[300px]">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-400/10 text-accent-400">
                <TrendingUp size={12} />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-text-3">
                {locale === "fr" ? "Activité P2P Régionale" : "Regional P2P Activity"}
              </span>
            </div>

            <div className="space-y-4">
              <div className="flex items-baseline gap-2.5">
                <h3 className="font-display text-2xl font-bold text-text-1">
                  {locale === "fr" ? activeCity.nameFr : cityDisplayName(activeCity)}
                </h3>
                <span className="inline-flex items-center gap-1 text-xs text-accent-400 font-semibold">
                  <MapPin size={12} /> Cameroon
                </span>
              </div>

              <p className="text-xs text-text-2 leading-relaxed">
                {locale === "fr" 
                  ? `Douala et Yaoundé connectent les traders de tout le pays via MTN MoMo et Orange Money, facilitant l'accès sécurisé à l'USDT.`
                  : `Connecting decentralized traders across Cameroon cities. Orders are matched off-chain and secured instantly inside our escrow ledger.`}
              </p>

              {/* Data metrics */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="rounded-lg border border-border bg-surface-1/60 p-3.5 text-center">
                  <div className="font-money text-lg font-bold text-text-1 tabular-nums">
                    {activeCity.traders.toLocaleString()}
                  </div>
                  <div className="mt-1 text-[10px] text-text-3 uppercase tracking-wider">
                    {locale === "fr" ? "Traders Actifs" : "Active Traders"}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-surface-1/60 p-3.5 text-center">
                  <div className="font-money text-lg font-bold text-accent-400 tabular-nums">
                    {activeCity.volume} USDT
                  </div>
                  <div className="mt-1 text-[10px] text-text-3 uppercase tracking-wider">
                    {locale === "fr" ? "Volume Mensuel" : "Monthly Volume"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 text-[11px] text-text-3 flex items-center gap-1.5 border-t border-border/40 pt-4">
            <Sparkles size={12} className="text-accent-400" />
            <span>
              {locale === "fr" ? "Survolez les points pour changer de région" : "Hover over city nodes to inspect regions"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function cityDisplayName(city: CityNode): string {
  // strip diacritics for basic display if needed, but rendering unicode is perfect in react
  return city.name;
}
