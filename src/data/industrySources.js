// Match the two sheets used by the company importer, preserving sheet/row
// provenance. No enrichment, contacts, or original industry labels are replaced.
export function normalizeCompanyName(name) {
  return String(name ?? '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function collectIndustrySources(sheets) {
  const sources = new Map()
  for (const { name, rows } of sheets) {
    rows.slice(3).forEach((row, offset) => {
      const company = normalizeCompanyName(row[1])
      const industry = String(row[2] ?? '').trim()
      if (!company || !industry) return
      const entries = sources.get(company) ?? []
      entries.push({ sheet: name, row: offset + 4, industry })
      sources.set(company, entries)
    })
  }
  return sources
}

export function attachIndustrySources(companies, sources) {
  for (const company of companies) {
    const entries = sources.get(normalizeCompanyName(company.name))
    if (entries?.length) company.industrySources = entries
  }
  return companies
}
