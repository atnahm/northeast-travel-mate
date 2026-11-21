import railheadsRaw from "../../../../../data/trains/ne-railheads.json";
import stationsRaw from "../../../../../data/trains/stations-nfr.json";
import type { RailheadDestination, RailheadOption, StationEntry, WeekdayCode } from "@ne-mate/shared";

export const LOCAL_STATIONS: StationEntry[] = stationsRaw.stations as StationEntry[];

const STATION_MAP = new Map<string, StationEntry>(LOCAL_STATIONS.map((s) => [s.code, s]));

export const LOCAL_DESTINATIONS: RailheadDestination[] = (railheadsRaw.destinations as unknown as RailheadDestination[]).map(
  (d) => ({
    ...d,
    railheads: d.railheads.map((rh): RailheadOption => {
      const st = STATION_MAP.get(rh.code);
      return {
        ...rh,
        name: st?.name || rh.code,
        lat: st?.lat,
        lng: st?.lng,
      };
    }),
  })
);

export type AutocompleteItem =
  | { kind: "place"; destination: RailheadDestination; label: string; sublabel: string; code: string }
  | { kind: "station"; station: StationEntry; label: string; sublabel: string; code: string };

/** Zero-API local autocomplete: ne-railheads.json first, stations-nfr.json second. */
export function searchLocalRailEntries(query: string, limit = 8): AutocompleteItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const places: Array<{ score: number; item: AutocompleteItem }> = [];
  for (const dest of LOCAL_DESTINATIONS) {
    const names = [dest.name.toLowerCase(), ...(dest.aliases || []).map((a) => a.toLowerCase())];
    const primary = dest.railheads.find((r) => r.isPrimary) || dest.railheads[0];
    if (!primary) continue;
    let score = 99;
    if (names.some((n) => n === q)) score = 0;
    else if (names.some((n) => n.startsWith(q))) score = 1;
    else if (names.some((n) => n.includes(q))) score = 3;
    if (score < 99) {
      places.push({
        score,
        item: {
          kind: "place",
          destination: dest,
          label: dest.name,
          sublabel: dest.hasDirectRail
            ? `${primary.name} (${primary.code}) • ${dest.stateCode}`
            : `Nearest railhead: ${primary.name} (${primary.code})${primary.roadKm ? ` · ~${primary.roadKm} km` : ""}`,
          code: primary.code,
        },
      });
    }
  }

  const stations: Array<{ score: number; item: AutocompleteItem }> = [];
  for (const st of LOCAL_STATIONS) {
    const code = st.code.toLowerCase();
    const name = st.name.toLowerCase();
    let score = 99;
    if (code === q) score = 0;
    else if (code.startsWith(q) || name.startsWith(q)) score = 2;
    else if (name.includes(q)) score = 4;
    if (score < 99) {
      stations.push({
        score,
        item: {
          kind: "station",
          station: st,
          label: `${st.name} (${st.code})`,
          sublabel: `Railway Station • ${st.stateCode}`,
          code: st.code,
        },
      });
    }
  }

  places.sort((a, b) => a.score - b.score || a.item.label.localeCompare(b.item.label));
  stations.sort((a, b) => a.score - b.score || a.item.label.localeCompare(b.item.label));
  return [...places.map((p) => p.item), ...stations.map((s) => s.item)].slice(0, limit);
}

export function getStationByCode(code: string): StationEntry | undefined {
  return STATION_MAP.get(code.toUpperCase());
}

export function getDestinationById(id: string): RailheadDestination | undefined {
  return LOCAL_DESTINATIONS.find((d) => d.id === id);
}

export function findNearestStation(lat: number, lng: number): StationEntry {
  const toRad = (d: number) => (d * Math.PI) / 180;
  let best = LOCAL_STATIONS[0];
  let bestDist = Infinity;
  for (const st of LOCAL_STATIONS) {
    const dLat = toRad(st.lat - lat);
    const dLng = toRad(st.lng - lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat)) * Math.cos(toRad(st.lat)) * Math.sin(dLng / 2) ** 2;
    const dist = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
    if (dist < bestDist) {
      bestDist = dist;
      best = st;
    }
  }
  return best;
}

export function todayIstDateString(): string {
  const now = new Date();
  const istMs = now.getTime() + 5.5 * 3600_000;
  return new Date(istMs).toISOString().slice(0, 10);
}

export function yesterdayIstDateString(): string {
  const now = new Date();
  const istMs = now.getTime() + 5.5 * 3600_000 - 86400_000;
  return new Date(istMs).toISOString().slice(0, 10);
}

export function formatIstHHMM(iso: string | null | undefined): string {
  if (!iso) return "--:--";
  const m = iso.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : iso.slice(0, 5);
}

export function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export function weekdayFromIsoDate(isoDate: string): WeekdayCode {
  const dt = new Date(`${isoDate}T12:00:00+05:30`);
  const map: WeekdayCode[] = ["Su", "M", "T", "W", "Th", "F", "Sa"];
  return map[dt.getDay()];
}

export function formatShortDate(isoDate: string): string {
  const dt = new Date(`${isoDate}T12:00:00+05:30`);
  return dt.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export function formatRelativeAge(iso: string | null | undefined): string {
  if (!iso) return "unknown age";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
