import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { FEATURES, FEATURE_BY_ID } from "../data/features";
import { evaluateClick } from "./evaluation";
import { projectLatLng, unprojectSvgPoint } from "./robinson";
import type { Geometry, LineString, MultiLineString, Polygon, MultiPolygon } from "geojson";

const geometryFiles = [
  "canals-straits.json",
  "continents.json",
  "countries.json",
  "deserts.json",
  "islands.json",
  "lakes.json",
  "mountains.json",
  "oceans-seas.json",
  "peninsulas.json",
  "rivers.json",
];

const allGeometries: Record<string, Geometry> = {};
for (const file of geometryFiles) {
  const filePath = path.join(process.cwd(), "public", "data", "geometry", file);
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    Object.assign(allGeometries, data);
  }
}

const centroids: Record<string, [number, number]> = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "src", "data", "centroids.json"), "utf-8")
);

describe("Feature Hitbox Accuracy on Every Device", () => {
  it("verifies every feature in syllabus has valid geometry or approx location", () => {
    for (const f of FEATURES) {
      const geom = allGeometries[f.id];
      expect(geom || f.approx, `Missing geometry/approx for ${f.id} (${f.name})`).toBeDefined();
    }
  });

  it("verifies every feature centroid evaluates as correct on all difficulties", () => {
    for (const f of FEATURES) {
      const geom = allGeometries[f.id];
      const centroid = centroids[f.id];
      const clickLat = centroid ? centroid[0] : f.approx ? f.approx.lat : 0;
      const clickLng = centroid ? centroid[1] : f.approx ? f.approx.lng : 0;

      for (const diff of ["easy", "normal", "hard"] as const) {
        const res = evaluateClick(f, geom, { lat: clickLat, lng: clickLng }, diff);
        expect(res.correct, `${f.id} centroid failed on ${diff}`).toBe(true);
      }
    }
  });

  it("verifies Caspian Sea (Kaspijsko jezero) accepts clicks across its extent", () => {
    const caspianGeom = allGeometries["caspian-sea"] as Polygon;
    const caspianMeta = FEATURE_BY_ID.get("caspian-sea")!;
    const points = [
      { name: "North Caspian", lat: 46.0, lng: 50.0 },
      { name: "Central Caspian", lat: 40.5, lng: 51.5 },
      { name: "South Caspian", lat: 37.5, lng: 50.5 },
      { name: "East Caspian", lat: 42.0, lng: 53.0 },
      { name: "West Caspian near Baku", lat: 40.3, lng: 50.5 },
    ];
    for (const pt of points) {
      const res = evaluateClick(caspianMeta, caspianGeom, pt, "normal");
      expect(res.correct, `Caspian Sea point ${pt.name} failed`).toBe(true);
    }
  });

  it("verifies all 21 rivers accept clicks anywhere along their course", () => {
    const riverIds = [
      "nile", "amazon", "danube", "rhine", "ural-river", "yangtze", "yellow-river",
      "mekong", "ganges", "brahmaputra", "congo-river", "indus", "euphrates", "tigris",
      "mississippi", "colorado-river", "rio-grande", "saint-lawrence-river",
      "parana", "orinoco", "niger-river"
    ];

    for (const id of riverIds) {
      const meta = FEATURE_BY_ID.get(id)!;
      const geom = allGeometries[id] as LineString | MultiLineString;
      expect(geom, `River ${id} missing geometry`).toBeDefined();

      const lines = geom.type === "LineString" ? [geom.coordinates] : geom.coordinates;
      for (const line of lines) {
        if (line.length === 0) continue;
        const testPoints = [
          line[0],
          line[Math.floor(line.length / 2)],
          line[line.length - 1],
        ];

        for (const [lng, lat] of testPoints) {
          const res = evaluateClick(meta, geom, { lat, lng }, "normal");
          expect(res.correct, `River ${id} sample point failed`).toBe(true);
        }
      }
    }
  });

  it("verifies small island and canal hitboxes are forgiving enough for mobile taps", () => {
    const smallTargets = ["suez-canal", "panama-canal", "strait-of-gibraltar", "maldives", "seychelles", "corsica"];
    for (const id of smallTargets) {
      const meta = FEATURE_BY_ID.get(id)!;
      const geom = allGeometries[id];
      const centroid = centroids[id];
      expect(centroid, `Centroid missing for ${id}`).toBeDefined();

      // Test with a 350 km offset representing an unzoomed touchscreen tap
      const click = { lat: centroid[0] + 1.5, lng: centroid[1] + 1.5 };
      const res = evaluateClick(meta, geom, click, "normal");
      expect(res.correct, `${id} failed on mobile tap offset`).toBe(true);
    }
  });
});
