// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Sets analytics.googleMeasurementId in site/runtime-config.js (used by the Pages workflow with the repository
// variable GA_MEASUREMENT_ID). Usage: node scripts/set_analytics_id.mjs G-XXXXXXXXXX   (an empty value clears it)
import { readFileSync, writeFileSync } from "node:fs";
const id = String(process.argv[2] || "").trim().replace(/^["']|["']$/g, "");
if (!id && process.argv.includes("--if-set")) { console.log("No Google Analytics measurement ID given: runtime-config.js unchanged"); process.exit(0); }
if (id && !/^(G|GT)-[A-Z0-9]{4,}$/i.test(id)) { console.error(`Not a Google Analytics measurement ID (G-... or GT-...): ${id}`); process.exit(1); }
const path = new URL("../site/runtime-config.js", import.meta.url), text = readFileSync(path, "utf8");
const next = text.replace(/googleMeasurementId: "[^"]*"/, `googleMeasurementId: "${id}"`);
if (next === text && !text.includes(`googleMeasurementId: "${id}"`)) { console.error("googleMeasurementId not found in site/runtime-config.js"); process.exit(1); }
writeFileSync(path, next);
console.log(id ? `Google Analytics measurement ID set: ${id}` : "Google Analytics measurement ID cleared");
