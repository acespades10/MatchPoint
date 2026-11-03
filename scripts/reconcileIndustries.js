// Narrow migration: keep all existing data and append source industry labels.
// Usage: node scripts/reconcileIndustries.js <source.xlsx>
import { readFileSync, writeFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { collectIndustrySources, attachIndustrySources } from '../src/data/industrySources.js'

const input = process.argv[2]
if (!input) throw new Error('Provide the original partner workbook path.')
const workbook = XLSX.read(readFileSync(input), { type: 'buffer' })
const sheets = workbook.SheetNames.slice(0, 2).map(name => ({
  name, rows: XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: null, raw: false })
}))
const target = new URL('../data/companies.json', import.meta.url)
const companies = JSON.parse(readFileSync(target, 'utf8'))
attachIndustrySources(companies, collectIndustrySources(sheets))
writeFileSync(target, JSON.stringify(companies, null, 2) + '\n')
console.log(`Retained ${companies.length} records; attached industry sources to ${companies.filter(c => c.industrySources?.length).length}.`)
