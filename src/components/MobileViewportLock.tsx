"use client";

import { useEffect } from "react";

/**
 * MobileViewportLock:
 * - Prevents Safari/WebKit gesture zoom (`gesturestart`, `gesturechange`, `gestureend`).
 * - Prevents whole-page multi-touch pinch zooming while keeping the map canvas interactive.
 * - Prevents double-tap-to-zoom on outer UI.
 * - Prevents Ctrl + Wheel whole-page browser zoom.
 */
export function MobileViewportLock() {
  useEffect(() => {
    // 1. Prevent Safari gesture events that trigger browser viewport zoom
    const preventGesture = (e: Event) => {
      e.preventDefault();
    };

    // 2. Prevent multi-touch pinch on page elements outside the interactive map
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        const target = e.target as HTMLElement | null;
        if (target?.closest?.(".leaflet-container, [data-map-canvas='true']")) {
          return; // Allow pinch-to-zoom within the map
        }
        e.preventDefault();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        const target = e.target as HTMLElement | null;
        if (target?.closest?.(".leaflet-container, [data-map-canvas='true']")) {
          return;
        }
        e.preventDefault();
      }
    };

    // 3. Prevent rapid double-tap zoom on non-interactive/non-map elements
    let lastTouchEnd = 0;
    const handleTouchEnd = (e: TouchEvent) => {
      const now = Date.now();
      const target = e.target as HTMLElement | null;
      if (target?.closest?.(".leaflet-container, [data-map-canvas='true'], input, textarea, select, button")) {
        lastTouchEnd = now;
        return;
      }
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };

    // 4. Prevent Ctrl + Wheel whole-page browser zoom
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        const target = e.target as HTMLElement | null;
        if (target?.closest?.(".leaflet-container, [data-map-canvas='true']")) {
          return; // Let map handle its internal wheel zoom
        }
        e.preventDefault();
      }
    };

    document.addEventListener("gesturestart", preventGesture, { passive: false });
    document.addEventListener("gesturechange", preventGesture, { passive: false });
    document.addEventListener("gestureend", preventGesture, { passive: false });
    document.addEventListener("touchstart", handleTouchStart, { passive: false });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd, { passive: false });
    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("gestureend", preventGesture);
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("wheel", handleWheel);
    };
  }, []);

  return null;
}
