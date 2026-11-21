"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { MapPin, Navigation, ZoomIn, ZoomOut } from "lucide-react";
import { useAppStore } from "@/lib/store/app-store";

export interface MapPinItem {
  id: string;
  label: string;
  lat: number;
  lng: number;
  category?: string;
  state_code?: string;
  highlight?: boolean;
}

export interface NEMapProps {
  pins: MapPinItem[];
  center?: { lat: number; lng: number };
  routePath?: Array<{ lat: number; lng: number }>;
  selectedId?: string | null;
  onSelectPin?: (pin: MapPinItem) => void;
  pickMode?: boolean;
  onPickCoordinate?: (coord: { lat: number; lng: number }) => void;
  heightClass?: string;
}

const NE_BOUNDS = { minLat: 21.8, maxLat: 29.5, minLng: 87.8, maxLng: 97.5 };

const STATE_CENTROIDS = [
  { code: "SK", name: "Sikkim", lat: 27.53, lng: 88.51 },
  { code: "AS", name: "Assam", lat: 26.20, lng: 92.93 },
  { code: "ML", name: "Meghalaya", lat: 25.47, lng: 91.37 },
  { code: "AR", name: "Arunachal", lat: 28.22, lng: 94.73 },
  { code: "NL", name: "Nagaland", lat: 26.16, lng: 94.56 },
  { code: "MN", name: "Manipur", lat: 24.66, lng: 93.91 },
  { code: "MZ", name: "Mizoram", lat: 23.16, lng: 92.94 },
  { code: "TR", name: "Tripura", lat: 23.94, lng: 91.99 },
];

function project(lat: number, lng: number, width = 800, height = 460) {
  const x = ((lng - NE_BOUNDS.minLng) / (NE_BOUNDS.maxLng - NE_BOUNDS.minLng)) * width;
  const y = height - ((lat - NE_BOUNDS.minLat) / (NE_BOUNDS.maxLat - NE_BOUNDS.minLat)) * height;
  return { x, y };
}

function unproject(x: number, y: number, width = 800, height = 460) {
  const lng = NE_BOUNDS.minLng + (x / width) * (NE_BOUNDS.maxLng - NE_BOUNDS.minLng);
  const lat = NE_BOUNDS.minLat + ((height - y) / height) * (NE_BOUNDS.maxLat - NE_BOUNDS.minLat);
  return { lat: Number(lat.toFixed(4)), lng: Number(lng.toFixed(4)) };
}

