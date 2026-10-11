import { describe, expect, it } from "vitest";
import { geometryToSvgPath, projectLatLng, unprojectSvgPoint } from "./robinson";

describe("Robinson Projection", () => {
  it("projects known locations into valid SVG coordinate range", () => {
    // Equator / Greenwich
    const center = projectLatLng(0, 0);
    expect(center.x).toBeCloseTo(447.16, 0);
    expect(center.y).toBeCloseTo(296.09, 0);

    // Tokyo (lat 35.68, lng 139.76)
    const tokyo = projectLatLng(35.68, 139.76);
    expect(tokyo.x).toBeGreaterThan(700);
    expect(tokyo.y).toBeLessThan(200);

    // Sydney (lat -33.87, lng 151.21)
    const sydney = projectLatLng(-33.87, 151.21);
    expect(sydney.x).toBeGreaterThan(750);
    expect(sydney.y).toBeGreaterThan(300);
  });

  it("round-trips coordinate pairs with high precision", () => {
    const testCases = [
      { lat: 0, lng: 0 },
      { lat: 46.05, lng: 14.51 }, // Ljubljana, Slovenia
      { lat: 51.5, lng: -0.12 }, // London
      { lat: -22.9, lng: -43.2 }, // Rio de Janeiro
      { lat: -33.9, lng: 18.4 }, // Cape Town
      { lat: 35.7, lng: 139.7 }, // Tokyo
    ];

    for (const { lat, lng } of testCases) {
      const pt = projectLatLng(lat, lng);
      const inv = unprojectSvgPoint(pt.x, pt.y);
      expect(inv.lat).toBeCloseTo(lat, 2);
      expect(inv.lng).toBeCloseTo(lng, 2);
    }
  });

  it("converts GeoJSON LineString into SVG path", () => {
    const lineString = {
      type: "LineString" as const,
      coordinates: [
        [0, 0],
        [10, 10],
        [20, 20],
      ],
    };
    const path = geometryToSvgPath(lineString);
    expect(path).toMatch(/^M \d+\.\d+ \d+\.\d+ L/);
  });

  it("converts GeoJSON Polygon into SVG path", () => {
    const polygon = {
      type: "Polygon" as const,
      coordinates: [
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ],
      ],
    };
    const path = geometryToSvgPath(polygon);
    expect(path).toMatch(/Z$/);
  });
});
