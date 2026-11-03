// Deterministic industry screening: industry fit is not proof of a vacancy.
export const COURSE_RELEVANCE_PROFILES = {
  'cs-it': {
    label: 'Software & IT',
    course: /\b(computer science|computer engineering|information technology|information systems|software engineering|bsit|bscs|bsis|it|cs)\b/i,
    direct: /\b(software|computer|information technology|information systems|it|infotech|cyber\w*|telecom\w*|fintech|saas|programming|web development|app development|data analytics|data science|e-?commerce|games?|gaming)\b/i,
    adjacent: /\b(banks?|banking|financial|finance|bpo|business process|outsourcing|digital media)\b/i,
    stretch: /\b(manufactur\w*|retail|electronics?|electrical|industrial)\b/i,
    signals: ['javascript', 'typescript', 'python', 'java', 'sql', 'html', 'css', 'react', 'software development', 'web development', 'programming', 'cybersecurity', 'network administration']
  },
  business: {
    label: 'Business & finance',
    course: /\b(accountancy|accounting|business administration|business management|financial management|finance|economics|bsba|bsa)\b/i,
    direct: /\b(account\w*|audit\w*|banks?|banking|financial|finance|insurance|business services|management consult\w*)\b/i,
    adjacent: /\b(retail|trading|bpo|business process|outsourcing|logistics)\b/i,
    signals: ['accounting', 'bookkeeping', 'auditing', 'financial analysis', 'financial reporting', 'taxation', 'payroll', 'business administration']
  },
  marketing: {
    label: 'Marketing, design & media',
    course: /\b(marketing|communication|communications|multimedia|fine arts|advertising|journalism|graphic design)\b/i,
    direct: /\b(marketing|advertising|media|publishing|design|animation|creative|entertainment|broadcast\w*)\b/i,
    adjacent: /\b(retail|e-?commerce|public relations)\b/i,
    signals: ['digital marketing', 'seo', 'copywriting', 'graphic design', 'video editing', 'illustration', 'social media', 'animation', 'journalism']
  },
  civil: {
    label: 'Civil engineering & construction',
    course: /\b(civil engineering|architecture|construction management|bsce)\b/i,
    direct: /\b(construction|civil engineering|architecture|architectural|building materials|infrastructure)\b/i,
    adjacent: /\b(real estate|property development|engineering consult\w*)\b/i,
    signals: ['structural analysis', 'structural design', 'quantity surveying', 'construction management', 'civil engineering', 'revit', 'bim', 'surveying']
  },
  electrical: {
    label: 'Electrical & electronics engineering',
    course: /\b(electrical engineering|electronics engineering|electronics and communications|bsee|bsece)\b/i,
    direct: /\b(electrical|electronics?|semiconductor\w*|power|energy|telecom\w*)\b/i,
    adjacent: /\b(manufactur\w*|engineering consult\w*|automation)\b/i,
    signals: ['circuit design', 'pcb', 'embedded systems', 'power systems', 'electronics', 'electrical engineering', 'microcontrollers', 'signal processing']
  },
  mechanical: {
    label: 'Mechanical & industrial engineering',
    course: /\b(mechanical engineering|industrial engineering|mechatronics|bsme|bsie)\b/i,
    direct: /\b(manufactur\w*|mechanical|industrial|automotive|automobile|machinery|automation)\b/i,
    adjacent: /\b(logistics|energy|engineering consult\w*)\b/i,
    signals: ['solidworks', 'thermodynamics', 'mechanical design', 'lean manufacturing', 'six sigma', 'process optimization', 'mechatronics', 'hvac']
  },
  hospitality: {
    label: 'Hospitality & tourism',
    course: /\b(hospitality|tourism|hotel management|culinary)\b/i,
    direct: /\b(hotel\w*|hospitality|tourism|travel|restaurant\w*|food service|resort\w*)\b/i,
    adjacent: /\b(events?|airline\w*)\b/i,
    signals: ['food preparation', 'culinary', 'front office', 'housekeeping', 'hotel operations', 'tour guiding', 'food safety']
  },
  education: {
    label: 'Education',
    course: /\b(education|teaching|bsed|beed)\b/i,
    direct: /\b(education\w*|school\w*|university|college\w*|training|learning)\b/i,
    adjacent: /\b(publishing|childcare)\b/i,
    signals: ['lesson planning', 'classroom management', 'curriculum development', 'teaching', 'tutoring', 'student assessment']
  },
  healthcare: {
    label: 'Healthcare',
    course: /\b(nursing|medicine|medical technology|pharmacy|physical therapy|occupational therapy|public health|bsn)\b/i,
    direct: /\b(health\w*|medical|hospital\w*|clinic\w*|pharma\w*|physical therapy|rehabilitation)\b/i,
    adjacent: /\b(laborator\w*|wellness)\b/i,
    signals: ['patient care', 'nursing', 'pharmacology', 'clinical assessment', 'phlebotomy', 'physical therapy', 'medical laboratory']
  }
}

