// ==========================================================
// Atlas
// apps/api/tests/migration-runner.test.ts
// Migration runner unit tests (P3) — pure file-selection logic.
// ==========================================================

import { collectMigrationFiles } from "../../../packages/database/src/migrations/run";

describe("Migration runner — collectMigrationFiles", () => {
  it("selects only \\d{3}_*.sql migration files in sorted order", () => {
    const files = [
      "003_decision_learning.sql",
      "001_initial.sql",
      "002_decision_engine.sql",
      "004_supplement_templates.sql",
      "README.md",
      "notes.txt",
    ];
    expect(collectMigrationFiles(files)).toEqual([
      "001_initial.sql",
      "002_decision_engine.sql",
      "003_decision_learning.sql",
      "004_supplement_templates.sql",
    ]);
  });

  it("skips the destructive reset migration (000_*)", () => {
    const files = ["000_reset_partial_atlas_schema.sql", "001_initial.sql"];
    expect(collectMigrationFiles(files)).toEqual(["001_initial.sql"]);
  });

  it("skips down migrations (*_down.sql)", () => {
    const files = [
      "001_initial.sql",
      "001_initial_down.sql",
      "002_decision_engine_down.sql",
    ];
    expect(collectMigrationFiles(files)).toEqual(["001_initial.sql"]);
  });

  it("is stable and deterministic (no duplicates, no mutation)", () => {
    const files = ["002_decision_engine.sql", "001_initial.sql", "002_decision_engine.sql"];
    const out = collectMigrationFiles(files);
    expect(out).toEqual(["001_initial.sql", "002_decision_engine.sql"]);
    expect(files).toHaveLength(3); // input not mutated
  });

  it("returns an empty list for empty / irrelevant input", () => {
    expect(collectMigrationFiles([])).toEqual([]);
    expect(collectMigrationFiles(["000_reset.sql", "x_down.sql", "readme.md"])).toEqual([]);
  });
});
