import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

function readJson(relPath) {
  const full = path.join(REPO_ROOT, relPath);
  return JSON.parse(fs.readFileSync(full, "utf-8"));
}

test("PS08 Data Integrity: all 8 North-East states are present with valid centers", () => {
  const states = readJson("data/seed/states.json");
  const expectedCodes = ["AR", "AS", "ML", "MN", "MZ", "NL", "SK", "TR"];
  const codes = states.map((s) => s.code).sort();
  assert.deepEqual(codes, expectedCodes);
  for (const st of states) {
    assert.ok(st.center && typeof st.center.lat === "number" && typeof st.center.lng === "number");
    assert.ok(st.name_i18n?.en);
  }
});

test("PS08 Destination Media: every curated place has a verified local landmark photograph", () => {
  const places = readJson("data/seed/places.json");
  assert.ok(places.length >= 28);
  for (const pl of places) {
    const imgPath = path.join(REPO_ROOT, "apps/web/public/places", `${pl.id}.jpg`);
    assert.ok(fs.existsSync(imgPath), `Missing landmark image for ${pl.id}`);
    const stat = fs.statSync(imgPath);
    assert.ok(stat.size > 10_000, `Landmark image for ${pl.id} is unexpectedly small`);
  }
});

test("NFR Railway Dataset: 260+ NFR stations, 14 NE railheads, and 200+ scheduled trains", () => {
  const stationsDoc = readJson("data/trains/stations-nfr.json");
  const railheadsDoc = readJson("data/trains/ne-railheads.json");
  const trainsDoc = readJson("data/trains/fallback-nfr-trains.json");

  assert.ok(stationsDoc.stations.length >= 260);
  assert.equal(railheadsDoc.destinations.length, 14);
  assert.ok(trainsDoc.trains.length >= 200);

  // Verify Aizawl uses Sairang (SANG) as primary direct railhead
  const aizawl = railheadsDoc.destinations.find((d) => d.id === "aizawl");
  assert.ok(aizawl);
  assert.equal(aizawl.hasDirectRail, true);
  assert.equal(aizawl.railheads[0].code, "SANG");

  // Verify zero permitRequired booleans exist inside ne-railheads.json
  const rawRailheadsText = fs.readFileSync(path.join(REPO_ROOT, "data/trains/ne-railheads.json"), "utf-8");
  assert.equal(rawRailheadsText.includes("permitRequired"), false);
});

test("OpenAPI 3.1 Contract: shared openapi.json is valid and exposes core endpoints", () => {
  const spec = readJson("packages/shared/openapi.json");
  assert.ok(spec.openapi.startsWith("3."));
  assert.ok(spec.paths["/api/v1/health"]);
  assert.ok(spec.paths["/api/v1/permits/checklist"]);
  assert.ok(spec.paths["/api/v1/places/search"]);
});

test("Security Guard: zero hardcoded API keys in frontend source files", () => {
  const clientTs = fs.readFileSync(path.join(REPO_ROOT, "apps/web/src/lib/firebase/client.ts"), "utf-8");
  const mapTsx = fs.readFileSync(path.join(REPO_ROOT, "apps/web/src/components/maps/NEMap.tsx"), "utf-8");
  assert.equal(clientTs.includes("AIzaSy"), false);
  assert.equal(mapTsx.includes("AIzaSy"), false);
});
