import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..", "..");
const py = resolve(repoRoot, ".venv", "Scripts", "python.exe");
const outPath = resolve(repoRoot, "packages", "shared", "openapi.json");

const jsonText = execFileSync(py, [
  "-c",
  "import json; from services.api.app.main import app; print(json.dumps(app.openapi(), indent=2))",
], { cwd: repoRoot, encoding: "utf-8" });

writeFileSync(outPath, jsonText, "utf-8");
console.log(`Generated OpenAPI schema at ${outPath}`);
