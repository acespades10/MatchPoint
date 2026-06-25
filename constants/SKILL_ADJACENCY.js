// ─── OJT Scout — Skill Adjacency Map ─────────────────────────────
// Zero token cost — pure lookup table for LearnabilityScorer (Phase 5).
//
// For each skill:
//   adjacent     → closely related; a missing adjacent skill is BRIDGEABLE (low penalty)
//   transferable → some transfer of knowledge; missing = MANAGEABLE (medium penalty)
//   unrelated    → no real connection; missing = BLOCKING (high penalty)
//
// Expandable — add skills as FEU partner tech stacks demand.

export const SKILL_ADJACENCY = {
  Python: {
    adjacent: ['SQL', 'Pandas', 'NumPy', 'R', 'Jupyter', 'Django', 'Flask'],
    transferable: ['JavaScript', 'Java', 'C#'],
    unrelated: ['Photoshop', 'AutoCAD', 'Figma']
  },
  JavaScript: {
    adjacent: ['TypeScript', 'React', 'Vue', 'Node.js', 'HTML/CSS', 'Express'],
    transferable: ['Python', 'Java', 'Swift'],
    unrelated: ['SQL', 'AutoCAD']
  },
  TypeScript: {
    adjacent: ['JavaScript', 'React', 'Angular', 'Node.js', 'Next.js'],
    transferable: ['Java', 'C#'],
    unrelated: ['Photoshop', 'AutoCAD']
  },
  React: {
    adjacent: ['Vue', 'Angular', 'Next.js', 'TypeScript', 'JavaScript'],
    transferable: ['HTML/CSS', 'Svelte'],
    unrelated: ['Python', 'SQL', 'Java']
  },
  'Node.js': {
    adjacent: ['JavaScript', 'TypeScript', 'Express', 'MongoDB'],
    transferable: ['Python', 'PHP'],
    unrelated: ['AutoCAD', 'Figma']
  },
  Java: {
    adjacent: ['Kotlin', 'Spring Boot', 'C#', 'C++'],
    transferable: ['Python', 'JavaScript', 'PHP'],
    unrelated: ['CSS', 'Figma', 'AutoCAD']
  },
  'C#': {
    adjacent: ['.NET', 'Java', 'C++', 'Unity'],
    transferable: ['Python', 'JavaScript'],
    unrelated: ['Figma', 'AutoCAD']
  },
  'C++': {
    adjacent: ['C', 'C#', 'Java', 'Rust'],
    transferable: ['Python', 'JavaScript', 'Go'],
    unrelated: ['Figma', 'Photoshop', 'AutoCAD']
  },
  SQL: {
    adjacent: ['PostgreSQL', 'MySQL', 'NoSQL', 'MongoDB', 'Oracle'],
    transferable: ['Python', 'Excel', 'Tableau'],
    unrelated: ['CSS', 'Figma', 'Swift']
  },
  'HTML/CSS': {
    adjacent: ['JavaScript', 'Tailwind CSS', 'Bootstrap', 'Sass'],
    transferable: ['Figma', 'React'],
    unrelated: ['Python', 'Java', 'SQL']
  },
  Figma: {
    adjacent: ['Adobe XD', 'Sketch', 'UI/UX Design'],
    transferable: ['Photoshop', 'Illustrator', 'HTML/CSS'],
    unrelated: ['Python', 'Java', 'SQL']
  },
  Git: {
    adjacent: ['GitHub', 'GitLab', 'CI/CD', 'Docker'],
    transferable: ['Linux', 'Bash'],
    unrelated: ['Figma', 'Photoshop']
  },
  Docker: {
    adjacent: ['Kubernetes', 'CI/CD', 'Linux', 'AWS'],
    transferable: ['Git', 'Bash'],
    unrelated: ['Figma', 'Photoshop']
  }
}
