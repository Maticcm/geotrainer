"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Geometry } from "geojson";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Type,
  Maximize2,
  Minimize2,
  Compass,
  Grid,
  Globe,
  HelpCircle,
  X,
} from "lucide-react";
import type { FeatureMeta, LatLng } from "@/lib/types";
import { useIsDark } from "@/lib/hooks";
import { geometryToSvgPath, projectLatLng, unprojectSvgPoint } from "@/lib/robinson";
import worldMapData from "@/data/worldMapData.json";

export interface HighlightItem {
  id: string;
  label?: string;
  geometry: Geometry;
  color?: string;
  onClick?: () => void;
}

export interface VectorSvgMapProps {
  center?: [number, number];
  zoom?: number;
  interactive?: boolean;
  userGuess?: LatLng | null;
  onMapClick?: (p: LatLng) => void;
  targetGeometry?: Geometry | null;
  targetFeatureMeta?: FeatureMeta | null;
  nearestPoint?: LatLng | null;
  highlights?: HighlightItem[];
  showReview?: boolean;
  isCorrect?: boolean | null;
  showLabels?: boolean;
  fitTargetTrigger?: number;
  resetTrigger?: number | string;
}

const VIEW_W = 895.92;
const VIEW_H = 471.76;

const COUNTRY_ID_MAP: Record<string, string> = {
  usa: "United_States",
  "united-kingdom": "United_Kingdom",
  russia: "Russia",
  china: "China",
  india: "India",
  japan: "Japan",
  canada: "Canada",
  brazil: "Brazil",
  mexico: "Mexico",
  argentina: "Argentina",
  chile: "Chile",
  peru: "Peru",
  egypt: "Egypt",
  "south-africa": "South_Africa",
  italy: "Italy",
  spain: "Spain",
  "saudi-arabia": "Saudi_Arabia",
  australia: "Australia",
  "new-zealand": "New_Zealand",
  madagascar: "Madagascar",
  cuba: "Cuba",
  iceland: "Iceland",
  greenland: "Greenland",
  tasmania: "Australia",
};

const TIER_1_LABELS = new Set([
  "Russia_label",
  "Canada_label",
  "United_States_label",
  "China_label",
  "Brazil_label",
  "Australia_label",
  "India_label",
  "Argentina_label",
  "Saudi_Arabia_label",
  "Greenland_label",
  "Mexico_label",
  "Egypt_label",
  "South_Africa_label",
  "Algeria_label",
  "Kazakhstan_label",
  "Indonesia_label",
  "Germany_label",
  "France_label",
  "United_Kingdom_label",
  "Spain_label",
  "Italy_label",
  "Japan_label",
  "Nigeria_label",
  "Colombia_label",
  "New_Zealand_label",
]);

const TIER_2_LABELS = new Set([
  "Germany_label",
  "France_label",
  "United_Kingdom_label",
  "Spain_label",
  "Italy_label",
  "Japan_label",
  "Poland_label",
  "Ukraine_label",
  "Türkiye_label",
  "Iran_label",
  "Nigeria_label",
  "Colombia_label",
  "Peru_label",
  "Chile_label",
  "Sweden_label",
  "Norway_label",
  "Finland_label",
  "Thailand_label",
  "Vietnam_label",
  "New_Zealand_label",
  "Morocco_label",
  "Kenya_label",
  "Ethiopia_label",
  "Sudan_label",
  "Pakistan_label",
  "Mongolia_label",
  "Libya_label",
  "Chad_label",
  "Niger_label",
  "Mali_label",
  "DR_Congo_label",
]);

const EXCLUDE_SUBDIVISIONS = new Set([
  "England_label",
  "Wales_label",
  "Scotland_label",
  "Northern_Ireland_label",
]);

const REGION_PRESETS = [
  { name: "Svet", lat: 20, lng: 0, scale: 1 },
  { name: "Evropa", lat: 50, lng: 15, scale: 2.8 },
  { name: "Azija", lat: 35, lng: 90, scale: 2.0 },
  { name: "Afrika", lat: 5, lng: 20, scale: 2.2 },
  { name: "Sev. Amerika", lat: 45, lng: -100, scale: 2.0 },
  { name: "Juž. Amerika", lat: -20, lng: -60, scale: 2.2 },
  { name: "Avstralija", lat: -25, lng: 135, scale: 2.4 },
];

function formatLat(lat: number): string {
  const dir = lat >= 0 ? "N" : "S";
  return `${Math.abs(lat).toFixed(1)}° ${dir}`;
}

function formatLng(lng: number): string {
  const dir = lng >= 0 ? "E" : "W";
  return `${Math.abs(lng).toFixed(1)}° ${dir}`;
}

/**
 * ⚡ PERFORMANCE CRITICAL:
 * Memoized static base world paths & island circles (~910KB of SVG geometry).
 * Extracted so React NEVER diffs 250+ paths during map pan, zoom, hover, or clicks.
 * No SVG raster filter drop-shadow is applied here to avoid catastrophic GPU/CPU raster bottlenecks.
 */
const StaticWorldPaths = React.memo(function StaticWorldPaths({ isDark }: { isDark: boolean }) {
  return (
    <>
      <g>
        {worldMapData.paths.map((p) => (
          <path
            key={p.id}
            id={p.id}
            d={p.d}
            className={
              isDark
                ? "fill-[#152136] hover:fill-[#223554] stroke-[#2c3e5e]"
                : "fill-[#ffffff] hover:fill-[#f1f5f9] stroke-[#94a3b8]"
            }
            strokeWidth={isDark ? "0.5" : "0.6"}
          />
        ))}
      </g>
      <g>
        {worldMapData.circles.map((c) => (
          <circle
            key={c.id}
            id={c.id}
            cx={c.cx}
            cy={c.cy}
            r={c.r}
            className={
              isDark
                ? "fill-[#1e2d47] stroke-[#2c3e5e]"
                : "fill-[#ffffff] stroke-[#94a3b8]"
            }
            strokeWidth="0.4"
          />
        ))}
      </g>
    </>
  );
});

/**
 * ⚡ PERFORMANCE CRITICAL & CARTOGRAPHICALLY DECLUTTERED:
 * Zoom-tiered country text labels with greedy 2D bounding-box collision detection.
 * Prevents overlapping country names while dynamically placing labels as the user zooms in.
 */
