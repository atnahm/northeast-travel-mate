import Dexie, { type Table } from "dexie";
import type {
  NEState,
  PermitChecklistResponse,
  Place,
  SavedTrainRecord,
  Speciality,
  Trip,
  TripItem,
  UserProfile,
} from "@ne-mate/shared";

export interface OutboxOp {
  op_id: string;
  entity: "trips" | "trip_items" | "saved_places" | "trip_permit_tasks";
  action: "upsert" | "delete";
  doc_id: string;
  parent_id?: string;
  base_version?: number;
  data: Record<string, unknown>;
  queued_at: string;
}

export interface OfflinePackRecord {
  state_code: string;
  pack_version: string;
  downloaded_at: string;
  pack_size_mb: number;
  state: NEState;
  bundle: {
    places: Place[];
    specialities: Speciality[];
    permits: Record<string, unknown>[];
    permit_rules: Record<string, unknown>[];
    alerts: Record<string, unknown>[];
    helplines: Record<string, unknown>[];
    phrasebook: Record<string, unknown>[];
    transport_nodes: Record<string, unknown>[];
  };
}

class NEMateOfflineDB extends Dexie {
  profile!: Table<UserProfile, string>;
  trips!: Table<Trip, string>;
  trip_days!: Table<{ id: string; trip_id: string; day_index: number; date?: string; notes?: string }, string>;
  trip_items!: Table<TripItem, string>;
  permit_checklists!: Table<{ id: string; state_code: string; updated_at: string; payload: PermitChecklistResponse }, string>;
  saved_places!: Table<{ id: string; place_id: string; title: string; state_code?: string; lat?: number; lng?: number }, string>;
  phrasebook!: Table<Record<string, unknown> & { id: string }, string>;
  offline_packs!: Table<OfflinePackRecord, string>;
  outbox!: Table<OutboxOp, string>;
  meta!: Table<{ key: string; value: unknown; updated_at: string }, string>;
  saved_trains!: Table<SavedTrainRecord, string>;

  constructor() {
    super("ne_mate_offline_v1");
    this.version(1).stores({
      profile: "id",
      trips: "id, owner_id, status",
      trip_days: "id, trip_id, day_index",
      trip_items: "id, trip_id, day_index",
      permit_checklists: "id, state_code",
      saved_places: "id, place_id, state_code",
      phrasebook: "id, language_code, category",
      offline_packs: "state_code",
      outbox: "op_id, entity, queued_at",
      meta: "key",
    });
    this.version(2).stores({
      profile: "id",
      trips: "id, owner_id, status",
      trip_days: "id, trip_id, day_index",
      trip_items: "id, trip_id, day_index",
      permit_checklists: "id, state_code",
      saved_places: "id, place_id, state_code",
      phrasebook: "id, language_code, category",
      offline_packs: "state_code",
      outbox: "op_id, entity, queued_at",
      meta: "key",
      saved_trains: "id, trainNo, startDate, savedAt",
    });
  }
}

export async function saveTrainOffline(record: SavedTrainRecord): Promise<void> {
  if (!offlineDb) return;
  await offlineDb.saved_trains.put(record);
}

export async function listSavedTrains(): Promise<SavedTrainRecord[]> {
  if (!offlineDb) return [];
  return offlineDb.saved_trains.orderBy("savedAt").reverse().toArray();
}

export async function removeSavedTrain(id: string): Promise<void> {
  if (!offlineDb) return;
  await offlineDb.saved_trains.delete(id);
}

export const offlineDb = typeof window !== "undefined" ? new NEMateOfflineDB() : (null as unknown as NEMateOfflineDB);

export async function cacheTripOffline(trip: Trip): Promise<void> {
  if (!offlineDb) return;
  await offlineDb.trips.put(trip);
  if (trip.days?.length) {
    await offlineDb.trip_days.bulkPut(
      trip.days.map((d) => ({ ...d, id: `${trip.id}_day_${d.day_index}` }))
    );
  }
  if (trip.items?.length) {
    await offlineDb.trip_items.bulkPut(trip.items);
  }
  await offlineDb.meta.put({ key: `trip_cached_${trip.id}`, value: true, updated_at: new Date().toISOString() });
}

export async function queueOfflineOp(op: Omit<OutboxOp, "queued_at">): Promise<void> {
  if (!offlineDb) return;
  await offlineDb.outbox.put({ ...op, queued_at: new Date().toISOString() });
}

export async function flushOfflineOutbox(): Promise<{ applied: number; conflicts: unknown[] }> {
  if (!offlineDb) return { applied: 0, conflicts: [] };
  const ops = await offlineDb.outbox.toArray();
  if (!ops.length) return { applied: 0, conflicts: [] };

  const resp = await fetch("/api/proxy/api/v1/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ client_version: 1, operations: ops }),
  });

  if (!resp.ok) throw new Error("Sync failed");
  const json = await resp.json();
  const appliedIds: string[] = json.applied_op_ids || [];
  if (appliedIds.length) {
    await offlineDb.outbox.bulkDelete(appliedIds);
  }
  await offlineDb.meta.put({ key: "last_sync", value: json.synced_at, updated_at: new Date().toISOString() });
  return { applied: appliedIds.length, conflicts: json.conflicts || [] };
}