export const RELEVANT_TIERS = ['direct', 'adjacent']
export const INDUSTRY_TIER_RANK = { direct: 0, adjacent: 1, stretch: 2, irrelevant: 3, unknown: 4 }

export function resolveProfileKey(course = '') {
  return Object.entries(COURSE_RELEVANCE_PROFILES).find(([, p]) => p.course.test(String(course)))?.[0] ?? null
}

export function classifyIndustry(industry, course = '') {
  return classifyForKey(industry, resolveProfileKey(course))
}

function classifyForKey(industry, key) {
  const profile = COURSE_RELEVANCE_PROFILES[key]
  if (!profile || !String(industry ?? '').trim()) return 'unknown'
  for (const tier of ['direct', 'adjacent', 'stretch']) {
    if (profile[tier]?.test(String(industry))) return tier
  }
  return 'irrelevant'
}

// Use actual skills and role descriptions, never employer names, preferences,
// or low-confidence company enrichment to infer the student's field.
export function resumeFields(student = {}) {
  const courseKey = resolveProfileKey(student.course)
  const text = [
    ...(student.skills ?? []).map(s => typeof s === 'string' ? s : s?.skill),
    ...(student.experience ?? []).flatMap(e => typeof e === 'string' ? [e] : [e?.title, e?.role, e?.description, ...(Array.isArray(e?.responsibilities) ? e.responsibilities : [])])
  ].filter(v => typeof v === 'string').join(' ').toLowerCase()
  return Object.entries(COURSE_RELEVANCE_PROFILES).flatMap(([key, p]) => {
    const evidence = p.signals.filter(signal => new RegExp(`\\b${signal}\\b`, 'i').test(text))
    const fromCourse = key === courseKey
    if (!fromCourse && evidence.length < 2) return []
    return [{ key, label: p.label, source: fromCourse ? 'course' : 'skills and experience', evidence: [...(fromCourse ? [String(student.course)] : []), ...evidence] }]
  })
}

export function assessIndustryFit(student, company, fields = resumeFields(student)) {
  const labels = [...new Set([company.industry, ...(company.industrySources ?? []).map(s => s.industry)].filter(v => typeof v === 'string' && v.trim()))]
  const base = { fields: fields.map(f => f.label), evidence: fields.flatMap(f => f.evidence), industryLabels: labels }
  if (!fields.length) return { ...base, tier: 'unknown', reason: 'The résumé does not identify a supported field. Add a course or more specific skills and experience.' }
  if (!labels.length) return { ...base, tier: 'unknown', reason: 'The company has no listed industry; verify its industry before applying.' }
  const classifications = labels.map(label => fields.map(field => ({ ...field, tier: classifyForKey(label, field.key) })).sort((a, b) => INDUSTRY_TIER_RANK[a.tier] - INDUSTRY_TIER_RANK[b.tier])[0])
  const relevant = classifications.filter(c => RELEVANT_TIERS.includes(c.tier))
  if (relevant.length && relevant.length !== classifications.length) {
    return { ...base, tier: 'unknown', conflict: true, reason: 'Source sheets disagree on industry suitability. Verify the company industry and internship role.' }
  }
  // When sources differ in closeness, use the more conservative assessment.
  const match = classifications.sort((a, b) => INDUSTRY_TIER_RANK[b.tier] - INDUSTRY_TIER_RANK[a.tier])[0]
  const reason = match.tier === 'direct'
    ? `Listed industry aligns with ${match.label}, supported by your ${match.source}.`
    : match.tier === 'adjacent'
      ? `Related industry for ${match.label}, supported by your ${match.source}. Confirm that the internship duties use these skills.`
      : `Listed industry does not directly align with the résumé's identified fields.`
  return { ...base, tier: match.tier, matchedField: match.label, evidence: match.evidence, reason }
}