const CountryLabels = React.memo(function CountryLabels({
  labelsVisible,
  scale,
  isDark,
  targetCountryId,
}: {
  labelsVisible: boolean;
  scale: number;
  isDark: boolean;
  targetCountryId?: string | null;
}) {
  const filteredLabels = useMemo(() => {
    if (!labelsVisible) return [];

    // Scale font size gracefully with map zoom
    const baseFontSize = Math.max(2.1, Math.min(3.6, 3.6 / Math.pow(scale, 0.35)));

    const matchTarget = (id: string) => {
      if (!targetCountryId) return false;
      const tLow = targetCountryId.toLowerCase();
      const idLow = id.toLowerCase();
      return (
        idLow === tLow ||
        idLow === `${tLow}_label` ||
        idLow.replace(/_/g, "") === tLow.replace(/_/g, "")
      );
    };

    // Filter candidate labels based on zoom tier
    const candidates = worldMapData.labels.filter((lbl) => {
      if (matchTarget(lbl.id)) return true;
      if (EXCLUDE_SUBDIVISIONS.has(lbl.id) && scale < 5.0) return false;
      if (TIER_1_LABELS.has(lbl.id)) return true;
      if (scale >= 1.6 && TIER_2_LABELS.has(lbl.id)) return true;
      if (scale >= 2.6) return true;
      return false;
    });

    // Sort: target country has absolute priority 0, then Tier 1, then Tier 2, then Tier 3
    candidates.sort((a, b) => {
      const aTarget = matchTarget(a.id);
      const bTarget = matchTarget(b.id);
      if (aTarget) return -1;
      if (bTarget) return 1;

      const aScore = TIER_1_LABELS.has(a.id) ? 1 : TIER_2_LABELS.has(a.id) ? 2 : 3;
      const bScore = TIER_1_LABELS.has(b.id) ? 1 : TIER_2_LABELS.has(b.id) ? 2 : 3;
      return aScore - bScore;
    });

    // Greedy 2D Bounding-Box Spatial Decluttering (O(N) with placed boxes)
    const placedBoxes: { x1: number; x2: number; y1: number; y2: number }[] = [];
    const placedLabels: {
      id: string;
      text: string;
      x: number;
      y: number;
      fontSize: number;
      isTarget: boolean;
    }[] = [];
    const pad = 1.0;

    for (const lbl of candidates) {
      const isTarget = matchTarget(lbl.id);
      const isTier1 = TIER_1_LABELS.has(lbl.id);
      const curFontSize = isTarget ? baseFontSize * 1.15 : isTier1 ? baseFontSize : baseFontSize * 0.9;
      const charW = curFontSize * 0.52;
      const w = lbl.text.length * charW + pad * 2;
      const h = curFontSize * 1.1 + pad * 2;

      const box = {
        x1: lbl.x - w / 2,
        x2: lbl.x + w / 2,
        y1: lbl.y - h / 2,
        y2: lbl.y + h / 2,
      };

      if (!isTarget) {
        const collides = placedBoxes.some(
          (p) => !(box.x2 < p.x1 || box.x1 > p.x2 || box.y2 < p.y1 || box.y1 > p.y2)
        );
        if (collides) continue;
      }

      placedBoxes.push(box);
      placedLabels.push({
        id: lbl.id,
        text: lbl.text,
        x: lbl.x,
        y: lbl.y,
        fontSize: curFontSize,
        isTarget,
      });
    }

    return placedLabels;
  }, [labelsVisible, scale, targetCountryId]);

  if (!labelsVisible || filteredLabels.length === 0) return null;

  return (
    <g className="pointer-events-none select-none">
      {filteredLabels.map((lbl) => (
        <text
          key={lbl.id}
          id={lbl.id}
          x={lbl.x}
          y={lbl.y}
          textAnchor="middle"
          fontSize={`${lbl.fontSize.toFixed(2)}px`}
          className={`font-semibold tracking-normal uppercase ${
            lbl.isTarget
              ? "fill-emerald-400 font-bold"
              : isDark
              ? "fill-slate-100"
              : "fill-slate-800"
          }`}
          style={{
            fontFamily: "system-ui, -apple-system, sans-serif",
            paintOrder: "stroke fill",
            stroke: lbl.isTarget
              ? isDark
                ? "rgba(6, 78, 59, 0.95)"
                : "rgba(236, 253, 245, 0.95)"
              : isDark
              ? "rgba(10, 15, 30, 0.92)"
              : "rgba(255, 255, 255, 0.92)",
            strokeWidth: lbl.isTarget ? "0.9px" : "0.7px",
            strokeLinejoin: "round",
          }}
        >
          {lbl.text}
        </text>
      ))}
    </g>
  );
});

/**
 * ⚡ Viewport pan boundary clamping: keeps the world comfortably in view and prevents lost-map state.
 */
function clampPan(panX: number, panY: number, curScale: number): { x: number; y: number } {
  if (curScale <= 1.02) {
    return { x: 0, y: 0 };
  }
  const minX = VIEW_W - VIEW_W * curScale - 24;
  const maxX = 24;
  const minY = VIEW_H - VIEW_H * curScale - 24;
  const maxY = 24;
  return {
    x: Math.min(maxX, Math.max(minX, panX)),
    y: Math.min(maxY, Math.max(minY, panY)),
  };
}

