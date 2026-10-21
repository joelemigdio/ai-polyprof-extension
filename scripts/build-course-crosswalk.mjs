/**
 * Regenerates src/data/course-crosswalk.json from the live Cal Poly catalog.
 *
 * Cal Poly renumbered every course for the Fall 2026 semester conversion and did
 * not publish a crosswalk file. The semester catalog does, however, annotate each
 * course with its quarter predecessor ("Formerly CPE/CSC 202." / "Replaced
 * CPE/CSC 357."), so the catalog itself is the authoritative mapping.
 *
 * Numeric heuristics do not work here: the conversion included merges and splits,
 * so CSC 349 became CSC 3449 and CSC 357 became CSC 2050. KNOWN_PAIRS below is
 * asserted on every run to catch a catalog markup change that silently breaks
 * parsing.
 *
 * Usage: node scripts/build-course-crosswalk.mjs [dept ...]
 */
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const CATALOG_INDEX = "https://catalog.calpoly.edu/courses/";
const OUTPUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "course-crosswalk.json");

/**
 * Live courses the catalog does not annotate with "Formerly"/"Replaced", where an
 * equivalence is still stated outright in a prerequisite line. Each entry quotes
 * the catalog text it came from. Keep this list evidence-backed: prerequisite
 * "or" lists usually enumerate genuine alternatives, not equivalences, so these
 * are read individually rather than derived in bulk.
 */
const OVERRIDES = {
  // "Prerequisite: CSC 307 or CSC 308 or CSC 3100" — CSC 308 maps to CSC 3100
  // authoritatively via Formerly, and 307 is grouped with it as satisfying the same slot.
  "CSC 307": "CSC 3100",
  // "Prerequisite: ... CSC 248, MATH 248, or MATH 2031"
  "CSC 248": "MATH 2031",
};

/** Hand-verified against the catalog; a parser regression trips these. */
const KNOWN_PAIRS = {
  "CSC 349": "CSC 3449",
  "CSC 480": "CSC 4880",
  "CSC 357": "CSC 2050",
  "CSC 308": "CSC 3100",
  "CSC 202": "CSC 2001",
  "CSC 430": "CSC 3300",
  "CSC 471": "CSC 4710",
};

