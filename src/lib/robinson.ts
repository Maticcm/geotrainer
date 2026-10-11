import type { Geometry } from "geojson";
import type { LatLng } from "./types";

const pi = Math.PI;
const abs = Math.abs;
const min = Math.min;
const max = Math.max;
const floor = Math.floor;
const sign = Math.sign;
const degrees = 180 / pi;
const epsilon2 = 1e-12;

// Robinson projection lookup table
const K: [number, number][] = [
  [0.9986, -0.062],
  [1.0000, 0.0000],
  [0.9986, 0.0620],
  [0.9954, 0.1240],
  [0.9900, 0.1860],
  [0.9822, 0.2480],
  [0.9730, 0.3100],
  [0.9600, 0.3720],
  [0.9427, 0.4340],
  [0.9216, 0.4958],
  [0.8962, 0.5571],
  [0.8679, 0.6176],
  [0.8350, 0.6769],
  [0.7986, 0.7346],
  [0.7597, 0.7903],
  [0.7186, 0.8435],
  [0.6732, 0.8936],
  [0.6213, 0.9394],
  [0.5722, 0.9761],
  [0.5322, 1.0000],
];

// Scale Y constants according to Robinson specification
const K_SCALED: [number, number][] = K.map(([x, y]) => [x, y * 1.593415793900743]);

// BlankMap-World SVG calibration constants (viewBox: 0 0 895.92 471.76)
const ORIGIN_X = 447.16;
const SCALE_X = 149.25;
const ORIGIN_Y = 296.09;
const SCALE_Y = 141.39;

export interface SvgPoint {
  x: number;
  y: number;
}

/**
 * Project latitude & longitude to SVG coordinates (0..895.92, 0..471.76)
 */
export function projectLatLng(lat: number, lng: number): SvgPoint {
  // Clamp lat to valid Robinson range [-88, 88]
  const clampedLat = max(-88, min(88, lat));
  // Normalize lng to [-180, 180]
  const normLng = ((((lng + 180) % 360) + 360) % 360) - 180;

  const lambda = (normLng * pi) / 180;
  const phi = (clampedLat * pi) / 180;

  const i = min(18, (abs(phi) * 36) / pi);
  let i0 = floor(i);
  const di = i - i0;

  let k = K_SCALED[i0];
  const ax = k[0];
  const ay = k[1];

  k = K_SCALED[++i0];
  const bx = k[0];
  const by = k[1];

  k = K_SCALED[min(19, ++i0)];
  const cx = k[0];
  const cy = k[1];

  const rx = lambda * (bx + (di * (cx - ax)) / 2 + (di * di * (cx - 2 * bx + ax)) / 2);
  const ry = sign(phi) * (by + (di * (cy - ay)) / 2 + (di * di * (cy - 2 * by + ay)) / 2);

  return {
    x: ORIGIN_X + rx * SCALE_X,
    y: ORIGIN_Y - ry * SCALE_Y,
  };
}

/**
 * Invert SVG coordinates back to latitude and longitude
 */
export function unprojectSvgPoint(svgX: number, svgY: number): LatLng {
  const rx = (svgX - ORIGIN_X) / SCALE_X;
  const ry = -(svgY - ORIGIN_Y) / SCALE_Y;

  let phi = ry * 90;
  let i = min(18, abs(phi / 5));
  let i0 = max(0, floor(i));

  do {
    const ay = K_SCALED[i0][1];
    const by = K_SCALED[i0 + 1][1];
    const cy = K_SCALED[min(19, i0 + 2)][1];
    const u = cy - ay;
    const v = cy - 2 * by + ay;
    const t = (2 * (abs(ry) - by)) / u;
    const c = v / u;
    const di = t * (1 - c * t * (1 - 2 * c * t));

    if (di >= 0 || i0 === 1) {
      phi = (ry >= 0 ? 5 : -5) * (di + i);
      let j = 50;
      let delta = 0;
      do {
        i = min(18, abs(phi) / 5);
        i0 = floor(i);
        const diIter = i - i0;
        const ayIter = K_SCALED[i0][1];
        const byIter = K_SCALED[i0 + 1][1];
        const cyIter = K_SCALED[min(19, i0 + 2)][1];
        delta = sign(ry) * (byIter + (diIter * (cyIter - ayIter)) / 2 + (diIter * diIter * (cyIter - 2 * byIter + ayIter)) / 2) - ry;
        phi -= delta * degrees;
      } while (abs(delta) > epsilon2 && --j > 0);
      break;
    }
  } while (--i0 >= 0);

  i = min(18, abs(phi) / 5);
  i0 = floor(i);
  const diFinal = i - i0;
  const ax = K_SCALED[i0][0];
  const bx = K_SCALED[i0 + 1][0];
  const cx = K_SCALED[min(19, i0 + 2)][0];

  const lambda = rx / (bx + (diFinal * (cx - ax)) / 2 + (diFinal * diFinal * (cx - 2 * bx + ax)) / 2);

  const rawLng = lambda * degrees;
  const normLng = ((((rawLng + 180) % 360) + 360) % 360) - 180;
  const clampedLat = max(-90, min(90, phi));

  return {
    lat: clampedLat,
    lng: normLng,
  };
}

/**
 * Convert GeoJSON geometry to SVG path string for rendering overlays on the Robinson vector map
 */
export function geometryToSvgPath(geom: Geometry | null | undefined): string {
  if (!geom) return "";

  function ringToPath(ring: number[][]): string {
    return (
      ring
        .map((pt, idx) => {
          const { x, y } = projectLatLng(pt[1], pt[0]);
          return `${idx === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .join(" ") + " Z"
    );
  }

  function lineToPath(line: number[][]): string {
    return line
      .map((pt, idx) => {
        const { x, y } = projectLatLng(pt[1], pt[0]);
        return `${idx === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }

  switch (geom.type) {
    case "Polygon":
      return (geom.coordinates as number[][][]).map(ringToPath).join(" ");
    case "MultiPolygon":
      return (geom.coordinates as number[][][][]).flatMap((poly) => poly.map(ringToPath)).join(" ");
    case "LineString":
      return lineToPath(geom.coordinates as number[][]);
    case "MultiLineString":
      return (geom.coordinates as number[][][]).map(lineToPath).join(" ");
    case "Point": {
      const coords = geom.coordinates as number[];
      const { x, y } = projectLatLng(coords[1], coords[0]);
      return `M ${x - 4} ${y} a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0`;
    }
    default:
      return "";
  }
}
