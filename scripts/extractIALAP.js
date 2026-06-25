// ─── OJT Scout — IALAP Extractor ─────────────────────────────────
// Reads a local FEU IALAP Excel (.xlsx) or CSV file and maps its
// columns into the canonical company schema, writing /data/companies.json.
//
// Usage:  node scripts/extractIALAP.js ./ialap.xlsx
//         npm run extract -- ./ialap.csv
//
// Where IALAP columns don't map to a field, fills null / [] so the top
// companies can be enriched manually afterward.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'
import { parse as parseCsv } from 'csv-parse/sync'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = path.resolve(__dirname, '../data/companies.json')

// ─── Sheet layout (fixed) ────────────────────────────────────────
// Both sheets carry a 3-row banner before real data:
//   Row 0 = title banner, Row 1 = main headers, Row 2 = sub-headers.
// Real company data starts at row index 3.
const HEADER_ROWS = 3

// Sheet 0 — GENERAL MASTERLIST column indexes.
const S0 = {
  name: 1,
  industry: 2,
  address: 3,
  poc1Name: 4,
  poc1Position: 5,
  poc1Email: 6,
  poc2Name: 7,
  poc2Position: 8,
  poc2Email: 9
}

// Sheet 1 — ACTIVE INDUSTRY PARTNERS column indexes.
// col[4] is a "generic HR email" but it's shifted +1 row in the source
// file (holds the next company's address), so it's intentionally not read.
const S1 = {
  name: 1,
  industry: 2,
  address: 3,
  pocName: 5,
  pocPosition: 6,
  pocEmail: 7
}
const S1_NAME = S1.name

// Known PH cities/provinces to pull out of a free-text address.
// Order matters — longer/more specific names first so e.g. "Quezon City"
// and "Las Pinas" win before a bare "Manila" substring.
const PH_CITIES = [
  'Quezon City', 'Las Pinas', 'San Juan', 'Makati', 'Taguig', 'Pasig',
  'Mandaluyong', 'Pasay', 'Paranaque', 'Muntinlupa', 'Alabang', 'Marikina',
  'Caloocan', 'Valenzuela', 'Pateros', 'Manila', 'Bulacan', 'Laguna',
  'Cavite', 'Rizal'
]

// Pull a recognizable city/province out of an address; default Metro Manila.
function extractCity(address) {
  if (!address) return 'Metro Manila'
  const text = String(address)
  for (const city of PH_CITIES) {
    const re = new RegExp(`\\b${city.replace(/\s+/g, '\\s+')}\\b`, 'i')
    if (re.test(text)) return city
  }
  return 'Metro Manila'
}

// Read a column from a row, trimming whitespace; null for empty/missing.
function col(row, idx) {
  const v = row?.[idx]
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

// Normalize a company name for cross-sheet matching: lowercase, strip
// punctuation, collapse whitespace. "Accenture, Inc." ≈ "accenture inc".
function normalizeName(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Read one sheet (by index) of an open workbook into rows: [headers[], ...].
function readWorkbookSheet(workbook, sheetIndex) {
  const sheetName = workbook.SheetNames[sheetIndex]
  if (!sheetName) return []
  const sheet = workbook.Sheets[sheetName]
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false })
}

// Build a Set of normalized company names from Sheet 1 (active partners).
// Real data starts after the 3-row banner; name lives in col[1].
function buildActiveNameSet(rows) {
  const set = new Set()
  rows.slice(HEADER_ROWS).forEach(row => {
    const norm = normalizeName(col(row, S1_NAME))
    if (norm) set.add(norm)
  })
  return set
}

function emptyEnriched() {
  return {
    internTasks: [],
    techStack: [],
    workCulture: null,
    reviewSummary: null,
    avgRating: null,
    topPositives: [],
    topConcerns: [],
    confidence: 'NONE'
  }
}

// Print the first `count` rows of a sheet so we can locate the real
// header row buried below the title/banner rows.
function dumpRows(label, rows, count = 10) {
  console.log(`\n─── ${label} (first ${count} rows) ───`)
  for (let i = 0; i < count; i++) {
    console.log(`Row ${i}:`, JSON.stringify(rows[i] ?? []))
  }
}

// ─── Diagnostic mode — print raw headers + row counts, no extraction ──
function inspect(inputPath) {
  const ext = path.extname(inputPath).toLowerCase()

  if (ext === '.csv') {
    const text = readFileSync(inputPath, 'utf-8')
    const rows = parseCsv(text, { skip_empty_lines: true })
    console.log('CSV row count:', Math.max(0, rows.length - 1))
    console.log('(CSV has a single sheet — no Sheet 2.)')
    dumpRows('CSV', rows, 10)
    return
  }

  const workbook = XLSX.read(readFileSync(inputPath), { type: 'buffer' })
  console.log('Sheet names:', JSON.stringify(workbook.SheetNames))

  // Sheet 0 = GENERAL MASTERLIST (full company list)
  // Sheet 1 = ACTIVE INDUSTRY PARTNERS (active companies)
  const sheet0 = readWorkbookSheet(workbook, 0)
  const sheet1 = readWorkbookSheet(workbook, 1)

  console.log('Sheet 0 row count:', Math.max(0, sheet0.length - 1))
  console.log('Sheet 1 row count:', Math.max(0, sheet1.length - 1))

  dumpRows('Sheet 0 — GENERAL MASTERLIST (full list)', sheet0, 10)
  dumpRows('Sheet 1 — ACTIVE INDUSTRY PARTNERS (active)', sheet1, 10)

  // Verify the real data starts where we expect (row index 3).
  const firstData = sheet0[HEADER_ROWS] ?? []
  console.log(`\nFirst real data row (row ${HEADER_ROWS}):`)
  console.log(`  col[1] (name):     ${JSON.stringify(firstData[S0.name] ?? null)}`)
  console.log(`  col[2] (industry): ${JSON.stringify(firstData[S0.industry] ?? null)}`)
}

