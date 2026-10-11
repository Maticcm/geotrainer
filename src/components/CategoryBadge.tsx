"use client";

import type { GeographyCategory } from "@/lib/types";
import { useT } from "@/lib/hooks";
import { categoryLabelKey } from "@/lib/i18n";
import {
  Waves,
  Globe2,
  Mountain,
  Navigation,
  Landmark,
  Spline,
  Droplets,
  Palmtree,
  SunMedium,
  Compass,
  type LucideIcon,
} from "lucide-react";

export const CATEGORY_LUCIDE_ICONS: Record<GeographyCategory, LucideIcon> = {
  "oceans-seas": Waves,
  continents: Globe2,
  mountains: Mountain,
  "canals-straits": Navigation,
  countries: Landmark,
  rivers: Spline,
  lakes: Droplets,
  islands: Palmtree,
  deserts: SunMedium,
  peninsulas: Compass,
};

// Fallback text/icon representation
export const CATEGORY_ICONS: Record<GeographyCategory, string> = {
  "oceans-seas": "🌊",
  continents: "🌍",
  mountains: "⛰️",
  "canals-straits": "🧭",
  countries: "🏛️",
  rivers: "〰️",
  lakes: "💧",
  islands: "🏝️",
  deserts: "☀️",
  peninsulas: "⚓",
};

export const CATEGORY_COLORS: Record<GeographyCategory, { bg: string; text: string; border: string; accent: string }> = {
  "oceans-seas": { bg: "bg-sky-500/10", text: "text-sky-600 dark:text-sky-400", border: "border-sky-500/20", accent: "#0284c7" },
  continents: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/20", accent: "#059669" },
  mountains: { bg: "bg-amber-500/10", text: "text-amber-700 dark:text-amber-400", border: "border-amber-500/20", accent: "#d97706" },
  "canals-straits": { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/20", accent: "#2563eb" },
  countries: { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/20", accent: "#7c3aed" },
  rivers: { bg: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-500/20", accent: "#0891b2" },
  lakes: { bg: "bg-teal-500/10", text: "text-teal-600 dark:text-teal-400", border: "border-teal-500/20", accent: "#0d9488" },
  islands: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/20", accent: "#10b981" },
  deserts: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/20", accent: "#ea580c" },
  peninsulas: { bg: "bg-indigo-500/10", text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-500/20", accent: "#4f46e5" },
};

export function CategoryIcon({
  category,
  className = "h-4 w-4",
}: {
  category: GeographyCategory;
  className?: string;
}) {
  const IconComponent = CATEGORY_LUCIDE_ICONS[category];
  return <IconComponent className={className} strokeWidth={2} />;
}

export function CategoryBadge({
  category,
  size = "md",
  showIcon = true,
}: {
  category: GeographyCategory;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}) {
  const { t } = useT();
  const label = t(categoryLabelKey(category));
  const color = CATEGORY_COLORS[category];

  const sizeClasses = {
    sm: "text-[11px] px-2 py-0.5 gap-1.5",
    md: "text-xs px-2.5 py-1 gap-1.5",
    lg: "text-sm px-3.5 py-1.5 gap-2",
  }[size];

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  }[size];

  return (
    <span
      className={`inline-flex items-center font-medium rounded-md border ${color.bg} ${color.text} ${color.border} ${sizeClasses}`}
    >
      {showIcon && <CategoryIcon category={category} className={iconSizes} />}
      <span>{label}</span>
    </span>
  );
}
