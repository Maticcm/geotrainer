"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useProgress, useT } from "@/lib/hooks";
import { CATEGORIES, type GeographyCategory } from "@/lib/types";
import { FEATURE_BY_ID, featuresInCategory } from "@/data/features";
import { getGeometry, loadCategoryGeometry } from "@/lib/geometry";
import { masteryLevel } from "@/lib/srs";
import { InteractiveMap } from "@/components/Map/InteractiveMap";
import { CategoryBadge, CategoryIcon } from "@/components/CategoryBadge";
import { categoryLabelKey } from "@/lib/i18n";
import Link from "next/link";
import {
  Play,
  Search,
  Lightbulb,
  MapPin,
  List,
} from "lucide-react";

function PracticeContent() {
  const searchParams = useSearchParams();
  const { t, lang } = useT();
  const progress = useProgress();

  const initialCat = (searchParams.get("cat") as GeographyCategory) || "oceans-seas";
  const [selectedCat, setSelectedCat] = useState<GeographyCategory>(
    CATEGORIES.includes(initialCat) ? initialCat : "oceans-seas"
  );
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [fitTrigger, setFitTrigger] = useState(1);
  const [mobileTab, setMobileTab] = useState<"map" | "list">("map");

  // Load geometry for the selected category
  useEffect(() => {
    loadCategoryGeometry(selectedCat).catch(console.error);
  }, [selectedCat]);

  const categoryFeatures = useMemo(() => {
    const list = featuresInCategory(selectedCat, false);
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.nameEn.toLowerCase().includes(q) ||
        f.aliases?.some((a) => a.toLowerCase().includes(q))
    );
  }, [selectedCat, searchQuery]);

  const effectiveFeatureId =
    selectedFeatureId && categoryFeatures.some((f) => f.id === selectedFeatureId)
      ? selectedFeatureId
      : categoryFeatures[0]?.id ?? null;

  const selectedFeature = effectiveFeatureId ? FEATURE_BY_ID.get(effectiveFeatureId) : null;
  const selectedGeom = effectiveFeatureId ? getGeometry(effectiveFeatureId) : undefined;
  const featureProgress = effectiveFeatureId ? progress.features[effectiveFeatureId] : undefined;
  const level = masteryLevel(featureProgress);

  const handleSelectFeature = (id: string) => {
    setSelectedFeatureId(id);
    setFitTrigger((c) => c + 1);
    setMobileTab("map"); // Automatically bring up map with the chosen feature highlighted on mobile!
  };

  const handleSelectCat = (cat: GeographyCategory) => {
    setSelectedCat(cat);
    setSelectedFeatureId(null);
    setSearchQuery("");
    setFitTrigger((c) => c + 1);
  };

  const masteryLabels = [
    t("mastery.0"),
    t("mastery.1"),
    t("mastery.2"),
    t("mastery.3"),
    t("mastery.4"),
  ];

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
      {/* Category Tabs Header Strip */}
      <div className="border-b border-[var(--border)] bg-[var(--card)] px-3 sm:px-6 py-2 overflow-x-auto no-scrollbar z-10 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1.5 min-w-max">
          {CATEGORIES.map((cat) => {
            const active = selectedCat === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => handleSelectCat(cat)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all touch-manipulation ${
                  active
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <CategoryIcon category={cat} className="h-3.5 w-3.5" />
                <span>{t(categoryLabelKey(cat))}</span>
              </button>
            );
          })}
        </div>

        {/* Start practice CTA */}
        <div className="flex items-center gap-2 min-w-max">
          <Link
            href={`/play/locate?cats=${selectedCat}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 text-white px-3 py-1.5 text-xs font-bold shadow-2xs hover:bg-blue-700 transition-colors"
          >
            <Play className="h-3 w-3 fill-current" />
            <span>{t("practice.startLocate")}</span>
          </Link>
        </div>
      </div>

      {/* Mobile View Toggle Segmented Control (Visible only on mobile < md) */}
      <div className="md:hidden flex items-center border-b border-[var(--border)] bg-[var(--card)] p-1.5 gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => setMobileTab("map")}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === "map"
              ? "bg-blue-600 text-white shadow-2xs"
              : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          }`}
        >
          <MapPin className="h-3.5 w-3.5" />
          <span>Zemljevid</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("list")}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === "list"
              ? "bg-blue-600 text-white shadow-2xs"
              : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          }`}
        >
          <List className="h-3.5 w-3.5" />
          <span>Seznam ({categoryFeatures.length})</span>
        </button>
      </div>

      {/* Main Split Content: Explorer List on Left, Map & Details on Right */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* Features List Sidebar */}
        <div
          className={`w-full md:w-80 lg:w-88 border-b md:border-b-0 md:border-r border-[var(--border)] bg-[var(--card)] flex flex-col min-h-0 overflow-hidden shrink-0 ${
            mobileTab === "list" ? "flex flex-1" : "hidden md:flex"
          }`}
        >
          {/* Search Bar */}
          <div className="p-2.5 border-b border-[var(--border)]">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Išči lokacije v kategoriji …"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] pl-8 pr-3 py-1.5 text-xs text-[var(--foreground)] focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--muted)]/40 flex items-center justify-between text-[11px] text-[var(--muted-foreground)] font-semibold">
            <span>{categoryFeatures.length} {t("practice.features").toLowerCase()}</span>
            <span>Stopnja znanja</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]/60 pb-4">
            {categoryFeatures.map((f) => {
              const active = effectiveFeatureId === f.id;
              const p = progress.features[f.id];
              const lvl = masteryLevel(p);

              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleSelectFeature(f.id)}
                  className={`w-full text-left p-3 flex items-center justify-between transition-colors ${
                    active
                      ? "bg-blue-500/10 border-l-3 border-blue-600"
                      : "hover:bg-[var(--muted)]/40"
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-[var(--foreground)] truncate">
                        {f.name}
                      </span>
                      {!f.syllabus && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold">
                          dodatno
                        </span>
                      )}
                      {f.geometryKind === "approximate" && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-500/10 text-slate-500 font-semibold">
                          {t("practice.approxBadge")}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[var(--muted-foreground)] truncate mt-0.5">
                      {f.nameEn}
                    </div>
                  </div>

                  {/* Mastery Indicator (Dots) */}
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4].map((star) => (
                      <span
                        key={star}
                        className={`text-[9px] ${
                          lvl >= star
                            ? "text-emerald-600 dark:text-emerald-400 font-bold"
                            : "text-slate-300 dark:text-slate-700"
                        }`}
                      >
                        ●
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Map Canvas and Feature Details Drawer */}
        <div
          className={`flex-1 flex flex-col h-full min-h-0 relative overflow-hidden ${
            mobileTab === "map" ? "flex" : "hidden md:flex"
          }`}
        >
          <div className="flex-1 h-full min-h-[220px] sm:min-h-[350px] relative">
            <InteractiveMap
              interactive={false}
              targetGeometry={selectedGeom}
              targetFeatureMeta={selectedFeature}
              showReview={true}
              showLabels={false}
              fitTargetTrigger={fitTrigger}
            />
          </div>

          {/* Bottom Feature Details Drawer */}
          {selectedFeature && (
            <div className="border-t border-[var(--border)] bg-[var(--card)] p-4 sm:p-5 shadow-lg z-10 max-h-48 overflow-y-auto shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black text-[var(--foreground)] tracking-tight">
                      {selectedFeature.name}
                    </h2>
                    <CategoryBadge category={selectedFeature.category} size="sm" />
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    angl. <span className="text-[var(--foreground)] font-medium">{selectedFeature.nameEn}</span>
                    {selectedFeature.aliases.length > 0 &&
                      ` · vzdevki: ${selectedFeature.aliases.join(", ")}`}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] text-[var(--muted-foreground)] block">Obvladanost:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {masteryLabels[level]}
                    </span>
                  </div>
                  {featureProgress && featureProgress.attempts > 0 && (
                    <div className="text-right border-l border-[var(--border)] pl-3">
                      <span className="text-[10px] text-[var(--muted-foreground)] block">Odgovori:</span>
                      <span className="font-bold text-[var(--foreground)]">
                        {featureProgress.correct} / {featureProgress.attempts}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {selectedFeature.fact && (
                <div className="text-xs text-[var(--foreground)] leading-relaxed flex items-start gap-1.5 mt-2">
                  <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>{selectedFeature.fact[lang]}</span>
                </div>
              )}

              {selectedFeature.note && (
                <p className="text-[11px] text-[var(--muted-foreground)] italic mt-1 pl-5">
                  Opomba: {selectedFeature.note}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-[var(--muted-foreground)]">Nalagam …</div>}>
      <PracticeContent />
    </Suspense>
  );
}

