import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BizzFlow | Business ERP System",
    short_name: "BizzFlow",
    description: "Modern enterprise resource planning and management.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b1220",
    theme_color: "#0b1220",
    icons: [
      {
        src: "/app-icon.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/app-icon.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/app-icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
