// Preserve the workbook's contact records without guessing missing details.
export function companyContacts(company) {
  const text = value => typeof value === 'string' && value.trim() ? value.trim() : null
  return [1, 2].map(index => {
    const rawName = text(company[`poc${index}Name`])
    // Some source rows put a telephone number in the name column.
    const isPhone = rawName && /^[+\d\s().-]+$/.test(rawName) && rawName.replace(/\D/g, '').length >= 7
    return {
      name: isPhone ? null : rawName,
      position: text(company[`poc${index}Position`]),
      email: text(company[`poc${index}Email`]),
      phone: isPhone ? rawName : null
    }
  }).filter(contact => Object.values(contact).some(Boolean))
}
