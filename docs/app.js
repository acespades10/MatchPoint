// Fictional, browser-only teaching model. This does not call the matching API.
const companies = [
  { name: 'Cedar Software', industry: 'Software development', city: 'Muntinlupa', setup: 'onsite', allowance: 300, active: true, skills: 90, learnability: 85, tier: 'direct' },
  { name: 'Northstar Digital', industry: 'IT services', city: 'Makati', setup: 'remote', allowance: 500, active: true, skills: 80, learnability: 80, tier: 'direct' },
  { name: 'Mosaic Systems', industry: 'Software development', city: 'Taguig', setup: 'hybrid', allowance: null, active: true, skills: 85, learnability: 90, tier: 'direct' },
  { name: 'Fieldwork Analytics', industry: 'Business analytics', city: 'Makati', setup: 'hybrid', allowance: 400, active: false, skills: 75, learnability: 80, tier: 'adjacent' },
];
const stages = ['Your résumé is a starting point.', 'A smaller list. A stronger direction.', 'A good match works both ways.', 'Your priorities. Your possibilities.'];
const hints = ['Start with a sample, see the possibilities.', 'Relevant companies move to the shortlist.', 'See the signals behind each score.', 'Changes stay in this browser. No AI calls.'];
const nextLabels = ['Build the profile →', 'See the shortlist →', 'Adjust preferences →', 'Back to the beginning ↺'];
let currentStep = 0;
let preferences = { setup: 'any', city: 'Muntinlupa', allowance: 0, activeOnly: false };
const content = document.querySelector('#demo-content');

function scoreCompany(company) {
  const setup = preferences.setup === 'any' || preferences.setup === company.setup ? 100 : company.setup === 'hybrid' ? 75 : 25;
  const location = company.setup === 'remote' || company.city === preferences.city ? 100 : 70;
  const allowance = company.allowance === null ? 50 : preferences.allowance === 0 ? 75 : Math.min(100, Math.round(company.allowance / preferences.allowance * 100));
  const student = company.skills * .30 + allowance * .25 + location * .25 + setup * .20;
  const companySide = company.learnability * .60 + (company.active ? 100 : 50) * .40;
  return { ...company, student, companySide, total: Math.round(student * .60 + companySide * .40) };
}

function rankedCompanies() {
  return companies.filter(company => !preferences.activeOnly || company.active).map(scoreCompany).sort((a, b) =>
    Number(a.tier === 'adjacent') - Number(b.tier === 'adjacent') || Number(b.active) - Number(a.active) || b.total - a.total
  );
}

function rankingMarkup(showBreakdown = true) {
  return rankedCompanies().map((company, index) => `<article class="ranking-card">
    <span class="rank">${index + 1}</span>
    <div><h4 class="company-name">${company.name}</h4><p class="company-meta">${company.city} · ${company.setup} · ${company.allowance === null ? 'Allowance unknown' : `₱${company.allowance}/day`}<br>${company.tier === 'direct' ? 'Direct industry fit' : 'Adjacent industry fit'}${company.active ? ' · Active partner' : ''}</p></div>
    <div class="score">${company.total}<span>Fit / 100</span></div>
    ${showBreakdown ? `<div class="score-breakdown"><div><div class="bar-label"><span>Student fit · 60%</span><span>${Math.round(company.student)}</span></div><div class="bar-track"><div class="bar-fill" style="width:${company.student}%"></div></div></div><div><div class="bar-label"><span>Company-side · 40%</span><span>${Math.round(company.companySide)}</span></div><div class="bar-track"><div class="bar-fill gold" style="width:${company.companySide}%"></div></div></div></div>` : ''}
  </article>`).join('');
}

function profileMarkup() {
  return `<h3 class="demo-title">${stages[0]}</h3><p class="demo-intro">Meet Jamie, a fictional fourth-year computer science student. In the real app, a PDF résumé becomes a structured profile. Here, we’ve prepared one for you.</p>
  <div class="profile-grid"><div class="resume-sheet"><span class="mini-label">SAMPLE RÉSUMÉ / A QUICK LOOK</span><div class="resume-person"><span class="avatar">JD</span><div><h4>Jamie Dela Cruz</h4><p>BS Computer Science · 4th year</p></div></div><div class="resume-rule"></div><h5>EXPERIENCE</h5><p>Built a student task planner with JavaScript and SQL. Collaborated on a campus web project.</p><h5>LOOKING FOR</h5><p>An OJT opportunity to build practical software skills and learn from a team.</p><h5>BASED IN</h5><p>Muntinlupa, Metro Manila</p></div><div class="profile-insights"><h4>The signals that matter</h4><div class="skill-tags"><span>JavaScript</span><span>SQL</span><span>Git</span><span>Web development</span></div><div class="insight-row"><span>Relevant field</span><strong>Software & IT</strong></div><div class="insight-row"><span>Work setup</span><strong>Open to any</strong></div><div class="insight-row"><span>Allowance floor</span><strong>Not set</strong></div><p class="small-note">In the actual app, skills without résumé evidence default to beginner. You can inspect the parsed profile before interpreting your matches.</p></div></div>`;
}

