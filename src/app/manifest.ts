import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GeoTrainer — Slepa karta sveta",
    short_name: "GeoTrainer",
    description:
      "Interaktivni kviz in vadba lokacij na slepem zemljevidu sveta. Podpora za učenje brez povezave in Neon Cloud sinhronizacijo.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b1120",
    theme_color: "#2563eb",
    orientation: "any",
    categories: ["education", "games"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "192x192 512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Igraj: Poišči na zemljevidu",
        short_name: "Igraj",
        description: "Začni krog iskanja lokacij na slepi karti",
        url: "/play/locate",
        icons: [{ src: "/icon.svg", sizes: "96x96" }],
      },
      {
        name: "Vadba po kategorijah",
        short_name: "Vadba",
        description: "Prebrskaj lokacije in jih oglej na zemljevidu",
        url: "/practice",
        icons: [{ src: "/icon.svg", sizes: "96x96" }],
      },
      {
        name: "Moj napredek",
        short_name: "Napredek",
        description: "Statistika obvladanosti in zgodovina iger",
        url: "/progress",
        icons: [{ src: "/icon.svg", sizes: "96x96" }],
      },
    ],
  };
}