async function fetchText(url, attempts = 3) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      return await response.text();
    } catch (error) {
      if (attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
}

async function discoverDepartments() {
  const html = await fetchText(CATALOG_INDEX);
  return [...new Set([...html.matchAll(/href="\/courses\/([a-z]{1,6})\/"/g)].map((m) => m[1]))].sort();
}

function toLines(html) {
  const text = html.replace(/<[^>]+>/g, "\n").replace(/&#160;|&nbsp;/g, " ").replace(/&amp;/g, "&");
  return text.split("\n").map((line) => line.trim()).filter(Boolean);
}

/**
 * Expands a predecessor reference into individual course codes. Cross-listed
 * courses appear as a shared prefix ("CPE/CSC 202" means both CPE 202 and
 * CSC 202) and merges list several numbers against one prefix ("MATH 141, 142").
 */
function expandPredecessors(reference) {
  const prefixes = reference.match(/^[A-Z]{2,5}(?:\/[A-Z]{2,5})*/)?.[0].split("/") ?? [];
  if (prefixes.length === 0) return [];
  const codes = [];
  let current = prefixes;
  for (const token of reference.split(/\s*(?:,|and|or)\s*/)) {
    const withPrefix = token.match(/^([A-Z]{2,5}(?:\/[A-Z]{2,5})*)\s*(\d{3}[A-Z]?)$/);
    const bareNumber = token.match(/^(\d{3}[A-Z]?)$/);
    if (withPrefix) {
      current = withPrefix[1].split("/");
      codes.push(...current.map((dept) => `${dept} ${withPrefix[2]}`));
    } else if (bareNumber) {
      codes.push(...current.map((dept) => `${dept} ${bareNumber[1]}`));
    }
  }
  return codes;
}

/** Splits a department page into one entry per course, with its full text. */
function parseAllCourses(dept, html) {
  const lines = toLines(html);
  const headerPattern = new RegExp(`^${dept.toUpperCase()} \\d{4}[A-Z]?$`);
  // A header is a bare course code whose units field sits two lines below it.
  const headers = lines
    .map((line, index) => (headerPattern.test(line) && lines[index + 2]?.startsWith("(") ? index : -1))
    .filter((index) => index >= 0);

  return headers.map((start, position) => ({
    newCode: lines[start],
    title: lines[start + 1],
    segment: lines.slice(start, headers[position + 1] ?? lines.length).join(" ").replace(/\s+/g, " "),
  }));
}

function parseDepartment(dept, html) {
  const entries = [];
  for (const { newCode, title, segment } of parseAllCourses(dept, html)) {
    for (const keyword of ["Formerly", "Replaced"]) {
      const match = segment.match(
        new RegExp(`${keyword} ((?:[A-Z]{2,5}(?:/[A-Z]{2,5})*\\s?\\d{3}[A-Z]?)(?:\\s*(?:,|and|or)\\s*(?:[A-Z]{2,5}(?:/[A-Z]{2,5})*\\s?)?\\d{3}[A-Z]?)*)`),
      );
      if (!match) continue;
      for (const oldCode of expandPredecessors(match[1].trim())) {
        entries.push({ oldCode, newCode, title, keyword });
      }
    }
  }
  return entries;
}

async function main() {
  const requested = process.argv.slice(2).map((d) => d.toLowerCase());
  const departments = requested.length > 0 ? requested : await discoverDepartments();
  console.log(`Scraping ${departments.length} department(s) from the semester catalog`);

  const map = {};
  const titles = {};
  const conflicts = [];
  let scraped = 0;

  for (const dept of departments) {
    let html;
    try {
      html = await fetchText(`https://catalog.calpoly.edu/courses/${dept}/`);
    } catch (error) {
      console.warn(`  skip ${dept}: ${error.message}`);
      continue;
    }
    scraped += 1;
    for (const { newCode, title } of parseAllCourses(dept, html)) titles[newCode] = title;
    for (const { oldCode, newCode } of parseDepartment(dept, html)) {
      // A quarter course can legitimately resolve to several semester courses
      // when it was split; keep every target rather than letting the last win.
      if (map[oldCode] && !map[oldCode].includes(newCode)) {
        map[oldCode].push(newCode);
        conflicts.push(`${oldCode} -> ${map[oldCode].join(" + ")}`);
      } else if (!map[oldCode]) {
        map[oldCode] = [newCode];
      }
    }
  }

  for (const [oldCode, newCode] of Object.entries(OVERRIDES)) {
    if (map[oldCode]?.includes(newCode)) continue;
    map[oldCode] = [...(map[oldCode] ?? []), newCode];
  }

  const missing = Object.entries(KNOWN_PAIRS).filter(([oldCode, newCode]) => !map[oldCode]?.includes(newCode));
  if (missing.length > 0) {
    console.error("Verification failed. The catalog markup or wording likely changed:");
    for (const [oldCode, expected] of missing) {
      console.error(`  ${oldCode} should map to ${expected} but got ${map[oldCode]?.join(", ") ?? "nothing"}`);
    }
    process.exit(1);
  }

  await mkdir(dirname(OUTPUT), { recursive: true });
  // Written compact: this file is generated and ships inside the content script.
  await writeFile(
    OUTPUT,
    `${JSON.stringify(
      {
        source: "https://catalog.calpoly.edu/courses/",
        note: "Quarter course code -> semester course code(s), parsed from 'Formerly'/'Replaced' catalog notes.",
        departmentsScraped: scraped,
        entryCount: Object.keys(map).length,
        map: Object.fromEntries(Object.keys(map).sort().map((key) => [key, map[key]])),
        titles: Object.fromEntries(Object.keys(titles).sort().map((key) => [key, titles[key]])),
      },
    )}\n`,
  );

  console.log(`Wrote ${Object.keys(map).length} mappings from ${scraped} departments to ${OUTPUT}`);
  console.log(`Verified ${Object.keys(KNOWN_PAIRS).length} known pairs; applied ${Object.keys(OVERRIDES).length} cited overrides`);
  if (conflicts.length > 0) console.log(`${conflicts.length} split course(s), e.g. ${conflicts.slice(0, 3).join("; ")}`);
}

await main();
