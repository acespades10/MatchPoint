import { PROVIDERS, inferProvider, normalizeConnection } from './ai-providers.js'

      const form = document.getElementById('uploadForm')
      const fileInput = document.getElementById('resumeInput')
      const submitBtn = document.getElementById('submitBtn')
      const demoBtn = document.getElementById('demoBtn')
      const spinner = document.getElementById('spinner')
      const errorBox = document.getElementById('error')
      const profileCard = document.getElementById('profileCard')
      const preScreenCard = document.getElementById('preScreenCard')
      const resultsCard = document.getElementById('resultsCard')
      const statsBar = document.getElementById('statsBar')
      const connectionUrl = document.getElementById('connectionUrl')
      const connectionKey = document.getElementById('connectionKey')
      const connectionStatus = document.getElementById('connectionStatus')
      const toggleKey = document.getElementById('toggleKey')
      const saveConnection = document.getElementById('saveConnection')
      const clearConnection = document.getElementById('clearConnection')
      const connectionStorageStatus = document.getElementById('connectionStorageStatus')
      const CONNECTION_STORAGE_KEY = 'matchpoint.connection.v1'
      const connectionProvider = document.getElementById('connectionProvider')
      const connectionApiType = document.getElementById('connectionApiType')
      const connectionModel = document.getElementById('connectionModel')
      for (const [id, preset] of Object.entries(PROVIDERS)) {
        connectionProvider.add(new Option(preset.label, id))
      }
      function applyProvider(provider) {
        const preset = PROVIDERS[provider]
        connectionProvider.value = provider
        connectionUrl.value = preset.url
        connectionApiType.value = preset.apiType
        connectionApiType.disabled = provider !== 'custom'
        connectionModel.value = ''
        connectionModel.placeholder = preset.placeholder
      }
      applyProvider('openai')
      connectionProvider.addEventListener('change', () => {
        applyProvider(connectionProvider.value)
        connectionKey.value = ''
        maskConnectionKey()
        connectionStorageStatus.textContent = 'Provider changed · enter its key and model, then Save to replace the saved connection.'
        connectionStatus.textContent = 'Enter the API key and model for this provider.'
      })
      const dropZone = document.getElementById('dropZone')
      const emptyState = document.getElementById('emptyState')
      const modeNotice = document.getElementById('modeNotice')
      const graphCompany = document.getElementById('graphCompany')
      let graphScores = []
      graphCompany.addEventListener('change', renderBilateralGraph)
      let selectedFile = null

      function selectResume(file) {
        clearError()
        if (!file) return
        selectedFile = null
        document.getElementById('dropTitle').textContent = 'Drop your résumé here'
        document.getElementById('fileName').textContent = 'Tell us what you bring to the table.'
        if (!file.name.toLowerCase().endsWith('.pdf') || (file.type && file.type !== 'application/pdf')) {
          fileInput.value = ''
          return showError('Please choose a PDF résumé.')
        }
        if (file.size > 10 * 1024 * 1024) {
          fileInput.value = ''
          return showError('Your résumé is larger than 10 MB. Please choose a smaller PDF.')
        }
        selectedFile = file
        document.getElementById('dropTitle').textContent = 'Ready when you are.'
        document.getElementById('fileName').textContent = file.name
        if (!connectionKey.value.trim()) document.getElementById('connectionPanel').open = true
      }
      fileInput.addEventListener('change', () => selectResume(fileInput.files[0]))
      dropZone.addEventListener('dragover', e => {
        e.preventDefault()
        if (!fileInput.disabled) dropZone.classList.add('dragging')
      })
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'))
      dropZone.addEventListener('drop', e => {
        e.preventDefault()
        dropZone.classList.remove('dragging')
        if (fileInput.disabled) return
        if (e.dataTransfer.files.length !== 1) return showError('Drop one PDF résumé at a time.')
        selectResume(e.dataTransfer.files[0])
      })
      // Submission uses the same selected File for both browsing and dropping.
      form.noValidate = true

      function readConnection() {
        return normalizeConnection({
          provider: connectionProvider.value, apiType: connectionApiType.value,
          url: connectionUrl.value, apiKey: connectionKey.value, model: connectionModel.value
        })
      }
      for (const input of [connectionUrl, connectionKey, connectionModel, connectionApiType]) {
        input.addEventListener('input', () => {
          connectionStorageStatus.textContent = 'Unsaved changes · select Save to keep this connection.'
          try {
            readConnection()
            connectionStatus.textContent = 'Ready to use · connection not yet verified'
          } catch (err) {
            connectionStatus.textContent = err.message
          }
        })
      }
      toggleKey.addEventListener('click', () => {
        const show = connectionKey.type === 'password'
        connectionKey.type = show ? 'text' : 'password'
        toggleKey.setAttribute('aria-label', show ? 'Hide API key' : 'Show API key')
        toggleKey.setAttribute('aria-pressed', String(show))
      })

      function maskConnectionKey() {
        connectionKey.type = 'password'
        toggleKey.setAttribute('aria-label', 'Show API key')
        toggleKey.setAttribute('aria-pressed', 'false')
      }

      saveConnection.addEventListener('click', () => {
        let connection
        try {
          connection = readConnection()
        } catch (err) {
          connectionStorageStatus.textContent = err.message
          return
        }
        try {
          localStorage.setItem(CONNECTION_STORAGE_KEY, JSON.stringify(connection))
          maskConnectionKey()
          connectionStorageStatus.textContent = 'Saved in this browser · available after refresh.'
        } catch {
          connectionStorageStatus.textContent = 'Could not save. Browser storage may be unavailable; you can still use this connection for this visit.'
        }
      })

      clearConnection.addEventListener('click', () => {
        connectionKey.value = ''
        applyProvider('openai')
        maskConnectionKey()
        connectionStatus.textContent = 'Enter your API key to get started.'
        clearError()
        try {
          localStorage.removeItem(CONNECTION_STORAGE_KEY)
          connectionStorageStatus.textContent = 'Saved connection cleared from this browser.'
        } catch {
          connectionStorageStatus.textContent = 'Field cleared, but the saved connection could not be removed. Enable browser storage and try Clear again.'
        }
      })

      // Only this explicit Save action persists credentials; never store résumés.
      try {
        const saved = localStorage.getItem(CONNECTION_STORAGE_KEY)
        if (saved) {
          const connection = JSON.parse(saved)
          if (typeof connection?.url !== 'string' || typeof connection?.apiKey !== 'string') throw new Error()
          const provider = connection.provider || inferProvider(connection.url)
          if (!Object.hasOwn(PROVIDERS, provider)) throw new Error()
          applyProvider(provider)
          connectionUrl.value = connection.url
          connectionKey.value = connection.apiKey
          connectionApiType.value = connection.apiType || PROVIDERS[provider].apiType
          connectionModel.value = connection.model || (provider === 'codex' ? 'gpt-6.1-sol' : '')
          // Older non-Codex saves had no model; preserve the key and ask for one.
          if (!connectionModel.value) {
            connectionStorageStatus.textContent = 'Saved connection loaded · add your provider’s model ID and Save.'
          } else {
            readConnection()
          }
          maskConnectionKey()
          if (connectionModel.value) connectionStorageStatus.textContent = 'Saved connection loaded from this browser.'
          connectionStatus.textContent = connectionModel.value ? 'Ready to use · connection not yet verified' : 'Enter your provider’s model ID to continue.'
        }
      } catch {
        connectionKey.value = ''
        applyProvider('openai')
        connectionStorageStatus.textContent = 'Saved connection could not be loaded. Enter your URL and key, then select Save.'
      }

      // Phase 3/4 state — the active run id, used for zero-token re-ranks.
      let currentSessionId = null
      let citiesLoaded = false
      // Latest pipeline counts, so re-ranks can keep the stats bar accurate.
      let dbCount = null

      // Provider and workbook text must never become executable HTML beside the key field.
      function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
      }

      function showError(msg, suggestion) {
        errorBox.textContent = suggestion ? `${msg} ${suggestion}` : msg
        errorBox.classList.add('show')
      }
      function clearError() {
        errorBox.classList.remove('show')
        errorBox.textContent = ''
      }
      function setBusy(busy) {
        submitBtn.disabled = busy
        demoBtn.disabled = busy
        spinner.classList.toggle('show', busy)
        for (const input of [connectionProvider, connectionApiType, connectionModel, connectionUrl, connectionKey, toggleKey, saveConnection, clearConnection, fileInput, setupSel, allowInput, citySel, activeChk]) input.disabled = busy
        connectionApiType.disabled = busy || connectionProvider.value !== 'custom'
        submitBtn.innerHTML = busy ? 'Finding your matches…' : 'Find My Match <span aria-hidden="true">→</span>'
      }

      // Shared handler for both the real upload and the demo path.
      async function runPipeline(url, body) {
        clearError()
        rerankNote.textContent = ''
        profileCard.classList.remove('show')
        preScreenCard.classList.remove('show')
        resultsCard.classList.remove('show')
        statsBar.classList.remove('show')
        emptyState.hidden = false
        modeNotice.hidden = true
        currentSessionId = null
        setBusy(true)
        try {
          const choices = readFilters()
          const isDemo = !body
          if (body) {
            body.append('preferences', JSON.stringify(choices.preferences))
            body.append('activeOnly', String(choices.activeOnly))
          }
          const res = await fetch(url, {
            method: 'POST',
            ...(isDemo ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(choices) } : { body })
          })
          const json = await res.json()
          if (!res.ok) {
            if (body) connectionStatus.textContent = 'Matching failed · review the error below'
            showError(json.message || 'Could not process your request.', json.suggestion)
            return
          }
          currentSessionId = json.sessionId
          modeNotice.hidden = !json.mock
          if (body) connectionStatus.textContent = 'Connected · résumé processed successfully'
          dbCount = json.preScreen?.totalIn ?? null
          renderProfile(json.profile)
          renderPreScreen(json.preScreen, json.tokenUsage)
          renderResults(json.scores, json.relevance)
        } catch (err) {
          if (body) connectionStatus.textContent = 'Connection interrupted · please try again'
          showError('Network error — please try again.')
        } finally {
          setBusy(false)
        }
      }

      form.addEventListener('submit', (e) => {
        e.preventDefault()
        const file = selectedFile
        if (!file) return showError('Please choose a PDF resume first.')
        const data = new FormData()
        data.append('resume', file)
        try {
          data.append('connection', JSON.stringify(readConnection()))
        } catch (err) {
          document.getElementById('connectionPanel').open = true
          connectionKey.focus()
          return showError(err.message)
        }
        connectionStatus.textContent = 'Connecting and processing résumé…'
        runPipeline('/api/pipeline/start', data)
      })

      // Demo Mode — skips the PDF + GPT call, uses the hardcoded profile.
      demoBtn.addEventListener('click', () => {
        runPipeline('/api/pipeline/start?mock=true', null)
      })

      function renderProfile(p) {
        if (!p) return showError('No profile was returned.')
        document.getElementById('pName').textContent = p.name || 'Student'
        document.getElementById('pCourse').textContent = p.course || 'Course not detected'
        document.getElementById('pYear').textContent = p.yearLevel || '4th'
        document.getElementById('pCampus').textContent = p.campus || 'FEU'

        const complete = document.getElementById('pComplete')
        complete.textContent = p.profileCompleteness || 'LOW'
        complete.className = 'pill ' + (p.profileCompleteness || 'LOW')

        const skillsEl = document.getElementById('pSkills')
        skillsEl.innerHTML = ''
        if (!p.skills || !p.skills.length) {
          skillsEl.innerHTML = '<span class="badge">No skills detected</span>'
        } else {
          for (const s of p.skills) {
            const el = document.createElement('span')
            el.className = 'badge'
            el.innerHTML = `${escapeHtml(s.skill)} <span class="lvl ${escapeHtml(s.level)}">${escapeHtml(s.level)}</span>`
            skillsEl.appendChild(el)
          }
        }

        const expEl = document.getElementById('pExperience')
        expEl.innerHTML = ''
        if (!p.experience || !p.experience.length) {
          expEl.innerHTML = '<div class="exp">No experience listed.</div>'
        } else {
          for (const x of p.experience) {
            const el = document.createElement('div')
            el.className = 'exp'
            el.innerHTML = `<span class="t">${escapeHtml(x.title || 'Role')}</span> ` +
              `<span class="o">${x.organization ? '· ' + escapeHtml(x.organization) : ''}` +
              `${x.duration ? ' · ' + escapeHtml(x.duration) : ''}</span>`
            expEl.appendChild(el)
          }
        }

        profileCard.classList.add('show')
      }

      // Human-friendly labels for each hard filter.
      const FILTER_LABELS = {
        YearLevelFilter: 'Year level (4th year only)',
        MOAStatusFilter: 'MOA status active',
        SlotAvailabilityFilter: 'Slots available',
        CourseExclusivityFilter: 'Accepts your course',
        AllowanceFloorFilter: 'Meets allowance floor',
        SetupPreferenceFilter: 'Work setup match'
      }

      function renderPreScreen(ps, tokenUsage) {
        if (!ps) return
        const head = document.getElementById('funnelHead')
        const rowsEl = document.getElementById('funnelRows')
        const totalEl = document.getElementById('funnelTotal')
        const tokenEl = document.getElementById('tokenNote')

        head.innerHTML = `Filtering <b>${ps.totalIn}</b> companies…`

        rowsEl.innerHTML = ''
        for (const s of ps.steps) {
          const row = document.createElement('div')
          row.className = 'funnel-row'
          const label = FILTER_LABELS[s.filter] || s.filter
          const elimClass = s.eliminated > 0 ? 'felim cut' : 'felim'
          row.innerHTML =
            `<span class="fname">${label}</span>` +
            `<span class="fcount">${s.before}<span class="arrow">→</span>` +
            `<span class="fout">${s.after}</span>` +
            `<span class="${elimClass}">${s.eliminated > 0 ? '−' + s.eliminated : 'no cut'}</span></span>`
          rowsEl.appendChild(row)
        }

        totalEl.innerHTML =
          `<b>${ps.totalOut}</b> of ${ps.totalIn} companies remaining after pre-screen.`

        if (ps.noMatch) {
          const tips = (ps.noMatch.relaxations || [])
            .slice(0, 3)
            .map(r => `${FILTER_LABELS[r.relaxation] || r.relaxation} (+${r.companiesUnlocked})`)
            .join(', ')
          totalEl.innerHTML +=
            `<div style="margin-top:0.6rem;color:var(--amber);font-size:0.85rem;">` +
            `No matches. Relaxing one filter would help most: ${tips || 'none found'}.</div>`
        }

        tokenEl.textContent = 'Eligibility checks use the company records in your partner list.'

        preScreenCard.classList.add('show')
      }

      // ─── Pipeline stats bar ──────────────────────────────────────
      function renderStats(scores, relevance) {
        if (dbCount != null) document.getElementById('sDb').textContent = dbCount.toLocaleString()
        if (relevance) document.getElementById('sRel').textContent = (relevance.totalOut ?? 0).toLocaleString()
        document.getElementById('sTop').textContent = scores ? scores.length : 0
        statsBar.classList.add('show')
      }

      // ─── Phase 3 + 4 — filter sidebar + instant re-rank ──────────
      const setupSel = document.getElementById('fSetup')
      const allowInput = document.getElementById('fAllowance')
      const allowVal = document.getElementById('fAllowVal')
      const citySel = document.getElementById('fCity')
      const activeChk = document.getElementById('fActive')
      const rerankNote = document.getElementById('rerankNote')

      function syncAllowLabel() { allowVal.textContent = `₱${Number(allowInput.value)}/day` }

      // Make preferences available before the first run and preserve user choices.
      async function initFilters() {
        syncAllowLabel()

        if (!citiesLoaded) {
          try {
            const res = await fetch('/api/pipeline/cities')
            const { cities } = await res.json()
            citySel.innerHTML = '<option value="">Any city</option>'
            for (const c of cities) {
              const opt = document.createElement('option')
              opt.value = c
              opt.textContent = c
              citySel.appendChild(opt)
            }
            citiesLoaded = true
          } catch { /* dropdown stays at "Any city" */ }
        }

        // Bind once — guarded so repeated runs don't stack listeners.
        if (!initFilters._bound) {
          allowInput.addEventListener('input', syncAllowLabel)
          for (const el of [setupSel, allowInput, citySel, activeChk]) {
            const evt = el === activeChk || el.tagName === 'SELECT' ? 'change' : 'input'
            el.addEventListener(evt, debounce(rerank, 200))
          }
          initFilters._bound = true
        }
      }

      initFilters()

      function readFilters() {
        return {
          preferences: {
            setup: setupSel.value,
            minAllowance: Number(allowInput.value) || null,
            homeLocation: citySel.value || null
          },
          activeOnly: activeChk.checked
        }
      }

      function debounce(fn, ms) {
        let t
        return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms) }
      }

      // Re-score the current session with the chosen filters. ZERO tokens.
      async function rerank() {
        if (!currentSessionId) return
        const body = readFilters()
        try {
          const res = await fetch(`/api/pipeline/rerank/${currentSessionId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          })
          const json = await res.json()
          if (!res.ok) return showError(json.message || 'Re-rank failed.', json.suggestion)
          renderResults(json.scores, null)
          rerankNote.textContent = 'Shortlist updated to your preferences.'
        } catch {
          showError('Network error during re-rank.')
        }
      }

      const REC_TEXT = {
        apply_now: 'Apply now — strong bilateral match.',
        apply_with_preparation: 'Apply with preparation — close a few gaps first.',
        stretch_goal: 'Stretch goal — worth a shot with a strong pitch.',
        skip: 'Lower priority — consider only if options are thin.'
      }

      function renderResults(scores, relevance) {
        emptyState.hidden = true
        const selectedId = graphCompany.value
        graphScores = scores || []
        graphCompany.replaceChildren()
        for (const [index, company] of graphScores.entries()) {
          const option = document.createElement('option')
          option.value = company.id
          option.textContent = `${index + 1}. ${company.name}`
          graphCompany.appendChild(option)
        }
        if (graphScores.some(company => String(company.id) === selectedId)) graphCompany.value = selectedId
        document.getElementById('bilateralPanel').hidden = !graphScores.length
        renderBilateralGraph()
        // Keep the last relevance counts so re-ranks (relevance=null) don't blank the bar.
        if (relevance) renderResults._rel = relevance
        relevance = relevance || renderResults._rel
        renderStats(scores, relevance)

        if (relevance) {
          document.getElementById('relNote').innerHTML =
            `<div class="rel-summary"><strong>Your shortlist, explained</strong><span>Top ${Math.min(20, scores.length)} matches</span></div>` +
            `<p><b>${relevance.kept.direct}</b> direct · <b>${relevance.kept.adjacent}</b> adjacent industry matches from ${relevance.totalIn.toLocaleString()} pre-screened companies.</p>` +
            `<p>Prioritized by industry fit, active partnership, then match score.</p>` +
            `<p class="resume-field">Your field: <strong>${escapeHtml((relevance.resumeFields || []).map(f => f.label).join(' · ') || 'Not identified')}</strong></p>` +
            ((relevance.needsVerification || []).length ? `<details><summary>${relevance.dropped?.unknown || 0} industry records need verification <span aria-hidden="true">+</span></summary><ul>${relevance.needsVerification.map(c => `<li><strong>${escapeHtml(c.name)}</strong>: ${escapeHtml(c.industryLabels.join(' / ') || 'Industry not listed')} — ${escapeHtml(c.reason)}</li>`).join('')}</ul></details>` : '')
        }

        const wrap = document.getElementById('coCards')
        wrap.innerHTML = ''
        if (!scores || !scores.length) {
          wrap.innerHTML = `<div class="co">${escapeHtml(relevance?.noMatch?.reason || 'No companies match these filters and résumé fields. Review your preferences and the course, skills, and experience in your résumé.')}</div>`
          resultsCard.classList.add('show')
          return
        }

        for (const [index, c] of scores.entries()) {
          wrap.appendChild(renderCompanyCard(c, index + 1))
        }
        resultsCard.classList.add('show')
      }

      function renderCompanyCard(c, rank) {
        const el = document.createElement('article')
        el.className = 'co'

        const setup = c.setup ? c.setup.charAt(0).toUpperCase() + c.setup.slice(1) : 'Setup not listed'
        const allow = c.allowance != null
          ? `₱${c.allowance}/day`
          : (c.allowanceDisplay || 'Allowance not specified')

        // Matched skills (green) + classified gaps (colored by type).
        const matched = (c.breakdown?.skillsMatch?.matched ?? [])
          .map(s => `<span class="tag matched">✓ ${escapeHtml(s)}</span>`).join('')
        const gaps = (c.breakdown?.learnability?.classifiedGaps ?? [])
          .map(g => `<span class="tag ${escapeHtml(g.type)}">${escapeHtml(g.skill)} · ${escapeHtml(g.type)}</span>`).join('')
        const skills = c.breakdown?.skillsMatch
        const known = skills && !skills.neutral && Number.isFinite(skills.score)
        const skillScore = known ? Math.max(0, Math.min(100, skills.score)) : 0
        const activeTag = c.hasActiveInterns ? '<span class="co-chip active">Active partner</span>' : ''
        el.innerHTML = `
          <div class="co-main">
            <span class="rank ${rank === 1 ? 'first' : rank === 2 ? 'second' : ''}" aria-label="Rank ${rank}">${rank}</span>
            <div class="co-info">
              <h3 class="co-name">${escapeHtml(c.name)}</h3>
              <div class="co-scoreline">MatchPoint score: <strong>${escapeHtml(c.bilateral)}</strong><span class="tier ${escapeHtml(c.tier)}">${escapeHtml(c.tier)}</span></div>
              <div class="co-chips"><span class="co-chip">${c.industryFit?.tier === 'direct' ? 'Direct industry fit' : 'Adjacent industry'}</span><span class="co-chip">${escapeHtml(setup)}</span><span class="co-chip">${escapeHtml(c.city || 'Location not listed')}</span><span class="co-chip">${escapeHtml(allow)}</span>${activeTag}</div>
            </div>
            <div class="skill-meter"><span>Skill match</span><strong>${known ? skillScore + '%' : '—'}</strong>
              ${known ? `<div class="meter-track" role="meter" aria-label="Skill match for ${escapeHtml(c.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${skillScore}"><i style="width:${skillScore}%"></i></div>` : ''}
              <small>${known ? `${skills.matched.length} skills matched` : 'Skills not listed'}</small>
            </div>
          </div>
          <details class="co-details"><summary>View match details <span aria-hidden="true">+</span></summary>
            <p class="co-industry">${escapeHtml(c.industry || 'Industry not listed')}</p>
            <p class="co-rec">${escapeHtml(c.industryFit?.reason || 'Industry fit not assessed.')}</p>
            <p class="co-rec">Résumé evidence: ${escapeHtml((c.industryFit?.evidence || []).join(' · ') || 'Not available')}. Industry fit does not confirm an available internship role.</p>
            <div class="co-tags">${matched}${gaps}</div>
            <p class="co-rec">${escapeHtml(REC_TEXT[c.recommendation] || c.recommendation)}</p>
            ${renderContacts(c.contacts)}
          </details>`

        return el
      }

      function renderContacts(contacts) {
        const list = Array.isArray(contacts) ? contacts : []
        const rows = list.map((contact, index) => {
          const email = String(contact.email || '')
          const validEmail = /^[^\s@<>"\r\n]+@[^\s@<>"\r\n]+\.[^\s@<>"\r\n]+$/.test(email)
          return `<div class="contact-person">
            <strong>${escapeHtml(contact.name || `Contact ${index + 1}`)}</strong>
            ${contact.position ? `<span>${escapeHtml(contact.position)}</span>` : ''}
            ${email ? (validEmail ? `<a href="mailto:${escapeHtml(encodeURIComponent(email))}">${escapeHtml(email)}</a>` : `<span>${escapeHtml(email)}</span>`) : ''}
            ${contact.phone ? `<span>${escapeHtml(contact.phone)}</span>` : ''}
          </div>`
        }).join('')
        return `<section class="company-contacts"><h4>Points of contact</h4>${rows || '<p>No contact details listed for this company.</p>'}<p class="contact-source">Source: company partner list. Contact details may need reconfirmation.</p></section>`
      }

      function renderBilateralGraph() {
        const company = graphScores.find(item => String(item.id) === graphCompany.value)
        const target = document.getElementById('bilateralGraph')
        if (!company) { target.replaceChildren(); return }
        const clamp = value => Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0
        const student = clamp(company.studentScore)
        const employer = clamp(company.companyScore)
        const tiedCount = graphScores.filter(item => clamp(item.studentScore) === student && clamp(item.companyScore) === employer).length
        const skills = company.breakdown?.skillsMatch
        const skillsSummary = skills && !skills.neutral
          ? `${skills.matched?.length ?? 0} skills matched · ${clamp(skills.score)}% skill match`
          : 'Skills not listed'
        const setup = company.setup ? company.setup.charAt(0).toUpperCase() + company.setup.slice(1) : 'Setup not listed'
        const width = 190
        // Two outward bars share the same 0–100 scale and center baseline.
        target.innerHTML = `
          <div class="graph-company"><h3>${escapeHtml(company.name)}</h3><p>${escapeHtml(company.city || 'Location not listed')} · ${escapeHtml(setup)}</p><p>${escapeHtml(skillsSummary)}</p></div>
          ${tiedCount > 1 ? `<p class="graph-tie-note">${tiedCount} shortlisted companies share these displayed fit scores, so their bars look the same.</p>` : ''}
          <div class="bilateral-labels"><span><i class="legend-student"></i>Your fit <b>${student}/100</b></span><span><i class="legend-company"></i>Company-side fit <b>${employer}/100</b></span></div>
          <svg class="bilateral-chart" viewBox="0 0 460 98" role="img" aria-label="${escapeHtml(company.name)}: your fit ${student} of 100; company-side fit ${employer} of 100; combined MatchPoint score ${escapeHtml(company.bilateral)} of 100.">
            <g class="graph-grid"><path d="M20 14v48 M115 14v48 M210 8v54 M250 8v54 M345 14v48 M440 14v48"/></g>
            <rect x="20" y="24" width="190" height="24" rx="5" fill="#edf3ee"/>
            <rect x="250" y="24" width="190" height="24" rx="5" fill="#fff5d6"/>
            <rect x="${210 - student / 100 * width}" y="24" width="${student / 100 * width}" height="24" rx="5" fill="#356c4c"/>
            <rect x="250" y="24" width="${employer / 100 * width}" height="24" rx="5" fill="#c49c4c"/>
            <g class="graph-axis"><text x="20" y="78">100</text><text x="115" y="78">50</text><text x="210" y="78">0</text><text x="250" y="78">0</text><text x="345" y="78">50</text><text x="440" y="78">100</text></g>
          </svg>
          <div class="graph-result"><span>60% your fit + 40% company-side fit</span><strong>${escapeHtml(company.bilateral)}<small>/100</small></strong></div>
          <details class="graph-breakdown"><summary>What goes into each side <span aria-hidden="true">+</span></summary><div class="graph-factors"><p><b>Your fit</b>Skills 30% · Allowance 25% · Location 25% · Work setup 20%</p><p><b>Company-side fit</b>Learnability 60% · Active-partner status 40%</p></div><p>Displayed side scores are rounded. The combined score uses the original values.</p></details>`
      }
