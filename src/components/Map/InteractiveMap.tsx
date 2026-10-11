"use client";

import dynamic from "next/dynamic";
import type { VectorSvgMapProps } from "./VectorSvgMap";

function MapSkeleton() {
  return (
    <div className="relative w-full h-full min-h-[400px] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--muted)]/50 flex flex-col items-center justify-center p-6 text-center animate-pulse">
      <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-3 text-blue-500">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </div>
      <p className="text-sm font-medium text-[var(--muted-foreground)]">
        Priprava vektorskega zemljevida sveta …
      </p>
    </div>
  );
}

const DynamicVectorSvgMap = dynamic(() => import("./VectorSvgMap"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

export function InteractiveMap(props: VectorSvgMapProps) {
  return <DynamicVectorSvgMap {...props} />;
}
