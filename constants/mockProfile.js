// ─── OJT Scout — Mock Student Profile ────────────────────────────
// Demo/test fixture used by POST /api/pipeline/start?mock=true.
// Lets the full pipeline UI be exercised without a PDF or an OpenAI key.
// Kept here (not inline in the route) per the constants-centralization rule.

export const MOCK_STUDENT_PROFILE = {
  id: 'mock-student-001',
  name: 'Raynard Ethan Vergara',
  course: 'BS Computer Science',
  yearLevel: '4th',
  campus: 'FEU Alabang',
  gpa: 3.2,
  skills: [
    { skill: 'Python', level: 'intermediate', evidence: 'CS50P certificate', verified: true },
    { skill: 'Java', level: 'intermediate', evidence: 'ITS certification', verified: true },
    { skill: 'C++', level: 'intermediate', evidence: 'Coursework projects', verified: true },
    { skill: 'JavaScript', level: 'beginner', evidence: 'Intro web projects', verified: true },
    { skill: 'HTML/CSS', level: 'beginner', evidence: 'Intro web projects', verified: true }
  ],
  experience: [
    {
      type: 'project',
      title: 'Console Applications',
      organization: 'Coursework',
      duration: '1 year',
      description: 'Built CLI tools and exercises in Python, Java, and C++'
    },
    {
      type: 'project',
      title: 'Personal Website',
      organization: 'Self-directed',
      duration: '3 months',
      description: 'Static site built with HTML, CSS, and JavaScript'
    }
  ],
  preferences: {
    minAllowance: 500,
    setup: 'hybrid',
    maxDistanceKm: 30,
    homeLocation: 'Laguna',
    targetIndustry: ['IT', 'Software', 'Tech'],
    learningGoal: 'Gain real software development experience',
    weights: {
      skillsMatch: 0.25,
      allowanceFit: 0.20,
      locationFit: 0.15,
      learningQuality: 0.15,
      brandValue: 0.10,
      workLifeBalance: 0.10,
      setupPreference: 0.05
    }
  },
  profileCompleteness: 'HIGH',
  missingCritical: [],
  createdAt: '2026-06-25T00:00:00.000Z'
}
