"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Compass, Layers, MapPin, Navigation, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
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

const TILE_SIZE = 256;

/** Web Mercator projection: (lat, lng, zoom) -> global pixel coordinates */
function latLngToWorldPx(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = TILE_SIZE * Math.pow(2, zoom);
  const clampedLat = Math.max(-85.0511, Math.min(85.0511, lat));
  const sinLat = Math.sin((clampedLat * Math.PI) / 180);
  const x = ((lng + 180) / 360) * scale;
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return { x, y };
}

/** Inverse Web Mercator projection: global pixel coordinates -> (lat, lng) */
function worldPxToLatLng(px: number, py: number, zoom: number): { lat: number; lng: number } {
  const scale = TILE_SIZE * Math.pow(2, zoom);
  const lng = (px / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * py) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return {
    lat: Number(lat.toFixed(4)),
    lng: Number(lng.toFixed(4)),
  };
}

function getPinColor(category?: string, isSelected?: boolean): string {
  if (isSelected) return "#C8401C";
  if (category === "food") return "#D9A441";
  if (category === "culture") return "#7A4E2D";
  if (category === "stay" || category === "transport") return "#2A6F97";
  if (category === "hospital" || category === "police") return "#A31C24";
  return "#1F5E4B";
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
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>({ w: 860, h: 400 });
  const [zoom, setZoom] = useState<number>(8);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(center);
  const [tileStyle, setTileStyle] = useState<"osm" | "topo">("osm");
  const [dragging, setDragging] = useState(false);

  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    startCenterPx: { x: number; y: number };
    moved: boolean;
  } | null>(null);

  // Measure container width & height
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setViewportSize({ w: Math.round(rect.width), h: Math.round(rect.height) });
      }
    };
    updateSize();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateSize) : null;
    ro?.observe(el);
    window.addEventListener("resize", updateSize);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  // Re-center and choose best zoom when external center or routePath changes
  useEffect(() => {
    if (routePath && routePath.length >= 2) {
      const lats = routePath.map((p) => p.lat);
      const lngs = routePath.map((p) => p.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      setMapCenter({ lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 });
      const span = Math.max(maxLat - minLat, maxLng - minLng);
      setZoom(span > 4 ? 6 : span > 2 ? 7 : span > 0.8 ? 8 : 10);
      return;
    }
    setMapCenter(center);
    if (pins.length > 1) {
      const lats = pins.map((p) => p.lat);
      const lngs = pins.map((p) => p.lng);
      const span = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs));
      setZoom(span > 4.5 ? 6 : span > 2 ? 7 : span > 0.7 ? 8 : 10);
    } else if (pins.length === 1) {
      setMapCenter({ lat: pins[0].lat, lng: pins[0].lng });
      setZoom(11);
    }
  }, [center.lat, center.lng, routePath]);

  // Focus on selected pin when user clicks a card or marker
  useEffect(() => {
    if (!selectedId) return;
    const hit = pins.find((p) => p.id === selectedId);
    if (hit) {
      setMapCenter({ lat: hit.lat, lng: hit.lng });
      setZoom((z) => Math.max(z, 10));
    }
  }, [selectedId, pins]);

  const centerWorldPx = useMemo(
    () => latLngToWorldPx(mapCenter.lat, mapCenter.lng, zoom),
    [mapCenter.lat, mapCenter.lng, zoom]
  );

  const topLeftWorldPx = useMemo(
    () => ({
      x: centerWorldPx.x - viewportSize.w / 2,
      y: centerWorldPx.y - viewportSize.h / 2,
    }),
    [centerWorldPx, viewportSize]
  );

  // Compute visible 256x256 slippy tiles
  const visibleTiles = useMemo(() => {
    const maxTileIndex = Math.pow(2, zoom) - 1;
    const minTileX = Math.floor(topLeftWorldPx.x / TILE_SIZE);
    const maxTileX = Math.floor((topLeftWorldPx.x + viewportSize.w) / TILE_SIZE);
    const minTileY = Math.max(0, Math.floor(topLeftWorldPx.y / TILE_SIZE));
    const maxTileY = Math.min(maxTileIndex, Math.floor((topLeftWorldPx.y + viewportSize.h) / TILE_SIZE));

    const tiles: Array<{ key: string; url: string; left: number; top: number }> = [];
    for (let tx = minTileX; tx <= maxTileX; tx++) {
      const wrappedTx = ((tx % (maxTileIndex + 1)) + (maxTileIndex + 1)) % (maxTileIndex + 1);
      for (let ty = minTileY; ty <= maxTileY; ty++) {
        const left = Math.round(tx * TILE_SIZE - topLeftWorldPx.x);
        const top = Math.round(ty * TILE_SIZE - topLeftWorldPx.y);
        const url =
          tileStyle === "topo"
            ? `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${zoom}/${ty}/${wrappedTx}`
            : `https://tile.openstreetmap.org/${zoom}/${wrappedTx}/${ty}.png`;
        tiles.push({
          key: `${tileStyle}-${zoom}-${wrappedTx}-${ty}`,
          url,
          left,
          top,
        });
      }
    }
    return tiles;
  }, [zoom, topLeftWorldPx, viewportSize, tileStyle]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startCenterPx: { ...centerWorldPx },
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragStartRef.current;
    if (!st) return;
    const dx = e.clientX - st.clientX;
    const dy = e.clientY - st.clientY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      st.moved = true;
    }
    const nextPx = st.startCenterPx.x - dx;
    const nextPy = st.startCenterPx.y - dy;
    setMapCenter(worldPxToLatLng(nextPx, nextPy, zoom));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragStartRef.current;
    dragStartRef.current = null;
    setDragging(false);
    if (!st) return;

    if (!st.moved && pickMode && onPickCoordinate && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clickWorldX = topLeftWorldPx.x + (e.clientX - rect.left);
      const clickWorldY = topLeftWorldPx.y + (e.clientY - rect.top);
      onPickCoordinate(worldPxToLatLng(clickWorldX, clickWorldY, zoom));
    }
  };

  const routeSvgPoints = useMemo(() => {
    if (!routePath || routePath.length < 2) return "";
    return routePath
      .map((pt) => {
        const w = latLngToWorldPx(pt.lat, pt.lng, zoom);
        return `${Math.round(w.x - topLeftWorldPx.x)},${Math.round(w.y - topLeftWorldPx.y)}`;
      })
      .join(" ");
  }, [routePath, zoom, topLeftWorldPx]);

  const resetView = () => {
    setMapCenter(center);
    setZoom(8);
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={() => setZoom((z) => Math.min(15, z + 1))}
      className={`relative w-full rounded-card overflow-hidden border border-borderSubtle bg-[#DCE7E1] dark:bg-[#14201C] select-none ${
        pickMode ? "cursor-crosshair" : dragging ? "cursor-grabbing" : "cursor-grab"
      } ${heightClass}`}
      aria-label="North-East India interactive street and terrain map"
    >
      {/* Real Slippy Map Tiles Layer */}
      {isOnline && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {visibleTiles.map((t) => (
            <img
              key={t.key}
              src={t.url}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                left: `${t.left}px`,
                top: `${t.top}px`,
                width: `${TILE_SIZE}px`,
                height: `${TILE_SIZE}px`,
              }}
              className="max-w-none select-none"
            />
          ))}
        </div>
      )}

      {/* Route Polyline Layer */}
      {routeSvgPoints && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <polyline
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={routeSvgPoints}
          />
          <polyline
            fill="none"
            stroke="#1F5E4B"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={routeSvgPoints}
          />
        </svg>
      )}

      {/* Interactive Pin Markers Layer */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {pins.map((pin) => {
          const w = latLngToWorldPx(pin.lat, pin.lng, zoom);
          const x = Math.round(w.x - topLeftWorldPx.x);
          const y = Math.round(w.y - topLeftWorldPx.y);
          if (x < -80 || x > viewportSize.w + 80 || y < -80 || y > viewportSize.h + 80) {
            return null;
          }
          const isSelected = selectedId === pin.id || Boolean(pin.highlight);
          const pinColor = getPinColor(pin.category, isSelected);

          return (
            <button
              key={pin.id}
              type="button"
              onClick={(ev) => {
                ev.stopPropagation();
                onSelectPin?.(pin);
              }}
              style={{
                position: "absolute",
                left: `${x}px`,
                top: `${y}px`,
                transform: "translate(-50%, -100%)",
                zIndex: isSelected ? 25 : 15,
              }}
              className="pointer-events-auto group flex flex-col items-center focus:outline-none"
              title={pin.label}
            >
              <span
                style={{
                  backgroundColor: isSelected ? "#C8401C" : "#183D32",
                  color: "#FFFFFF",
                }}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold shadow-md whitespace-nowrap mb-1 border border-white/80 transition-transform ${
                  isSelected ? "scale-105" : "group-hover:scale-105"
                }`}
              >
                {pin.label}
              </span>
              <span
                style={{ backgroundColor: pinColor }}
                className="w-4 h-4 rounded-full border-2 border-white shadow-md"
              />
            </button>
          );
        })}
      </div>

      {/* Top-Left Status & Layer Switcher */}
      <div className="absolute top-3 left-3 z-30 flex flex-wrap items-center gap-2">
        <span
          style={{ backgroundColor: "rgba(255,255,255,0.94)", color: "#22262A" }}
          className="px-3 py-1.5 rounded-full text-xs font-semibold border border-borderSubtle shadow-sm flex items-center gap-1.5"
        >
          <MapPin className="w-3.5 h-3.5 text-[#1F5E4B]" />
          {!isOnline ? "Offline Coordinate View" : tileStyle === "topo" ? "Topographic Terrain Map" : "North-East Street & Highway Map"}
        </span>

        {isOnline && (
          <button
            type="button"
            onClick={() => setTileStyle((s) => (s === "osm" ? "topo" : "osm"))}
            style={{ backgroundColor: "rgba(255,255,255,0.94)", color: "#183D32" }}
            className="px-3 py-1.5 rounded-full text-xs font-semibold border border-borderSubtle shadow-sm flex items-center gap-1.5 hover:opacity-95"
          >
            <Layers className="w-3.5 h-3.5" />
            {tileStyle === "osm" ? "Switch to Terrain" : "Switch to Street"}
          </button>
        )}

        {pickMode && (
          <span
            style={{ backgroundColor: "#1F5E4B", color: "#FFFFFF" }}
            className="px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm flex items-center gap-1.5"
          >
            <Navigation className="w-3.5 h-3.5" />
            Click anywhere on map to pick coordinates
          </span>
        )}
      </div>

      {/* Top-Right Zoom & Reset Controls */}
      <div className="absolute top-3 right-3 z-30 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(15, z + 1))}
          style={{ backgroundColor: "rgba(255,255,255,0.95)", color: "#22262A" }}
          className="w-10 h-10 rounded-xl border border-borderSubtle flex items-center justify-center shadow-sm hover:opacity-90"
          aria-label="Zoom in map"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(6, z - 1))}
          style={{ backgroundColor: "rgba(255,255,255,0.95)", color: "#22262A" }}
          className="w-10 h-10 rounded-xl border border-borderSubtle flex items-center justify-center shadow-sm hover:opacity-90"
          aria-label="Zoom out map"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={resetView}
          style={{ backgroundColor: "rgba(255,255,255,0.95)", color: "#22262A" }}
          className="w-10 h-10 rounded-xl border border-borderSubtle flex items-center justify-center shadow-sm hover:opacity-90"
          aria-label="Reset map view"
          title="Reset map view"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Attribution Strip */}
      <div
        style={{ backgroundColor: "rgba(255,255,255,0.9)", color: "#525B63" }}
        className="absolute bottom-0 inset-x-0 h-7 border-t border-borderSubtle px-3 flex items-center justify-between text-[11px] z-20"
      >
        <span className="flex items-center gap-1 font-medium">
          <Compass className="w-3 h-3 text-[#1F5E4B]" />
          Drag to pan · Double-click or use +/− to zoom (Z{zoom})
        </span>
        <span>
          {tileStyle === "topo"
            ? "Tiles © Esri, USGS, NOAA · Data © OpenStreetMap"
            : "Map data © OpenStreetMap contributors"}
        </span>
      </div>
    </div>
  );
}