function screeningMarkup() {
  return `<h3 class="demo-title">${stages[1]}</h3><p class="demo-intro">First, check the practical requirements. Then, keep companies with supported industry relevance. This fictional six-company example shows why a match stays or goes.</p>
  <div class="funnel"><div><strong>6</strong><span>Sample companies</span></div><div><strong>5</strong><span>Pass eligibility</span></div><div><strong>4</strong><span>Relevant matches</span></div></div>
  <div class="filter-list"><div class="filter-row"><div><strong>Cedar · Northstar · Mosaic</strong><span>Eligible, with a direct software / IT fit</span></div><span class="status-tag">3 kept</span></div><div class="filter-row"><div><strong>Fieldwork Analytics</strong><span>Eligible, with an adjacent industry fit</span></div><span class="status-tag">1 kept</span></div><div class="filter-row"><div><strong>Harbor Hospitality</strong><span>No supported industry fit for this profile</span></div><span class="status-tag excluded">Not relevant</span></div><div class="filter-row"><div><strong>Willow Studio</strong><span>No available internship slots</span></div><span class="status-tag excluded">Ineligible</span></div></div>
  <p class="small-note">The actual app checks year level, MOA status, slots, course, allowance, and setup. Missing values follow field-specific rules; unknown industry classifications are flagged for verification.</p>`;
}

function shortlistMarkup() {
  return `<h3 class="demo-title">${stages[2]}</h3><p class="demo-intro">Student fit considers skills, allowance, location, and setup. Company-side fit uses learnability and active-intern signals. Together, they help explain the shortlist.</p><div class="ranking-list">${rankingMarkup()}</div><p class="ranking-note">60% student fit + 40% company-side fit. Sample scores, not hiring probabilities. Direct industries and active partners take priority in the ordering.</p>`;
}

function preferencesMarkup() {
  return `<h3 class="demo-title">${stages[3]}</h3><p class="demo-intro">Try a remote setup or a higher allowance target. Watch the same relevant pool re-rank. In the actual app, this refinement also needs no new AI call.</p>
  <div class="preference-controls"><label for="demo-setup">Work setup<select id="demo-setup"><option value="any">Any setup</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">Onsite</option></select></label><label for="demo-city">Home city<select id="demo-city"><option>Muntinlupa</option><option>Makati</option><option>Taguig</option></select></label><label for="demo-allowance" class="allowance-control">Allowance target <output id="allowance-value" for="demo-allowance">₱0/day</output><input id="demo-allowance" type="range" min="0" max="800" step="50" value="0"></label><label class="active-checkbox" for="demo-active"><input type="checkbox" id="demo-active">Active partners only</label></div>
  <div id="live-ranking" class="ranking-list" aria-live="polite" aria-atomic="true">${rankingMarkup(false)}</div><p class="ranking-note">This changes the order of the existing pool; it doesn’t repeat initial eligibility screening. Unknown allowance stays neutral. The sample skills and learnability values are illustrative.</p>`;
}

function bindPreferences() {
  const setup = document.querySelector('#demo-setup');
  const city = document.querySelector('#demo-city');
  const allowance = document.querySelector('#demo-allowance');
  const active = document.querySelector('#demo-active');
  setup.value = preferences.setup;
  city.value = preferences.city;
  allowance.value = preferences.allowance;
  active.checked = preferences.activeOnly;
  document.querySelector('#allowance-value').textContent = `₱${preferences.allowance}/day`;
  allowance.setAttribute('aria-valuetext', `${preferences.allowance} pesos per day`);
  function update() {
    preferences = { setup: setup.value, city: city.value, allowance: Number(allowance.value), activeOnly: active.checked };
    document.querySelector('#allowance-value').textContent = `₱${preferences.allowance}/day`;
    allowance.setAttribute('aria-valuetext', `${preferences.allowance} pesos per day`);
    document.querySelector('#live-ranking').innerHTML = rankingMarkup(false);
  }
  [setup, city, active].forEach(control => control.addEventListener('change', update));
  allowance.addEventListener('input', update);
}

function renderStep() {
  document.querySelectorAll('[data-step]').forEach(button => {
    const active = Number(button.dataset.step) === currentStep;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  document.querySelector('#step-counter').textContent = `0${currentStep + 1} / 04`;
  document.querySelector('#step-hint').textContent = hints[currentStep];
  document.querySelector('#previous-step').disabled = currentStep === 0;
  document.querySelector('#next-step').textContent = nextLabels[currentStep];
  content.innerHTML = [profileMarkup, screeningMarkup, shortlistMarkup, preferencesMarkup][currentStep]();
  if (currentStep === 3) bindPreferences();
}

function changeStep(step, moveFocus = false) {
  currentStep = step;
  renderStep();
  if (moveFocus) {
    const heading = content.querySelector('h3');
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: 'nearest' });
  }
}

function resetDemo(moveFocus = false) {
  preferences = { setup: 'any', city: 'Muntinlupa', allowance: 0, activeOnly: false };
  changeStep(0, moveFocus);
}

document.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => changeStep(Number(button.dataset.step))));
document.querySelector('#next-step').addEventListener('click', () => currentStep === 3 ? resetDemo(true) : changeStep(currentStep + 1, true));
document.querySelector('#previous-step').addEventListener('click', () => changeStep(Math.max(0, currentStep - 1), true));
document.querySelector('#reset-demo').addEventListener('click', () => resetDemo(true));
renderStep();
