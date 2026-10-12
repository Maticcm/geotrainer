import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { FEATURES, FEATURE_BY_ID } from "../data/features";
import type { GeographyCategory } from "./types";

const categoryMapping: Record<string, GeographyCategory> = {
  "Oceani in morja": "oceans-seas",
  "Celine": "continents",
  "Gorovja": "mountains",
  "Prekopi": "canals-straits",
  "Države": "countries",
  "Reke": "rivers",
  "Jezera": "lakes",
  "Otočja": "islands",
  "Puščave in polpuščave": "deserts",
  "Polotoki": "peninsulas",
};

function parsePlacesMd(): { category: GeographyCategory; categorySl: string; name: string }[] {
  const content = fs.readFileSync(path.join(process.cwd(), "places.md"), "utf8");
  const lines = content.split(/\r?\n/);
  const places: { category: GeographyCategory; categorySl: string; name: string }[] = [];

  let currentCategorySl = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const catMatch = line.match(/^\d+\.\s+(.+)$/);
    if (catMatch) {
      currentCategorySl = catMatch[1].trim();
      continue;
    }
    let text = line;
    if (text.endsWith(".")) text = text.slice(0, -1);
    text = text.replace(/\s+in\s+/g, ", ");
    if (text.includes("Antarktika (Arktika)")) {
      text = text.replace("Antarktika (Arktika)", "Antarktika, Arktika");
    }
    const items = text.split(",").map((s) => s.trim()).filter(Boolean);
    const cat = categoryMapping[currentCategorySl];
    if (!cat) throw new Error(`Unknown category: ${currentCategorySl}`);
    for (const item of items) {
      places.push({ category: cat, categorySl: currentCategorySl, name: item });
    }
  }
  return places;
}

describe("100% Alignment with places.md", () => {
  const places = parsePlacesMd();

  it("contains exactly 112 locations in places.md", () => {
    expect(places).toHaveLength(112);
  });

  it("features in app are exactly and only the 112 locations in places.md", () => {
    expect(FEATURES).toHaveLength(112);
  });

  it("every location from places.md has an exact Slovenian name match in FEATURES", () => {
    for (const p of places) {
      const match = FEATURES.find((f) => f.category === p.category && f.name === p.name);
      expect(
        match,
        `Expected location "${p.name}" in category "${p.categorySl}" (${p.category}) to exist in FEATURES`
      ).toBeDefined();
    }
  });

  it("no feature exists in FEATURES that is not in places.md", () => {
    for (const f of FEATURES) {
      const match = places.find((p) => p.category === f.category && p.name === f.name);
      expect(
        match,
        `Feature "${f.name}" (${f.id}) in category "${f.category}" should not exist because it is not in places.md`
      ).toBeDefined();
    }
  });

  it("category counts match places.md exactly across all 10 categories", () => {
    const expectedCounts: Record<GeographyCategory, number> = {
      "oceans-seas": 12,
      continents: 8,
      mountains: 9,
      "canals-straits": 5,
      countries: 16,
      rivers: 21,
      lakes: 9,
      islands: 16,
      deserts: 8,
      peninsulas: 8,
    };

    for (const [cat, count] of Object.entries(expectedCounts)) {
      const actual = FEATURES.filter((f) => f.category === cat);
      expect(actual, `Category ${cat} count mismatch`).toHaveLength(count);
    }
  });
});