export default function VectorSvgMap({
  interactive = true,
  userGuess = null,
  onMapClick,
  targetGeometry = null,
  targetFeatureMeta = null,
  nearestPoint = null,
  highlights = [],
  showReview = false,
  isCorrect = null,
  showLabels = false,
  fitTargetTrigger = 0,
  resetTrigger,
}: VectorSvgMapProps) {
  const isDark = useIsDark();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const contentGroupRef = useRef<SVGGElement>(null);

  // Marker DOM refs for instant zero-lag counter-scaling during animations
  const targetMarkerRef = useRef<SVGGElement>(null);
  const guessMarkerRef = useRef<SVGGElement>(null);
  const connectorLineRef = useRef<SVGLineElement>(null);

  // HUD text DOM refs: zero React re-render overhead while moving cursor
  const coordsTextRef = useRef<HTMLSpanElement>(null);
  const countryTextRef = useRef<HTMLSpanElement>(null);

  // Transform state for Pan & Zoom
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Performance synchronization refs
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const panRef = useRef(pan);
  panRef.current = pan;
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number; panX: number; panY: number; scaleX: number; scaleY: number } | null>(null);
  const hasMovedRef = useRef(false);

  // RAF batching refs for smooth 60fps pan/zoom
  const rafPanIdRef = useRef<number | null>(null);
  const wheelRafRef = useRef<number | null>(null);
  const targetWheelRef = useRef<{ scale: number; panX: number; panY: number } | null>(null);
  const lastCoordUpdateRef = useRef(0);

  // Animation ref for smooth Fly-To transitions
  const animRef = useRef<number | null>(null);

  // Multi-touch pinch tracking
  const pinchRef = useRef<{
    initialDist: number;
    initialScale: number;
    initialPan: { x: number; y: number };
    midClientX: number;
    midClientY: number;
  } | null>(null);

  // Converts client (screen) coordinates to SVG viewBox coordinates [0..VIEW_W, 0..VIEW_H]
  const screenToSvgViewBox = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (ctm && typeof ctm.inverse === "function") {
      try {
        const inv = ctm.inverse();
        if (inv) {
          const pt = svg.createSVGPoint();
          pt.x = clientX;
          pt.y = clientY;
          const transformed = pt.matrixTransform(inv);
          if (Number.isFinite(transformed.x) && Number.isFinite(transformed.y)) {
            return { x: transformed.x, y: transformed.y };
          }
        }
      } catch {
        // Fallback to exact geometric aspect-ratio calculation below
      }
    }
    // High-precision bounding box fallback (100% mathematically exact to preserveAspectRatio="xMidYMid meet")
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const aspectVb = VIEW_W / VIEW_H;
    const aspectBox = rect.width / rect.height;
    let renderW = rect.width;
    let renderH = rect.height;
    let offX = 0;
    let offY = 0;
    if (aspectBox > aspectVb) {
      renderW = rect.height * aspectVb;
      offX = (rect.width - renderW) / 2;
    } else {
      renderH = rect.width / aspectVb;
      offY = (rect.height - renderH) / 2;
    }
    const localX = clientX - rect.left - offX;
    const localY = clientY - rect.top - offY;
    return {
      x: (localX / renderW) * VIEW_W,
      y: (localY / renderH) * VIEW_H,
    };
  }, []);

  // Converts client (screen) coordinates to internal map coordinates (accounting for pan & scale)
  const screenToMapInternal = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const contentGroup = contentGroupRef.current;
    const svg = svgRef.current;
    if (contentGroup && svg) {
      const ctm = contentGroup.getScreenCTM();
      if (ctm && typeof ctm.inverse === "function") {
        try {
          const inv = ctm.inverse();
          if (inv) {
            const pt = svg.createSVGPoint();
            pt.x = clientX;
            pt.y = clientY;
            const transformed = pt.matrixTransform(inv);
            if (Number.isFinite(transformed.x) && Number.isFinite(transformed.y)) {
              return { x: transformed.x, y: transformed.y };
            }
          }
        } catch {
          // Fallback to screenToSvgViewBox + state pan/scale
        }
      }
    }
    // Fallback using root SVG + state pan & scale
    const vb = screenToSvgViewBox(clientX, clientY);
    if (!vb) return null;
    return {
      x: (vb.x - panRef.current.x) / scaleRef.current,
      y: (vb.y - panRef.current.y) / scaleRef.current,
    };
  }, [screenToSvgViewBox]);

  // Internal toggles
  const [userLabelToggle, setUserLabelToggle] = useState<boolean | null>(null);
  const labelsVisible = userLabelToggle !== null ? userLabelToggle : showLabels;
  const [showGraticule, setShowGraticule] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showRegionMenu, setShowRegionMenu] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Click ripple effect
  const [clickEffect, setClickEffect] = useState<{ x: number; y: number } | null>(null);

  // Clean up any pending RAF frames on unmount
  useEffect(() => {
    return () => {
      if (rafPanIdRef.current !== null) cancelAnimationFrame(rafPanIdRef.current);
      if (wheelRafRef.current !== null) cancelAnimationFrame(wheelRafRef.current);
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, []);

  // Smooth 60fps animation to target (scale, panX, panY) with zero React re-render churn during interpolation
  const animateTo = useCallback((targetScale: number, targetPanX: number, targetPanY: number, durationMs = 380) => {
    if (animRef.current) cancelAnimationFrame(animRef.current);

    const clampedPan = clampPan(targetPanX, targetPanY, targetScale);
    const startScale = scaleRef.current;
    const startPanX = panRef.current.x;
    const startPanY = panRef.current.y;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const ease = 1 - Math.pow(1 - progress, 3); // Smooth ease-out cubic

      const curScale = startScale + (targetScale - startScale) * ease;
      const curPanX = startPanX + (clampedPan.x - startPanX) * ease;
      const curPanY = startPanY + (clampedPan.y - startPanY) * ease;

      scaleRef.current = curScale;
      panRef.current = { x: curPanX, y: curPanY };

      if (contentGroupRef.current) {
        contentGroupRef.current.setAttribute(
          "transform",
          `translate(${curPanX}, ${curPanY}) scale(${curScale})`
        );
      }

      if (progress < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        animRef.current = null;
        setScale(targetScale);
        setPan(clampedPan);
      }
    };

    animRef.current = requestAnimationFrame(step);
  }, []);

  // Fly smoothly to geographic coordinate
  const flyTo = useCallback((lat: number, lng: number, targetScale: number, duration = 400) => {
    const { x, y } = projectLatLng(lat, lng);
    const targetPanX = VIEW_W / 2 - x * targetScale;
    const targetPanY = VIEW_H / 2 - y * targetScale;
    animateTo(targetScale, targetPanX, targetPanY, duration);
  }, [animateTo]);

  // Reset view to full world map
  const handleResetView = useCallback(() => {
    animateTo(1, 0, 0, 320);
  }, [animateTo]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    const curScale = scaleRef.current;
    const curPan = panRef.current;
    const nextScale = Math.min(curScale * 1.5, 8);
    const curCenterX = (VIEW_W / 2 - curPan.x) / curScale;
    const curCenterY = (VIEW_H / 2 - curPan.y) / curScale;
    const nextPanX = VIEW_W / 2 - curCenterX * nextScale;
    const nextPanY = VIEW_H / 2 - curCenterY * nextScale;
    animateTo(nextScale, nextPanX, nextPanY, 250);
  }, [animateTo]);

  const handleZoomOut = useCallback(() => {
    const curScale = scaleRef.current;
    const curPan = panRef.current;
    const nextScale = Math.max(1, curScale / 1.5);
    if (nextScale <= 1.02) {
      animateTo(1, 0, 0, 250);
      return;
    }
    const curCenterX = (VIEW_W / 2 - curPan.x) / curScale;
    const curCenterY = (VIEW_H / 2 - curPan.y) / curScale;
    const nextPanX = VIEW_W / 2 - curCenterX * nextScale;
    const nextPanY = VIEW_H / 2 - curCenterY * nextScale;
    animateTo(nextScale, nextPanX, nextPanY, 250);
  }, [animateTo]);

  // Center / Fly-to target feature & user guess so both are visible in viewport
  const prevTriggerRef = useRef(fitTargetTrigger);
  useEffect(() => {
    if (!fitTargetTrigger || fitTargetTrigger === prevTriggerRef.current) {
      prevTriggerRef.current = fitTargetTrigger;
      return;
    }
    prevTriggerRef.current = fitTargetTrigger;

    const pt = nearestPoint || (targetFeatureMeta?.approx ? { lat: targetFeatureMeta.approx.lat, lng: targetFeatureMeta.approx.lng } : null);
    if (!pt) return;

    if (userGuess) {
      // Calculate midpoint and span to keep both guess and target comfortably in view
      const midLat = (userGuess.lat + pt.lat) / 2;
      const midLng = (userGuess.lng + pt.lng) / 2;
      const dLat = Math.abs(userGuess.lat - pt.lat);
      const dLng = Math.abs(userGuess.lng - pt.lng);
      const span = Math.max(dLat, dLng);

      let targetScale = 1.0;
      if (span < 8) targetScale = 3.2;
      else if (span < 20) targetScale = 2.4;
      else if (span < 45) targetScale = 1.8;
      else if (span < 85) targetScale = 1.35;
      else targetScale = 1.0;

      flyTo(midLat, midLng, targetScale, 450);
    } else {
      flyTo(pt.lat, pt.lng, 2.3, 450);
    }
  }, [fitTargetTrigger, targetFeatureMeta, nearestPoint, userGuess, flyTo]);

  // Reset map position each round when resetTrigger changes
  const prevResetRef = useRef(resetTrigger);
  useEffect(() => {
    if (resetTrigger === undefined) return;
    if (prevResetRef.current !== resetTrigger) {
      prevResetRef.current = resetTrigger;
      animateTo(1, 0, 0, 350);
    }
  }, [resetTrigger, animateTo]);

  // Double Click to Zoom In / Shift+Double Click to Zoom Out
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const vb = screenToSvgViewBox(e.clientX, e.clientY);
    if (!vb) return;

    const curScale = scaleRef.current;
    const curPan = panRef.current;
    const zoomFactor = e.shiftKey ? 1 / 1.6 : 1.6;
    const nextScale = Math.max(1, Math.min(8, curScale * zoomFactor));

    if (nextScale <= 1.02) {
      animateTo(1, 0, 0, 300);
      return;
    }

    const nextPanX = vb.x - (vb.x - curPan.x) * (nextScale / curScale);
    const nextPanY = vb.y - (vb.y - curPan.y) * (nextScale / curScale);

    animateTo(nextScale, nextPanX, nextPanY, 300);
  }, [animateTo, screenToSvgViewBox]);

  // Smooth, batch-accelerated Wheel Zoom (fluid on both mice & precision trackpads)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const vb = screenToSvgViewBox(e.clientX, e.clientY);
    if (!vb) return;

    const curScale = targetWheelRef.current?.scale || scaleRef.current;
    const curPan = targetWheelRef.current
      ? { x: targetWheelRef.current.panX, y: targetWheelRef.current.panY }
      : panRef.current;

    // Smooth exponential delta scaling (smooth on mice and trackpads)
    const zoomFactor = Math.exp(-e.deltaY * 0.0022);
    const nextScale = Math.max(1, Math.min(8, curScale * zoomFactor));

    let nextPanX = 0;
    let nextPanY = 0;

    if (nextScale <= 1.01) {
      nextPanX = 0;
      nextPanY = 0;
    } else {
      const rawPanX = vb.x - (vb.x - curPan.x) * (nextScale / curScale);
      const rawPanY = vb.y - (vb.y - curPan.y) * (nextScale / curScale);
      const clamped = clampPan(rawPanX, rawPanY, nextScale);
      nextPanX = clamped.x;
      nextPanY = clamped.y;
    }

    targetWheelRef.current = { scale: nextScale, panX: nextPanX, panY: nextPanY };
    scaleRef.current = nextScale;
    panRef.current = { x: nextPanX, y: nextPanY };

    // Instant direct DOM transform for buttery-smooth 60fps wheel zoom
    if (contentGroupRef.current) {
      contentGroupRef.current.setAttribute(
        "transform",
        `translate(${nextPanX}, ${nextPanY}) scale(${nextScale})`
      );
    }

    // Coalesce React state commits to animation frames
    if (wheelRafRef.current === null) {
      wheelRafRef.current = requestAnimationFrame(() => {
        wheelRafRef.current = null;
        if (targetWheelRef.current) {
          setScale(targetWheelRef.current.scale);
          setPan({ x: targetWheelRef.current.panX, y: targetWheelRef.current.panY });
          targetWheelRef.current = null;
        }
      });
    }
  }, [screenToSvgViewBox]);

  // Pointer drag handling: ZERO layout queries in move loop, zero React re-render churn
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;

    // Prevent map drags or clicks from starting on buttons or interactive UI controls
    const target = e.target as HTMLElement | null;
    if (
      target?.closest("button, [role='button'], a, input, select, textarea, [data-map-control]") ||
      (svgRef.current && !svgRef.current.contains(e.target as Node))
    ) {
      return;
    }

    isDraggingRef.current = true;
    hasMovedRef.current = false;

    // Cache CTM scale ratios once per drag gesture to avoid calling getScreenCTM() in move loop
    const ctm = svgRef.current?.getScreenCTM();
    const scaleX = ctm && ctm.a !== 0 ? 1 / ctm.a : 1;
    const scaleY = ctm && ctm.d !== 0 ? 1 / ctm.d : 1;

    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      panX: panRef.current.x,
      panY: panRef.current.y,
      scaleX,
      scaleY,
    };

    try {
      svgRef.current?.setPointerCapture?.(e.pointerId);
    } catch {
      // Pointer capture fallback
    }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    // ⚡ 1. DRAGGING MODE: Direct DOM transform without layout thrashing
    if (isDraggingRef.current && dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.clientX;
      const dy = e.clientY - dragStartRef.current.clientY;
      const dist = Math.hypot(dx, dy);

      if (dist > 12) {
        if (!hasMovedRef.current) {
          hasMovedRef.current = true;
          setIsDragging(true);
        }
      }

      if (hasMovedRef.current) {
        const rawPanX = dragStartRef.current.panX + dx * dragStartRef.current.scaleX;
        const rawPanY = dragStartRef.current.panY + dy * dragStartRef.current.scaleY;
        panRef.current = clampPan(rawPanX, rawPanY, scaleRef.current);

        if (rafPanIdRef.current === null) {
          rafPanIdRef.current = requestAnimationFrame(() => {
            rafPanIdRef.current = null;
            if (contentGroupRef.current) {
              contentGroupRef.current.setAttribute(
                "transform",
                `translate(${panRef.current.x}, ${panRef.current.y}) scale(${scaleRef.current})`
              );
            }
          });
        }
        return;
      }
    }

    // ⚡ 2. HOVER MODE: Direct DOM update of HUD without ANY React re-renders
    if (coordsTextRef.current) {
      const now = performance.now();
      if (now - lastCoordUpdateRef.current > 80) {
        lastCoordUpdateRef.current = now;
        const internal = screenToMapInternal(e.clientX, e.clientY);
        if (internal && internal.x >= 0 && internal.x <= VIEW_W && internal.y >= 0 && internal.y <= VIEW_H) {
          const latLng = unprojectSvgPoint(internal.x, internal.y);
          if (latLng && !isNaN(latLng.lat) && !isNaN(latLng.lng)) {
            coordsTextRef.current.textContent = `${formatLat(latLng.lat)}, ${formatLng(latLng.lng)}`;
            return;
          }
        }
        coordsTextRef.current.textContent = "";
      }
    }
  }, [screenToMapInternal]);

  const lastClickTimeRef = useRef(0);
  const processClick = useCallback((clientX: number, clientY: number) => {
    const now = performance.now();
    if (now - lastClickTimeRef.current < 250) return;
    lastClickTimeRef.current = now;

    if (!interactive || !onMapClick) return;

    const internal = screenToMapInternal(clientX, clientY);
    if (!internal) return;

    if (internal.x >= 0 && internal.x <= VIEW_W && internal.y >= 0 && internal.y <= VIEW_H) {
      setClickEffect({ x: internal.x, y: internal.y });
      setTimeout(() => setClickEffect(null), 600);

      const latLng = unprojectSvgPoint(internal.x, internal.y);
      if (latLng && !isNaN(latLng.lat) && !isNaN(latLng.lng)) {
        onMapClick(latLng);
      }
    }
  }, [interactive, onMapClick, screenToMapInternal]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const hadMoved = hasMovedRef.current;
    isDraggingRef.current = false;
    setIsDragging(false);

    try {
      svgRef.current?.releasePointerCapture?.(e.pointerId);
    } catch {
      // Ignore
    }

    // Flush any pending pan to state
    if (rafPanIdRef.current !== null) {
      cancelAnimationFrame(rafPanIdRef.current);
      rafPanIdRef.current = null;
    }

    if (hadMoved) {
      setPan({ ...panRef.current });
    } else {
      const target = e.target as HTMLElement | null;
      if (
        !target?.closest("button, [role='button'], a, input, select, textarea, [data-map-control]") &&
        (containerRef.current?.contains(target) || svgRef.current?.contains(target))
      ) {
        processClick(e.clientX, e.clientY);
      }
    }

    dragStartRef.current = null;
  }, [processClick]);

  const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const target = e.target as HTMLElement | null;
    if (
      target?.closest("button, [role='button'], a, input, select, textarea, [data-map-control]")
    ) {
      return;
    }
    if (!hasMovedRef.current) {
      processClick(e.clientX, e.clientY);
    }
  }, [processClick]);

  // Touch handlers for mobile pinch-to-zoom: Direct DOM transform for 60fps on phones
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      isDraggingRef.current = false;
      setIsDragging(false);
      dragStartRef.current = null;

      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

      pinchRef.current = {
        initialDist: dist,
        initialScale: scaleRef.current,
        initialPan: { ...panRef.current },
        midClientX: (t1.clientX + t2.clientX) / 2,
        midClientY: (t1.clientY + t2.clientY) / 2,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const ratio = dist / pinchRef.current.initialDist;
      const newScale = Math.max(1, Math.min(8, pinchRef.current.initialScale * ratio));

      const vb = screenToSvgViewBox(pinchRef.current.midClientX, pinchRef.current.midClientY);
      if (!vb) return;

      const rawPanX = vb.x - (vb.x - pinchRef.current.initialPan.x) * (newScale / pinchRef.current.initialScale);
      const rawPanY = vb.y - (vb.y - pinchRef.current.initialPan.y) * (newScale / pinchRef.current.initialScale);
      const clamped = clampPan(rawPanX, rawPanY, newScale);

      scaleRef.current = newScale;
      panRef.current = clamped;

      if (rafPanIdRef.current === null) {
        rafPanIdRef.current = requestAnimationFrame(() => {
          rafPanIdRef.current = null;
          if (contentGroupRef.current) {
            contentGroupRef.current.setAttribute(
              "transform",
              `translate(${panRef.current.x}, ${panRef.current.y}) scale(${scaleRef.current})`
            );
          }
        });
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2 && pinchRef.current) {
      pinchRef.current = null;
      setScale(scaleRef.current);
      setPan({ ...panRef.current });
    }
  };

  // Event delegation for hovered country name: Zero React re-renders via direct DOM update
  const handleSvgPointerOver = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (isDraggingRef.current) return;
    const target = e.target as SVGElement;
    if (countryTextRef.current && target && target.tagName === "path" && target.id && !target.id.includes("grid")) {
      countryTextRef.current.textContent = target.id.replace(/_/g, " ");
    }
  }, []);

  const handleSvgPointerLeave = useCallback(() => {
    if (countryTextRef.current) countryTextRef.current.textContent = "";
    if (coordsTextRef.current) coordsTextRef.current.textContent = "";
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === "0" || e.key.toLowerCase() === "r") {
        e.preventDefault();
        handleResetView();
      } else if (e.key.toLowerCase() === "l") {
        e.preventDefault();
        setUserLabelToggle((prev) => !(prev !== null ? prev : showLabels));
      } else if (e.key.toLowerCase() === "g") {
        e.preventDefault();
        setShowGraticule((prev) => !prev);
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") {
        e.preventDefault();
        setPan((p) => ({ ...p, x: p.x + 60 }));
      } else if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") {
        e.preventDefault();
        setPan((p) => ({ ...p, x: p.x - 60 }));
      } else if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") {
        e.preventDefault();
        setPan((p) => ({ ...p, y: p.y + 60 }));
      } else if (e.key === "ArrowDown" || e.key.toLowerCase() === "s") {
        e.preventDefault();
        setPan((p) => ({ ...p, y: p.y - 60 }));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleZoomIn, handleZoomOut, handleResetView, showLabels, toggleFullscreen]);

  // Projected Guess Marker
  const guessPt = useMemo(() => {
    if (!userGuess) return null;
    return projectLatLng(userGuess.lat, userGuess.lng);
  }, [userGuess]);

  // Projected Target Marker
  const targetPt = useMemo(() => {
    if (!nearestPoint && !targetFeatureMeta) return null;
    const pt = nearestPoint || (targetFeatureMeta?.approx ? { lat: targetFeatureMeta.approx.lat, lng: targetFeatureMeta.approx.lng } : null);
    if (!pt) return null;
    return projectLatLng(pt.lat, pt.lng);
  }, [nearestPoint, targetFeatureMeta]);

  // GeoJSON Target Overlay
  const targetPath = useMemo(() => {
    if (!targetGeometry) return "";
    return geometryToSvgPath(targetGeometry);
  }, [targetGeometry]);

  // Highlights overlays
  const highlightPaths = useMemo(() => {
    return highlights.map((h) => ({
      id: h.id,
      path: geometryToSvgPath(h.geometry),
      color: h.color || "#3b82f6",
      label: h.label,
    }));
  }, [highlights]);

  // Target country ID mapping
  const mappedTargetCountryId = useMemo(() => {
    if (!targetFeatureMeta) return null;
    return COUNTRY_ID_MAP[targetFeatureMeta.id] || null;
  }, [targetFeatureMeta]);

  // ⚡ Memoized target country path overlay (only computed once during review)
  const targetCountryPath = useMemo(() => {
    if (!showReview || !targetFeatureMeta) return null;
    const directId = mappedTargetCountryId;
    const metaId = targetFeatureMeta.id ? targetFeatureMeta.id.replace(/-/g, "_").toLowerCase() : "";
    const metaName = targetFeatureMeta.nameEn ? targetFeatureMeta.nameEn.replace(/\s+/g, "_").toLowerCase() : "";

    return (
      worldMapData.paths.find((p) => {
        if (directId && p.id === directId) return true;
        const pLow = p.id.toLowerCase();
        return (metaId && pLow === metaId) || (metaName && pLow === metaName);
      }) || null
    );
  }, [showReview, targetFeatureMeta, mappedTargetCountryId]);

  // Distance calculation
  const distanceKm = useMemo(() => {
    if (!userGuess || !nearestPoint) return null;
    const R = 6371;
    const dLat = ((nearestPoint.lat - userGuess.lat) * Math.PI) / 180;
    const dLng = ((nearestPoint.lng - userGuess.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((userGuess.lat * Math.PI) / 180) *
        Math.cos((nearestPoint.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(a))));
  }, [userGuess, nearestPoint]);

  return (
    <div
      ref={containerRef}
      data-map-canvas="true"
      className={`relative w-full h-full min-h-[420px] overflow-hidden select-none touch-none rounded-2xl border transition-colors duration-300 ${
        isDark
          ? "bg-[#070b14] border-slate-800 text-slate-100"
          : "bg-[#dbe7f3] border-slate-300 text-slate-900"
      }`}
      style={{ cursor: isDragging ? "grabbing" : interactive ? "crosshair" : "grab" }}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full h-full block"
        preserveAspectRatio="xMidYMid meet"
        shapeRendering="geometricPrecision"
        onClick={handleSvgClick}
        onPointerOver={handleSvgPointerOver}
        onPointerLeave={handleSvgPointerLeave}
      >
        <defs>
          {/* Graticule pattern */}
          <pattern id="ocean-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke={isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.12)"}
              strokeWidth="0.75"
            />
          </pattern>
        </defs>

        {/* Ocean Background & Graticule */}
        <rect width={VIEW_W} height={VIEW_H} fill={isDark ? "#070b14" : "#dbe7f3"} />
        {showGraticule && <rect width={VIEW_W} height={VIEW_H} fill="url(#ocean-grid)" />}

        {/* Dynamic Zoom & Pan Group (Hardware GPU-accelerated transform) */}
        <g
          ref={contentGroupRef}
          transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}
          style={{ willChange: "transform", transformOrigin: "0 0" }}
        >
          {/* Graticule Reference Lines (Equator, Tropics, Prime Meridian) */}
          {showGraticule && (
            <g className="opacity-40 pointer-events-none" stroke={isDark ? "#334155" : "#94a3b8"} strokeWidth="0.5" strokeDasharray="2 3">
              {/* Equator */}
              <line x1="10" y1="296.09" x2="885" y2="296.09" />
              {/* Prime Meridian */}
              <line x1="447.16" y1="15" x2="447.16" y2="460" />
              {/* Tropic of Cancer */}
              <line x1="30" y1="230.6" x2="865" y2="230.6" strokeDasharray="1 4" />
              {/* Tropic of Capricorn */}
              <line x1="30" y1="361.6" x2="865" y2="361.6" strokeDasharray="1 4" />
            </g>
          )}

          {/* ⚡ 1. Base Landmasses & Countries (Memoized static paths, zero diff during pan/zoom) */}
          <StaticWorldPaths isDark={isDark} />

          {/* ⚡ Target Country Highlight Overlay (Revealed ONLY during review - Pure GPU vector) */}
          {targetCountryPath && (
            <g className="pointer-events-none">
              <path
                d={targetCountryPath.d}
                fill="none"
                stroke="rgba(16, 185, 129, 0.4)"
                strokeWidth={5 / Math.max(0.1, scale)}
                strokeLinejoin="round"
                className="animate-pulse"
              />
              <path
                key={`target-highlight-${targetCountryPath.id}`}
                d={targetCountryPath.d}
                className="fill-emerald-500/70 stroke-emerald-300 stroke-[1.2]"
                strokeWidth={1.2 / Math.max(0.1, scale)}
                strokeLinejoin="round"
              />
            </g>
          )}

          {/* 2. GeoJSON Target Geometry Overlay (Revealed ONLY during review when no direct SVG path exists) */}
          {!targetCountryPath && targetPath && showReview && (
            <g className="pointer-events-none">
              <path
                d={targetPath}
                fill="none"
                stroke="rgba(16, 185, 129, 0.35)"
                strokeWidth={6 / Math.max(0.1, scale)}
                strokeLinejoin="round"
                className="animate-pulse"
              />
              <path
                d={targetPath}
                fill="rgba(16, 185, 129, 0.35)"
                stroke="#34d399"
                strokeWidth={2 / Math.max(0.1, scale)}
                strokeLinejoin="round"
              />
            </g>
          )}

          {/* 3. Practice Mode / Highlighted Features */}
          {highlightPaths.map((h) => (
            <path
              key={h.id}
              d={h.path}
              fill="rgba(59, 130, 246, 0.3)"
              stroke={h.color}
              strokeWidth="2"
              className="pointer-events-none animate-pulse"
            />
          ))}

          {/* 4. Country Labels (Cartographically decluttered, zero overlap, scale-filtered) */}
          <CountryLabels
            labelsVisible={labelsVisible}
            scale={scale}
            isDark={isDark}
            targetCountryId={targetCountryPath?.id || mappedTargetCountryId || targetFeatureMeta?.id || null}
          />

          {/* 5. Click Feedback Ripple (Fixed Screen Size) */}
          {clickEffect && (
            <circle
              cx={clickEffect.x}
              cy={clickEffect.y}
              r={12 / Math.max(0.1, scale)}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={1.5 / Math.max(0.1, scale)}
              className="animate-ping pointer-events-none opacity-80"
            />
          )}

          {/* 6. Review Mode: Vector Distance Line connecting Guess to Target (Minimalist, No Text) */}
          {showReview && guessPt && targetPt && (
            <g className="pointer-events-none animate-slide-up-fade">
              <line
                ref={connectorLineRef}
                x1={guessPt.x}
                y1={guessPt.y}
                x2={targetPt.x}
                y2={targetPt.y}
                stroke={isCorrect ? "#10b981" : "#ef4444"}
                strokeWidth={1.8 / Math.max(0.1, scale)}
                strokeDasharray={`${4 / Math.max(0.1, scale)} ${3 / Math.max(0.1, scale)}`}
                className="opacity-90 animate-dash-flow"
              />
            </g>
          )}

          {/* 7. Correct Target Marker (Minimalist, Fixed Screen Size, No Text) */}
          {showReview && targetPt && (
            <g
              ref={targetMarkerRef}
              transform={`translate(${targetPt.x}, ${targetPt.y}) scale(${1 / Math.max(0.1, scale)})`}
              className="pointer-events-none"
            >
              <g className="animate-pop-in">
                {/* Subtle radar pulse ring */}
                <circle cx="0" cy="-13" r="14" fill="none" stroke="#10b981" strokeWidth="1.2" className="animate-ping opacity-35" />
                {/* Ground soft shadow */}
                <ellipse cx="0" cy="1" rx="4" ry="1.8" fill="rgba(0, 0, 0, 0.28)" />

                {/* Sleek emerald target pin */}
                <path
                  d="M 0 0 C -1.5 -2.5, -6 -7.5, -6 -13 C -6 -16.5, -3.3 -19.5, 0 -19.5 C 3.3 -19.5, 6 -16.5, 6 -13 C 6 -7.5, 1.5 -2.5, 0 0 Z"
                  fill="#10b981"
                  stroke="#ffffff"
                  strokeWidth="1.6"
                />
                {/* Bullseye inner dot */}
                <circle cx="0" cy="-13" r="2.8" fill="#ffffff" />
                <circle cx="0" cy="-13" r="1.4" fill="#10b981" />
              </g>
            </g>
          )}

          {/* 8. User Guess Pin Marker (Minimalist, Fixed Screen Size, No Text) */}
          {guessPt && (
            <g
              ref={guessMarkerRef}
              transform={`translate(${guessPt.x}, ${guessPt.y}) scale(${1 / Math.max(0.1, scale)})`}
              className="pointer-events-none"
            >
              <g className="animate-pin-drop">
                {/* Ground soft shadow */}
                <ellipse cx="0" cy="1" rx="4" ry="1.8" fill="rgba(0, 0, 0, 0.28)" />

                {/* Sleek minimalist teardrop pin */}
                <path
                  d="M 0 0 C -1.5 -2.5, -6 -7.5, -6 -13 C -6 -16.5, -3.3 -19.5, 0 -19.5 C 3.3 -19.5, 6 -16.5, 6 -13 C 6 -7.5, 1.5 -2.5, 0 0 Z"
                  fill={
                    isCorrect === true
                      ? "#10b981"
                      : isCorrect === false
                      ? "#ef4444"
                      : "#2563eb"
                  }
                  stroke="#ffffff"
                  strokeWidth="1.6"
                />
                {/* Pin Center Dot */}
                <circle cx="0" cy="-13" r="2.2" fill="#ffffff" />
              </g>
            </g>
          )}
        </g>
      </svg>

      {/* Top Left: Quick Region Navigator & North Compass */}
      <div
        data-map-control="true"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10 flex items-center gap-1.5 sm:gap-2"
      >
        {/* Clickable Compass Rose (Resets View to North) */}
        <button
          type="button"
          onClick={handleResetView}
          title="Sever / Ponastavi pogled (Reset to North)"
          className="p-2 rounded-xl bg-[var(--card)]/85 backdrop-blur-md border border-[var(--border)] shadow-md hover:text-blue-500 hover:border-blue-500/40 transition-all active:scale-95 group touch-manipulation"
        >
          <Compass className="w-4 h-4 text-rose-500 transition-transform group-hover:rotate-45" />
        </button>

        {/* Region Presets Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowRegionMenu((prev) => !prev)}
            title="Skoči na regijo / celino"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--card)]/85 backdrop-blur-md border border-[var(--border)] shadow-md text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--accent)] transition-all active:scale-95 touch-manipulation"
          >
            <Globe className="w-3.5 h-3.5 text-blue-500" />
            <span>Regije</span>
          </button>

          {showRegionMenu && (
            <div className="absolute left-0 mt-1.5 w-44 rounded-xl bg-[var(--card)]/95 backdrop-blur-md border border-[var(--border)] shadow-xl p-1 z-20 space-y-0.5 animate-in fade-in zoom-in-95 duration-150">
              {REGION_PRESETS.map((r) => (
                <button
                  key={r.name}
                  type="button"
                  onClick={() => {
                    flyTo(r.lat, r.lng, r.scale, 400);
                    setShowRegionMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--foreground)] hover:bg-blue-500/10 hover:text-blue-500 transition-colors flex items-center justify-between touch-manipulation"
                >
                  <span>{r.name}</span>
                  <span className="text-[10px] text-[var(--muted-foreground)] font-mono">{r.scale}x</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Right: Fullscreen Toggle & Shortcuts Help */}
      <div
        data-map-control="true"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 flex items-center gap-1.5"
      >
        <button
          type="button"
          onClick={() => setShowShortcutsModal(true)}
          title="Bližnjice na tipkovnici (?)"
          className="hidden sm:flex p-2 rounded-xl bg-[var(--card)]/85 backdrop-blur-md border border-[var(--border)] shadow-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-all active:scale-95 touch-manipulation"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFullscreen ? "Izhod iz celozaslonskega načina (F)" : "Celozaslonski način (F)"}
          className="p-2 rounded-xl bg-[var(--card)]/85 backdrop-blur-md border border-[var(--border)] shadow-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-all active:scale-95 touch-manipulation"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Floating Glassmorphic Map HUD Controls (Bottom Right - Fixed Z-30, Touch & Mouse Reliable) */}
      <div
        data-map-control="true"
        className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-30 flex flex-col items-center gap-1 sm:gap-1.5 p-1 rounded-xl bg-[var(--card)]/90 backdrop-blur-md border border-[var(--border)] shadow-xl"
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleZoomIn();
          }}
          disabled={scale >= 7.9}
          title={scale >= 7.9 ? "Največja povečava dosežena (800%)" : "Povečaj (+)"}
          className={`p-2 touch-manipulation rounded-lg transition-colors flex items-center justify-center ${
            scale >= 7.9
              ? "opacity-30 cursor-not-allowed text-[var(--muted-foreground)]"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] active:scale-90 cursor-pointer"
          }`}
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleZoomOut();
          }}
          disabled={scale <= 1.05}
          title={scale <= 1.05 ? "Najmanjša povečava dosežena (100%)" : "Pomanjšaj (-)"}
          className={`p-2 touch-manipulation rounded-lg transition-colors flex items-center justify-center ${
            scale <= 1.05
              ? "opacity-30 cursor-not-allowed text-[var(--muted-foreground)]"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] active:scale-90 cursor-pointer"
          }`}
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="w-4 h-[1px] bg-[var(--border)] my-0.5" />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleResetView();
          }}
          title="Ponastavi pogled (0 / R)"
          className="p-2 touch-manipulation rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors active:scale-90 flex items-center justify-center cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setUserLabelToggle((prev) => !(prev !== null ? prev : showLabels));
          }}
          title={labelsVisible ? "Skrij napise (L)" : "Prikaži napise držav (L)"}
          className={`p-2 touch-manipulation rounded-lg transition-colors active:scale-90 flex items-center justify-center cursor-pointer ${
            labelsVisible
              ? "text-blue-500 bg-blue-500/15 font-bold shadow-sm"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]"
          }`}
        >
          <Type className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowGraticule((prev) => !prev);
          }}
          title={showGraticule ? "Skrij koordinatno mrežo (G)" : "Prikaži koordinatno mrežo (G)"}
          className={`p-2 touch-manipulation rounded-lg transition-colors active:scale-90 flex items-center justify-center cursor-pointer ${
            showGraticule
              ? "text-blue-500 bg-blue-500/15 font-bold shadow-sm"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]"
          }`}
        >
          <Grid className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Left: Live Scale, Coordinates, and Country HUD (Zero React Re-renders) */}
      <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 z-10 pointer-events-none flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] font-mono text-[var(--muted-foreground)] bg-[var(--card)]/80 backdrop-blur-sm px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border border-[var(--border)] shadow-sm max-w-[calc(100%-5rem)] truncate">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        <span className="truncate">Vektorska karta {scale > 1 ? `· ${Math.round(scale * 100)}%` : ""}</span>
        <span ref={coordsTextRef} className="hidden sm:inline border-l border-[var(--border)] pl-2 text-[10px]" />
        <span ref={countryTextRef} className="text-[var(--foreground)] font-semibold border-l border-[var(--border)] pl-1.5 truncate empty:hidden" />
      </div>

      {/* Keyboard Shortcuts Dialog Modal */}
      {showShortcutsModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowShortcutsModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-[var(--card)] border border-[var(--border)] p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-bold text-[var(--foreground)]">Bližnjice na tipkovnici</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="p-1 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--muted)]/50">
                <span className="text-[var(--muted-foreground)]">Povečaj / Pomanjšaj</span>
                <span className="font-mono font-bold text-[var(--foreground)]">+ / -</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--muted)]/50">
                <span className="text-[var(--muted-foreground)]">Dvojni klik</span>
                <span className="font-mono font-bold text-[var(--foreground)]">Zoom</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--muted)]/50">
                <span className="text-[var(--muted-foreground)]">Premik karte</span>
                <span className="font-mono font-bold text-[var(--foreground)]">W A S D / Puščice</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--muted)]/50">
                <span className="text-[var(--muted-foreground)]">Ponastavi pogled</span>
                <span className="font-mono font-bold text-[var(--foreground)]">0 / R</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--muted)]/50">
                <span className="text-[var(--muted-foreground)]">Napisi držav</span>
                <span className="font-mono font-bold text-[var(--foreground)]">L</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--muted)]/50">
                <span className="text-[var(--muted-foreground)]">Koordinatna mreža</span>
                <span className="font-mono font-bold text-[var(--foreground)]">G</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--muted)]/50">
                <span className="text-[var(--muted-foreground)]">Celozaslonski način</span>
                <span className="font-mono font-bold text-[var(--foreground)]">F</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--muted)]/50">
                <span className="text-[var(--muted-foreground)]">Dva prsta (dotik)</span>
                <span className="font-mono font-bold text-[var(--foreground)]">Pinch Zoom</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowShortcutsModal(false)}
              className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors"
            >
              Razumem
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
