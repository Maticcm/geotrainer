import fs from "node:fs";
import path from "node:path";
import type { Geometry, Position } from "geojson";
import { describe, expect, it } from "vitest";
import { FEATURES, SYLLABUS_FEATURES, UNRESOLVED_REPORT } from "@/data/features";
import { evaluateClick } from "@/lib/evaluation";
import { CATEGORIES, type GeographyCategory } from "@/lib/types";

const dir = path.resolve(__dirname, "../../public/data/geometry");
const geo: Record<string, Record<string, Geometry>> = {};
for (const c of CATEGORIES) {
  const f = path.join(dir, `${c}.json`);
  geo[c] = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {};
}

function coords(g: Geometry): Position[] {
  const out: Position[] = [];
  const walk = (c: unknown) => {
    if (Array.isArray(c) && typeof c[0] === "number") out.push(c as Position);
    else if (Array.isArray(c)) c.forEach(walk);
  };
  if (g.type !== "GeometryCollection") walk(g.coordinates);
  return out;
}

describe("dataset validation", () => {
  it("has stable, unique ids and required fields", () => {
    const ids = FEATURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of FEATURES) {
      expect(f.id).toMatch(/^[a-z0-9-]+$/);
      expect(f.name.trim()).not.toBe("");
      expect(f.nameEn.trim()).not.toBe("");
      expect(CATEGORIES).toContain(f.category);
      expect([1, 2, 3]).toContain(f.difficulty);
      expect(f.source.trim()).not.toBe("");
      expect(f.fact.sl.trim()).not.toBe("");
      expect(f.fact.en.trim()).not.toBe("");
      expect(f.aliases.length).toBeGreaterThan(0);
    }
  });

  it("covers the full worksheet: 112 syllabus terms in 10 categories", () => {
    expect(SYLLABUS_FEATURES).toHaveLength(112);
    const counts: Record<GeographyCategory, number> = {
      "oceans-seas": 12, continents: 8, mountains: 9, "canals-straits": 5, countries: 16,
      rivers: 21, lakes: 9, islands: 16, deserts: 8, peninsulas: 8,
    };
    for (const c of CATEGORIES) expect(SYLLABUS_FEATURES.filter((f) => f.category === c)).toHaveLength(counts[c]);
  });

  it("no duplicate display names within a category", () => {
    for (const c of CATEGORIES) {
      const names = FEATURES.filter((f) => f.category === c).map((f) => f.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it("every feature has verified geometry or a documented approximate coordinate", () => {
    for (const f of FEATURES) {
      if (f.geometryKind === "approximate") {
        expect(f.approx, f.id).toBeDefined();
        expect(f.note, `${f.id} needs a note`).toBeTruthy();
        expect(f.approx!.toleranceKm).toBeGreaterThan(0);
        expect(Math.abs(f.approx!.lat)).toBeLessThanOrEqual(90);
        expect(Math.abs(f.approx!.lng)).toBeLessThanOrEqual(180);
      } else {
        const g = geo[f.category][f.id];
        expect(g, `missing geometry for ${f.id}`).toBeDefined();
        expect(coords(g).length, f.id).toBeGreaterThan(0);
      }
    }
  });

  it("all geometry coordinates are valid lon/lat", () => {
    for (const c of CATEGORIES) {
      for (const [id, g] of Object.entries(geo[c])) {
        for (const [lng, lat] of coords(g)) {
          expect(Number.isFinite(lng) && Number.isFinite(lat), id).toBe(true);
          expect(lng, id).toBeGreaterThanOrEqual(-180);
          expect(lng, id).toBeLessThanOrEqual(180);
          expect(lat, id).toBeGreaterThanOrEqual(-90);
          expect(lat, id).toBeLessThanOrEqual(90);
        }
      }
    }
  });

  it("geometry has no orphan ids", () => {
    const known = new Set(FEATURES.map((f) => f.id));
    for (const c of CATEGORIES) for (const id of Object.keys(geo[c])) expect(known.has(id), id).toBe(true);
  });

  it("documents unresolved/approximate terms", () => {
    expect(UNRESOLVED_REPORT.length).toBeGreaterThan(0);
    const approx = FEATURES.filter((f) => f.geometryKind === "approximate").map((f) => f.name);
    for (const n of approx) expect(UNRESOLVED_REPORT.some((r) => r.term === n), n).toBe(true);
  });
});

describe("real geometry spot checks", () => {
  const click = (id: string, lat: number, lng: number) => {
    const f = FEATURES.find((x) => x.id === id)!;
    return evaluateClick(f, geo[f.category][id], { lat, lng });
  };
  it("countries: points inside vs outside", () => {
    expect(click("italy", 42.0, 12.5).inside).toBe(true); // Rome
    expect(click("italy", 48.0, 2.0).correct).toBe(false); // Paris
    expect(click("japan", 35.7, 139.7).inside).toBe(true); // Tokyo
    expect(click("brazil", -15.8, -47.9).inside).toBe(true); // Brasília
    expect(click("canada", 45.4, -75.7).inside).toBe(true); // Ottawa
    expect(click("usa", 38.9, -77.0).inside).toBe(true); // Washington
    expect(click("south-africa", -33.9, 18.4).correct).toBe(true); // Cape Town (coast simplified)
  });
  it("rivers: points near the actual line", () => {
    expect(click("nile", 30.05, 31.23).correct).toBe(true); // Cairo
    expect(click("nile", 4.8, 31.6).correct).toBe(true); // Juba / White Nile
    expect(click("nile", 31.4, 30.4).correct).toBe(true); // Nile Delta
    expect(click("nile", 30.05, 42).correct).toBe(false); // well out in the Arabian Peninsula
    expect(click("danube", 47.5, 19.05).correct).toBe(true); // Budapest
    expect(click("mississippi", 29.95, -90.07).correct).toBe(true); // New Orleans
    expect(click("rhine", 50.94, 6.96).correct).toBe(true); // Cologne
    expect(click("amazon", -3.12, -60.02).correct).toBe(true); // Manaus
    expect(click("amazon", -4.5, -75.0).correct).toBe(true); // Peruvian headwaters
    expect(click("congo-river", -10.0, 26.8).correct).toBe(true); // Upper Lualaba
    expect(click("yangtze", 30.58, 114.3).correct).toBe(true); // Wuhan
    expect(click("colorado-river", 36.0, -114.5).correct).toBe(true); // Lake Mead
    expect(click("colorado-river", 36.1, -112.1).correct).toBe(true); // Grand Canyon
    expect(click("saint-lawrence-river", 46.8, -71.2).correct).toBe(true); // Quebec City
    expect(click("saint-lawrence-river", 45.5, -73.6).correct).toBe(true); // Montreal
  });
  it("straits and canals: choke points accept nearby clicks with very large leniency", () => {
    expect(click("suez-canal", 30.5, 32.4).correct).toBe(true);
    expect(click("suez-canal", 30.0, 31.2).correct).toBe(true); // Cairo / Sinai region (~130 km)
    expect(click("panama-canal", 9.1, -79.7).correct).toBe(true);
    expect(click("panama-canal", 8.0, -80.5).correct).toBe(true); // Golfo de Panama (~150 km)
    expect(click("strait-of-gibraltar", 35.95, -5.6).correct).toBe(true); // in the water
    expect(click("strait-of-gibraltar", 36.8, -4.5).correct).toBe(true); // Malaga / Andalusia (~140 km)
    expect(click("bosporus", 41.1, 29.0).correct).toBe(true);
    expect(click("bosporus", 41.5, 30.5).correct).toBe(true); // Black Sea entrance (~130 km)
    expect(click("dardanelles", 40.2, 26.4).correct).toBe(true);
  });
  it("mountains: points near ranges and peaks", () => {
    expect(click("alps", 46.5, 10).correct).toBe(true);
    expect(click("alps", 52, 20).correct).toBe(false);
    expect(click("himalayas", 28, 86.9).correct).toBe(true); // Everest
    expect(click("andes", -33, -70).correct).toBe(true);
    expect(click("kilimanjaro", -3.07, 37.35).correct).toBe(true);
    expect(click("kilimanjaro", -3.5, 37.0).correct).toBe(true); // lenient mountain peak region
    expect(click("kilimanjaro", -1.3, 36.8).correct).toBe(true); // Nairobi (~210 km away)
  });
  it("seas, lakes, islands, deserts, peninsulas", () => {
    expect(click("black-sea", 43.5, 34).inside).toBe(true);
    expect(click("mediterranean-sea", 35, 18).inside).toBe(true);
    expect(click("pacific-ocean", 0, -150).inside).toBe(true);
    expect(click("pacific-ocean", 0, 170).inside).toBe(true);
    expect(click("pacific-ocean", 0, -179.5).inside).toBe(true); // across the antimeridian
    expect(click("lake-baikal", 53.5, 108).correct).toBe(true);
    expect(click("caspian-sea", 41.5, 53.0).inside).toBe(true); // center of Caspian Sea on SVG map
    expect(click("caspian-sea", 40.5, 53.5).inside).toBe(true); // eastern Caspian Sea near Turkmenistan
    expect(click("great-lakes", 44, -87).correct).toBe(true);
    expect(click("lake-titicaca", -15.9, -69.3).correct).toBe(true);
    expect(click("lake-titicaca", -14.5, -70.5).correct).toBe(true); // Peruvian Andes near Titicaca (~200 km)
    expect(click("madagascar", -19, 46.7).inside).toBe(true);
    expect(click("tasmania", -42, 146.6).inside).toBe(true);
    expect(click("corsica", 43.5, 9.0).correct).toBe(true); // Ligurian sea off Corsica (~150 km)
    expect(click("balearic-islands", 39.5, 1.5).correct).toBe(true); // between Ibiza and Mallorca
    expect(click("maldives", -0.63, 73.15).correct).toBe(true); // Addu Atoll (south)
    expect(click("maldives", 5.0, 73.0).correct).toBe(true); // northern atolls
    expect(click("death-valley", 36.0, -115.5).correct).toBe(true); // Las Vegas region (~150 km)
    expect(click("sahara", 23, 12).inside).toBe(true);
    expect(click("arabian-desert", 24.7, 46.7).correct).toBe(true); // Riyadh
    expect(click("iberian-peninsula", 40, -4).inside).toBe(true);
    expect(click("deccan-peninsula", 9.9, 78.1).correct).toBe(true); // Madurai / southern India
    expect(click("deccan-peninsula", 8.1, 77.5).correct).toBe(true); // Kanyakumari
    expect(click("apennine-peninsula", 41.9, 12.5).inside).toBe(true);
    expect(click("apennine-peninsula", 45.5, 9.2).correct).toBe(false); // Milan, north of the clip
    expect(click("arctic", 80, 0).inside).toBe(true);
    expect(click("arctic", 70, 179.9).inside).toBe(true);
    expect(click("antarctica", -85, 90).inside).toBe(true);
  });
  it("features crossing ±180 are handled (Russia-side Asia, Pacific)", () => {
    expect(click("asia", 66, 178).correct).toBe(true); // Chukotka
    expect(click("asia", 66, -175).correct).toBe(true); // wrapped longitude normalised
    expect(click("pacific-ocean", -17, 178).inside).toBe(true); // Fiji area
  });
});