function main() {
  const args = process.argv.slice(2)
  const inspectMode = args.includes('--inspect')
  const inputPath = args.find(a => !a.startsWith('--'))

  if (!inputPath) {
    console.error('Usage: node scripts/extractIALAP.js <path-to-ialap.xlsx|.csv> [--inspect]')
    process.exit(1)
  }
  if (!existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`)
    process.exit(1)
  }

  if (inspectMode) {
    inspect(inputPath)
    return
  }

  // ─── Read Sheet 0 (full list) + Sheet 1 (active companies) ─────
  const ext = path.extname(inputPath).toLowerCase()
  let rows // Sheet 0 — full company list (GENERAL MASTERLIST)
  let activeRows = [] // raw Sheet 1 rows (active partners)
  let activeNames = new Set() // normalized names from Sheet 1

  if (ext === '.csv') {
    // CSV has a single sheet — no separate active list available.
    const text = readFileSync(inputPath, 'utf-8')
    rows = parseCsv(text, { skip_empty_lines: true })
  } else {
    // Read via buffer — XLSX.readFile isn't exposed in the ESM build.
    const workbook = XLSX.read(readFileSync(inputPath), { type: 'buffer' })
    rows = readWorkbookSheet(workbook, 0) // Sheet 0: full masterlist
    activeRows = readWorkbookSheet(workbook, 1) // Sheet 1: active partners
    if (activeRows.length) {
      activeNames = buildActiveNameSet(activeRows)
    } else {
      console.warn('Sheet 1 (active partners) not found — no companies will be flagged active.')
    }
  }

  if (!rows.length) {
    console.error('No rows found in input file.')
    process.exit(1)
  }

  const companies = []
  let seq = 0 // running id counter — sequential, no gaps or collisions
  let nullCityCount = 0
  let nullSetupCount = 0

  // ─── Sheet 0 — full masterlist ──────────────────────────────────
  // Skip the 3-row banner — real company data starts at row index 3.
  let sheet0Count = 0
  const seenNames = new Set() // normalized names already in the output
  rows.slice(HEADER_ROWS).forEach(row => {
    const name = col(row, S0.name)
    if (!name) return // skip blank rows (no company name)

    const location = col(row, S0.address)
    const city = extractCity(location)
    const setup = null // unknown from IALAP

    companies.push({
      id: `company_${++seq}`,
      name,
      industry: col(row, S0.industry),
      city,
      location,
      poc1Name: col(row, S0.poc1Name),
      poc1Position: col(row, S0.poc1Position),
      poc1Email: col(row, S0.poc1Email),
      poc2Name: col(row, S0.poc2Name),
      poc2Position: col(row, S0.poc2Position),
      poc2Email: col(row, S0.poc2Email),
      setup,
      availableSlots: 5, // default — actual quota unknown
      moaStatus: 'Active', // all IALAP partners are in the MOA list
      hasActiveInterns: activeNames.has(normalizeName(name)),
      acceptedCourses: [], // empty = open to all courses
      allowance: null,
      allowanceDisplay: null,
      enriched: emptyEnriched()
    })

    seenNames.add(normalizeName(name))
    sheet0Count++
    if (!city) nullCityCount++
    if (!setup) nullSetupCount++
  })

  // ─── Sheet 1 — active partners not present in the masterlist ─────
  // These exist only in the active list, so add them as full records.
  let sheet1OnlyCount = 0
  activeRows.slice(HEADER_ROWS).forEach(row => {
    const name = col(row, S1.name)
    if (!name) return // skip blank rows
    const norm = normalizeName(name)
    if (seenNames.has(norm)) return // already added from Sheet 0

    const location = col(row, S1.address)
    const city = extractCity(location)
    const setup = null

    companies.push({
      id: `company_${++seq}`,
      name,
      industry: col(row, S1.industry),
      city,
      location,
      // Sheet 1's named POC (5/6/7) is correctly aligned. The generic HR
      // email column (col[4]) is shifted +1 row in the source file, so it
      // holds the wrong company's address — dropped rather than kept wrong.
      poc1Name: col(row, S1.pocName),
      poc1Position: col(row, S1.pocPosition),
      poc1Email: col(row, S1.pocEmail),
      poc2Name: null,
      poc2Position: null,
      poc2Email: null,
      setup,
      availableSlots: 5,
      moaStatus: 'Active',
      hasActiveInterns: true,
      acceptedCourses: [],
      allowance: null,
      allowanceDisplay: null,
      enriched: emptyEnriched()
    })

    seenNames.add(norm)
    sheet1OnlyCount++
    if (!city) nullCityCount++
    if (!setup) nullSetupCount++
  })

  const activeCount = companies.filter(c => c.hasActiveInterns).length

  writeFileSync(OUTPUT_PATH, JSON.stringify(companies, null, 2) + '\n', 'utf-8')

  console.log(`Total from Sheet 0: ${sheet0Count}`)
  console.log(`Sheet 1 only (added): ${sheet1OnlyCount}`)
  console.log(`Total in companies.json: ${companies.length}`)
  console.log(`Active intern companies: ${activeCount}`)
  console.log(`Companies with null city: ${nullCityCount}`)
  console.log(`Companies with null setup: ${nullSetupCount}`)
  console.log(`Written to: ${path.relative(process.cwd(), OUTPUT_PATH)}`)
}

main()
