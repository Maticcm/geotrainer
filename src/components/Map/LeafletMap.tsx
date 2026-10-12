"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { Geometry } from "geojson";
import type { FeatureMeta, LatLng } from "@/lib/types";
import { useIsDark } from "@/lib/hooks";
import { normalizeLatLng } from "@/lib/spatial";

export interface HighlightItem {
  id: string;
  label?: string;
  geometry: Geometry;
  color?: string;
  onClick?: () => void;
}

export interface LeafletMapProps {
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
  fitTargetTrigger?: number; // incrementing counter to trigger zoom to target
}

const CARTO_API_KEY = process.env.NEXT_PUBLIC_CARTO_API_KEY || "cb1_4g2s_1_a45700dadbd6f1c29b23642c";

export default function LeafletMap({
  center = [20, 0],
  zoom = 2,
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
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const guessMarkerRef = useRef<L.Marker | null>(null);
  const targetLayerRef = useRef<L.GeoJSON | null>(null);
  const targetMarkerRef = useRef<L.Marker | null>(null);
  const distanceLineRef = useRef<L.Polyline | null>(null);
  const highlightsGroupRef = useRef<L.FeatureGroup | null>(null);
  const isDark = useIsDark();

  // Create or destroy the Leaflet map instance
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom,
      minZoom: 1,
      maxZoom: 14,
      zoomControl: false,
      worldCopyJump: true,
      attributionControl: true,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    mapRef.current = map;

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    const ro = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          map.invalidateSize();
        })
      : null;

    if (ro && containerRef.current) {
      ro.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timer);
      ro?.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update base tile layer based on dark mode & showLabels
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    const keyParam = CARTO_API_KEY ? `?key=${CARTO_API_KEY}` : "";

    let url: string;
    if (isDark) {
      url = showLabels
        ? `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png${keyParam}`
        : `https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png${keyParam}`;
    } else {
      url = showLabels
        ? `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png${keyParam}`
        : `https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png${keyParam}`;
    }

    const attribution =
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

    const layer = L.tileLayer(url, {
      attribution,
      subdomains: "abcd",
      maxZoom: 19,
    });

    layer.addTo(map);
    tileLayerRef.current = layer;
  }, [isDark, showLabels]);

  // Click handler
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handler = (e: L.LeafletMouseEvent) => {
      if (!interactive || !onMapClick) return;
      const normalized = normalizeLatLng({ lat: e.latlng.lat, lng: e.latlng.lng });
      onMapClick(normalized);
    };

    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [interactive, onMapClick]);

  // Render User Guess Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (guessMarkerRef.current) {
      map.removeLayer(guessMarkerRef.current);
      guessMarkerRef.current = null;
    }

    if (userGuess) {
      const isReviewWrong = showReview && isCorrect === false;
      const pinColor = isReviewWrong ? "#ef4444" : showReview ? "#10b981" : "#3b82f6";

      const html = `
        <div class="relative flex items-center justify-center marker-drop" style="width: 32px; height: 32px;">
          <div class="absolute inset-0 rounded-full marker-pulse-ring" style="background-color: ${pinColor}40;"></div>
          <div class="relative z-10 flex h-8 w-8 items-center justify-center rounded-full shadow-lg border-2 border-white dark:border-slate-900" style="background-color: ${pinColor};">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </div>
      `;

      const icon = L.divIcon({
        className: "custom-guess-marker",
        html,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([userGuess.lat, userGuess.lng], { icon, zIndexOffset: 1000 }).addTo(map);
      guessMarkerRef.current = marker;
    }
  }, [userGuess, showReview, isCorrect]);

  // Render Target Geometry & Nearest Point during Review or Practice
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (targetLayerRef.current) {
      map.removeLayer(targetLayerRef.current);
      targetLayerRef.current = null;
    }
    if (targetMarkerRef.current) {
      map.removeLayer(targetMarkerRef.current);
      targetMarkerRef.current = null;
    }
    if (distanceLineRef.current) {
      map.removeLayer(distanceLineRef.current);
      distanceLineRef.current = null;
    }

    // Target geometry (either full geometry or approximate coordinate)
    if (showReview || targetGeometry) {
      const primaryColor = isCorrect === false ? "#10b981" : "#3b82f6"; // Correct target shown in emerald/blue

      if (targetGeometry) {
        const geoLayer = L.geoJSON(targetGeometry as GeoJSON.GeoJsonObject, {
          style: {
            color: primaryColor,
            weight: 3.5,
            opacity: 0.9,
            fillColor: primaryColor,
            fillOpacity: 0.28,
            dashArray: targetGeometry.type.includes("Line") ? "6, 6" : undefined,
          },
          pointToLayer: (_geoJsonPoint, latlng) => {
            const html = `
              <div class="relative flex items-center justify-center marker-drop" style="width: 36px; height: 36px;">
                <div class="absolute inset-0 rounded-full marker-pulse-ring" style="background-color: ${primaryColor}50;"></div>
                <div class="relative z-10 flex h-9 w-9 items-center justify-center rounded-full shadow-xl border-2 border-white dark:border-slate-900" style="background-color: ${primaryColor};">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="7" />
                    <line x1="12" y1="2" x2="12" y2="5" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                    <line x1="2" y1="12" x2="5" y2="12" />
                    <line x1="19" y1="12" x2="22" y2="12" />
                    <circle cx="12" cy="12" r="2" fill="white" />
                  </svg>
                </div>
              </div>
            `;
            const icon = L.divIcon({
              className: "custom-target-marker",
              html,
              iconSize: [36, 36],
              iconAnchor: [18, 18],
            });
            return L.marker(latlng, { icon, zIndexOffset: 900 });
          },
        }).addTo(map);

        targetLayerRef.current = geoLayer;
      } else if (targetFeatureMeta?.approx) {
        // Approximate point fallback
        const { lat, lng } = targetFeatureMeta.approx;
        const html = `
          <div class="relative flex items-center justify-center marker-drop" style="width: 36px; height: 36px;">
            <div class="absolute inset-0 rounded-full marker-pulse-ring" style="background-color: ${primaryColor}50;"></div>
            <div class="relative z-10 flex h-9 w-9 items-center justify-center rounded-full shadow-xl border-2 border-white dark:border-slate-900" style="background-color: ${primaryColor};">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="7" />
                <line x1="12" y1="2" x2="12" y2="5" />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="2" y1="12" x2="5" y2="12" />
                <line x1="19" y1="12" x2="22" y2="12" />
                <circle cx="12" cy="12" r="2" fill="white" />
              </svg>
            </div>
          </div>
        `;
        const icon = L.divIcon({
          className: "custom-target-marker",
          html,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });
        const marker = L.marker([lat, lng], { icon, zIndexOffset: 900 }).addTo(map);
        targetMarkerRef.current = marker;
      }

      // If user guessed and was not inside, draw distance connector line
      if (userGuess && nearestPoint && isCorrect === false) {
        const polyline = L.polyline(
          [
            [userGuess.lat, userGuess.lng],
            [nearestPoint.lat, nearestPoint.lng],
          ],
          {
            color: "#f59e0b",
            weight: 3,
            dashArray: "4, 8",
            opacity: 0.85,
          }
        ).addTo(map);
        distanceLineRef.current = polyline;
      }
    }
  }, [showReview, targetGeometry, targetFeatureMeta, userGuess, nearestPoint, isCorrect]);

  // Render Multiple Choice / Practice Highlights
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (highlightsGroupRef.current) {
      map.removeLayer(highlightsGroupRef.current);
      highlightsGroupRef.current = null;
    }

    if (highlights && highlights.length > 0) {
      const group = L.featureGroup();

      highlights.forEach((item) => {
        const color = item.color || "#6366f1";
        const geoLayer = L.geoJSON(item.geometry as GeoJSON.GeoJsonObject, {
          style: {
            color,
            weight: 3,
            opacity: 0.9,
            fillColor: color,
            fillOpacity: 0.3,
          },
          pointToLayer: (_geoJsonPoint, latlng) => {
            const html = `
              <div class="flex items-center justify-center rounded-full text-white font-bold text-xs shadow-md border-2 border-white" style="width: 28px; height: 28px; background-color: ${color};">
                ${item.label || "•"}
              </div>
            `;
            const icon = L.divIcon({
              className: "highlight-marker",
              html,
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            });
            return L.marker(latlng, { icon });
          },
        });

        if (item.onClick) {
          geoLayer.on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            item.onClick?.();
          });
        }

        group.addLayer(geoLayer);
      });

      group.addTo(map);
      highlightsGroupRef.current = group;
    }
  }, [highlights]);

  // Fit bounds to target or group when triggered
  useEffect(() => {
    const map = mapRef.current;
    if (!map || fitTargetTrigger === 0) return;

    if (targetLayerRef.current) {
      const bounds = targetLayerRef.current.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 8, animate: true, duration: 0.8 });
        return;
      }
    }
    if (targetFeatureMeta?.approx) {
      map.flyTo([targetFeatureMeta.approx.lat, targetFeatureMeta.approx.lng], 5, { duration: 0.8 });
      return;
    }
    if (highlightsGroupRef.current) {
      const bounds = highlightsGroupRef.current.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 6, animate: true, duration: 0.8 });
      }
    }
  }, [fitTargetTrigger, targetFeatureMeta]);

  // Reset to world view button handler
  const resetView = () => {
    mapRef.current?.flyTo([20, 0], 2, { duration: 0.7 });
  };

  // Center on marker button handler
  const centerOnMarker = () => {
    if (userGuess && mapRef.current) {
      mapRef.current.flyTo([userGuess.lat, userGuess.lng], mapRef.current.getZoom(), { duration: 0.5 });
    }
  };

  return (
    <div data-map-canvas="true" className="relative w-full h-full min-h-[350px] overflow-hidden rounded-xl border border-[var(--border)] shadow-inner">
      <div ref={containerRef} className="w-full h-full z-0" tabIndex={0} aria-label="Zemljevid sveta" />

      {/* Floating map controls */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
        <button
          type="button"
          onClick={resetView}
          title="Ponastavi pogled na svet"
          aria-label="Ponastavi pogled na svet"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--card)]/90 backdrop-blur-md text-[var(--foreground)] border border-[var(--border)] shadow-md hover:bg-[var(--muted)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        {userGuess && (
          <button
            type="button"
            onClick={centerOnMarker}
            title="Središče na mojo oznako"
            aria-label="Središče na mojo oznako"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