export function NEMap({
  pins,
  center = { lat: 26.1445, lng: 91.7362 },
  routePath,
  selectedId,
  onSelectPin,
  pickMode = false,
  onPickCoordinate,
  heightClass = "h-[360px] md:h-[460px]",
}: NEMapProps) {
  const isOnline = useAppStore((s) => s.isOnline);
  const browserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY || "";
  const useGoogle = Boolean(isOnline && browserKey);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!useGoogle || !mapContainerRef.current) return;
    let cancelled = false;

    const loader = new Loader({
      apiKey: browserKey,
      version: "weekly",
    });

    loader
      .importLibrary("maps")
      .then((mapsLib) => {
        if (cancelled || !mapContainerRef.current) return;
        const map = new mapsLib.Map(mapContainerRef.current, {
          center,
          zoom: 7,
          mapTypeControl: false,
          streetViewControl: false,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = (window as unknown as { google?: any }).google;
        if (!g?.maps) return;

        for (const p of pins) {
          const marker = new g.maps.Marker({
            position: { lat: p.lat, lng: p.lng },
            map,
            title: p.label,
          });
          marker.addListener("click", () => onSelectPin?.(p));
        }

        if (routePath && routePath.length >= 2) {
          new g.maps.Polyline({
            path: routePath,
            geodesic: true,
            strokeColor: "#2A6F97",
            strokeOpacity: 0.9,
            strokeWeight: 4,
            map,
          });
        }

        if (pickMode && onPickCoordinate) {
          map.addListener("click", (ev: { latLng?: { lat: () => number; lng: () => number } }) => {
            if (ev.latLng) {
              onPickCoordinate({ lat: Number(ev.latLng.lat().toFixed(4)), lng: Number(ev.latLng.lng().toFixed(4)) });
            }
          });
        }
      })
      .catch((err) => {
        if (!cancelled) setGoogleError(err instanceof Error ? err.message : "Google Maps failed to load");
      });

    return () => {
      cancelled = true;
    };
  }, [useGoogle, browserKey, center.lat, center.lng, pins, routePath, pickMode]);

  if (useGoogle && !googleError) {
    return (
      <div className={`relative w-full rounded-card overflow-hidden border border-borderSubtle ${heightClass}`}>
        <div ref={mapContainerRef} className="w-full h-full" />
        {pickMode && (
          <div className="absolute top-3 left-3 bg-surface/95 text-ink px-3 py-1.5 rounded-full text-xs font-semibold shadow border border-borderSubtle flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-forest" />
            Tap map to pick coordinates
          </div>
        )}
      </div>
    );
  }

  // Offline / Local-coordinate Map (B9.4 OSM-attributed open coordinate layer)
  const routePointsStr = (routePath || [])
    .map((pt) => {
      const p = project(pt.lat, pt.lng);
      return `${p.x},${p.y}`;
    })
    .join(" ");

  return (
    <div
      className={`relative w-full rounded-card overflow-hidden border border-borderSubtle bg-[#E7EFEA] dark:bg-[#14201C] ${heightClass}`}
      aria-label="North-East India interactive coordinate map"
    >
      <svg
        viewBox="0 0 800 460"
        className="w-full h-full select-none"
        style={{ transform: `scale(${zoom})`, transformOrigin: "center center", transition: "transform 150ms ease" }}
        onClick={(e) => {
          if (!pickMode || !onPickCoordinate) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 800;
          const y = ((e.clientY - rect.top) / rect.height) * 460;
          onPickCoordinate(unproject(x, y));
        }}
      >
        {/* Subtle elevation grid + Brahmaputra river silhouette */}
        <defs>
          <pattern id="neGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeOpacity="0.07" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="800" height="460" fill="url(#neGrid)" className="text-forest" />
        <path
          d="M 650 130 Q 520 165 400 205 T 230 225 T 140 275"
          fill="none"
          stroke="#2A6F97"
          strokeOpacity="0.35"
          strokeWidth="9"
          strokeLinecap="round"
        />

        {/* State labels */}
        {STATE_CENTROIDS.map((st) => {
          const p = project(st.lat, st.lng);
          return (
            <g key={st.code} transform={`translate(${p.x}, ${p.y})`}>
              <circle r="26" fill="#1F5E4B" fillOpacity="0.08" />
              <text
                textAnchor="middle"
                dy="4"
                className="fill-inkMuted text-[11px] font-semibold uppercase tracking-wider"
              >
                {st.name}
              </text>
            </g>
          );
        })}

        {/* Optional route polyline */}
        {routePath && routePath.length >= 2 && (
          <polyline
            fill="none"
            stroke="#2A6F97"
            strokeWidth="4"
            strokeDasharray="8 6"
            points={routePointsStr}
          />
        )}

        {/* Pins */}
        {pins.map((pin) => {
          const p = project(pin.lat, pin.lng);
          const isSelected = selectedId === pin.id || pin.highlight;
          const catColor =
            pin.category === "food"
              ? "#D9A441"
              : pin.category === "culture"
              ? "#7A4E2D"
              : pin.category === "stay" || pin.category === "transport"
              ? "#2A6F97"
              : pin.category === "hospital" || pin.category === "police"
              ? "#A31C24"
              : "#1F5E4B";
          const fill = isSelected ? "#C8401C" : catColor;
          const stroke = pin.category === "food" && !isSelected ? "#22262A" : "#FFFFFF";
          return (
            <g
              key={pin.id}
              transform={`translate(${p.x}, ${p.y})`}
              className="cursor-pointer"
              onClick={(ev) => {
                ev.stopPropagation();
                onSelectPin?.(pin);
              }}
            >
              <circle
                r={isSelected ? 11 : 7.5}
                fill={fill}
                stroke={stroke}
                strokeWidth="2.5"
              />
              <title>{pin.label}</title>
            </g>
          );
        })}
      </svg>

      {/* Controls & Attribution */}
      <div className="absolute top-3 left-3 flex flex-wrap gap-2">
        <span className="bg-surface/95 text-ink px-3 py-1.5 rounded-full text-xs font-medium border border-borderSubtle shadow-sm flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-forest" />
          {!isOnline
            ? "Offline Coordinate Map"
            : googleError
            ? "Fallback Map View"
            : "Interactive NE Map"}
        </span>
        {pickMode && (
          <span className="bg-forest text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm">
            Click anywhere on map to pick point
          </span>
        )}
      </div>

      <div className="absolute top-3 right-3 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(2.2, Number((z + 0.25).toFixed(2))))}
          className="w-10 h-10 rounded-xl bg-surface/95 border border-borderSubtle flex items-center justify-center shadow-sm hover:bg-mutedSurface"
          aria-label="Zoom in map"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(1, Number((z - 0.25).toFixed(2))))}
          className="w-10 h-10 rounded-xl bg-surface/95 border border-borderSubtle flex items-center justify-center shadow-sm hover:bg-mutedSurface"
          aria-label="Zoom out map"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>

      <div className="absolute bottom-0 inset-x-0 h-7 bg-surface/90 border-t border-borderSubtle px-3 flex items-center justify-end text-[11px] text-inkMuted z-10">
        Offline map data © OpenStreetMap contributors
      </div>
    </div>
  );
}
