/**
 * Cinéma — OMDB Movie Search App
 * Uses OMDb API with LocalStorage for state persistence and URL params for sharing.
 */

// ─── Config ───────────────────────────────────────────────────────────────────
const API_KEY   = '8b2ff57b';           // free OMDb demo key — replace with your own
const BASE_URL  = 'https://www.omdbapi.com/';
const PAGE_SIZE = 10;                   // OMDb returns 10 per page

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const searchInput  = document.getElementById('searchInput');
const searchBtn    = document.getElementById('searchBtn');
const typeFilter   = document.getElementById('typeFilter');
const yearFilter   = document.getElementById('yearFilter');
const stateEmpty   = document.getElementById('stateEmpty');
const stateLoading = document.getElementById('stateLoading');
const stateError   = document.getElementById('stateError');
const stateResults = document.getElementById('stateResults');
const stateDetail  = document.getElementById('stateDetail');
const errorMsg     = document.getElementById('errorMsg');
const resultCount  = document.getElementById('resultCount');
const resultQuery  = document.getElementById('resultQuery');
const movieGrid    = document.getElementById('movieGrid');
const pagination   = document.getElementById('pagination');
const backBtn      = document.getElementById('backBtn');
const detailCard   = document.getElementById('detailCard');

// ─── App state ────────────────────────────────────────────────────────────────
let state = {
  query:    '',
  type:     '',
  year:     '',
  page:     1,
  total:    0,
  view:     'empty',   // 'empty' | 'results' | 'detail'
  imdbId:   null,
  results:  [],
};

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function searchMovies({ query, type, year, page = 1 }) {
  const params = new URLSearchParams({ apikey: API_KEY, s: query, page });
  if (type) params.set('type', type);
  if (year) params.set('y', year);
  const res  = await fetch(`${BASE_URL}?${params}`);
  if (!res.ok) throw new Error(`Network error: ${res.status}`);
  return res.json();
}

async function fetchDetail(imdbId) {
  const params = new URLSearchParams({ apikey: API_KEY, i: imdbId, plot: 'full' });
  const res    = await fetch(`${BASE_URL}?${params}`);
  if (!res.ok) throw new Error(`Network error: ${res.status}`);
  return res.json();
}

// ─── View management ──────────────────────────────────────────────────────────

function showState(name) {
  [stateEmpty, stateLoading, stateError, stateResults, stateDetail].forEach(el => {
    el.classList.add('hidden');
  });
  if (name === 'empty')   stateEmpty.classList.remove('hidden');
  if (name === 'loading') stateLoading.classList.remove('hidden');
  if (name === 'error')   stateError.classList.remove('hidden');
  if (name === 'results') stateResults.classList.remove('hidden');
  if (name === 'detail')  stateDetail.classList.remove('hidden');
}

// ─── Poster helpers ───────────────────────────────────────────────────────────

const NO_POSTER_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
    <rect x="2" y="3" width="20" height="18" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>`;

function posterImg(url, alt, cls = 'card-poster') {
  if (!url || url === 'N/A') {
    return `<div class="${cls} no-poster">${NO_POSTER_SVG}</div>`;
  }
  return `<img class="${cls}" src="${url}" alt="${escHtml(alt)}" loading="lazy"
           onerror="this.outerHTML='<div class=\\'${cls} no-poster\\'>${NO_POSTER_SVG.replace(/"/g,"'")}</div>'"/>`;
}

// ─── Render: grid ─────────────────────────────────────────────────────────────

function renderGrid(movies) {
  movieGrid.innerHTML = movies.map(m => `
    <article class="movie-card" data-id="${m.imdbID}" role="button" tabindex="0"
             aria-label="${escHtml(m.Title)} (${m.Year})">
      ${posterImg(m.Poster, m.Title)}
      <div class="card-body">
        <div class="card-title">${escHtml(m.Title)}</div>
        <div class="card-meta">
          <span>${m.Year}</span>
          <span class="card-type">${m.Type || ''}</span>
        </div>
      </div>
    </article>
  `).join('');

  // click / keyboard handlers
  movieGrid.querySelectorAll('.movie-card').forEach(card => {
    card.addEventListener('click',   () => openDetail(card.dataset.id));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openDetail(card.dataset.id); });
  });
}

// ─── Render: pagination ───────────────────────────────────────────────────────

function renderPagination(current, total) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) { pagination.innerHTML = ''; return; }

  const MAX_VISIBLE = 5;
  let pages = [];

  if (totalPages <= MAX_VISIBLE + 2) {
    pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  } else {
    const half = Math.floor(MAX_VISIBLE / 2);
    let start  = Math.max(2, current - half);
    let end    = Math.min(totalPages - 1, current + half);
    if (current - half < 2) end   = Math.min(totalPages - 1, MAX_VISIBLE);
    if (current + half > totalPages - 1) start = Math.max(2, totalPages - MAX_VISIBLE + 1);
    pages = [1];
    if (start > 2) pages.push('…');
    for (let p = start; p <= end; p++) pages.push(p);
    if (end < totalPages - 1) pages.push('…');
    pages.push(totalPages);
  }

  pagination.innerHTML = [
    `<button class="page-btn" ${current === 1 ? 'disabled' : ''} data-page="${current - 1}">‹ Prev</button>`,
    ...pages.map(p =>
      p === '…'
        ? `<span class="page-btn" style="cursor:default;opacity:.4">…</span>`
        : `<button class="page-btn ${p === current ? 'active' : ''}" data-page="${p}">${p}</button>`
    ),
    `<button class="page-btn" ${current === totalPages ? 'disabled' : ''} data-page="${current + 1}">Next ›</button>`,
  ].join('');

  pagination.querySelectorAll('button[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!btn.disabled) goToPage(Number(btn.dataset.page));
    });
  });
}

// ─── Render: detail ───────────────────────────────────────────────────────────

function renderDetail(m) {
  const genres = (m.Genre && m.Genre !== 'N/A')
    ? m.Genre.split(',').map(g => `<span class="genre-tag">${g.trim()}</span>`).join('')
    : '<span class="genre-tag">—</span>';

  const imdbRating = (m.imdbRating && m.imdbRating !== 'N/A')
    ? `<span class="rating-badge">
         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
         ${m.imdbRating}
       </span>`
    : '';

  const val = v => (!v || v === 'N/A') ? '—' : v;

  detailCard.innerHTML = `
    <div class="detail-poster-wrap">
      ${m.Poster && m.Poster !== 'N/A'
        ? `<img class="detail-poster" src="${m.Poster}" alt="${escHtml(m.Title)} poster"/>`
        : `<div class="detail-poster-placeholder">${NO_POSTER_SVG}</div>`}
    </div>
    <div class="detail-info">
      <div class="detail-type">${val(m.Type)} ${val(m.Rated) !== '—' ? '· ' + m.Rated : ''}</div>
      <h1 class="detail-title">${escHtml(m.Title)}</h1>
      <div class="detail-year-rating">
        <span>${val(m.Year)}</span>
        ${m.Runtime && m.Runtime !== 'N/A' ? `<span>· ${m.Runtime}</span>` : ''}
        ${imdbRating}
      </div>
      ${m.Plot && m.Plot !== 'N/A'
        ? `<p class="detail-plot">${escHtml(m.Plot)}</p>`
        : ''}
      <div class="detail-meta-grid">
        <div class="meta-item">
          <label>Director</label>
          <span>${escHtml(val(m.Director))}</span>
        </div>
        <div class="meta-item">
          <label>Writer</label>
          <span>${escHtml(val(m.Writer))}</span>
        </div>
        <div class="meta-item">
          <label>Cast</label>
          <span>${escHtml(val(m.Actors))}</span>
        </div>
        <div class="meta-item">
          <label>Genre</label>
          <div class="genre-tags">${genres}</div>
        </div>
        <div class="meta-item">
          <label>Released</label>
          <span>${escHtml(val(m.Released))}</span>
        </div>
        <div class="meta-item">
          <label>Country</label>
          <span>${escHtml(val(m.Country))}</span>
        </div>
        <div class="meta-item">
          <label>Language</label>
          <span>${escHtml(val(m.Language))}</span>
        </div>
        <div class="meta-item">
          <label>Awards</label>
          <span>${escHtml(val(m.Awards))}</span>
        </div>
        ${m.totalSeasons ? `<div class="meta-item"><label>Seasons</label><span>${m.totalSeasons}</span></div>` : ''}
      </div>
    </div>
  `;
}

// ─── Search flow ──────────────────────────────────────────────────────────────

async function doSearch(page = 1) {
  const query = state.query.trim();
  if (!query) return;

  showState('loading');

  try {
    const data = await searchMovies({ query, type: state.type, year: state.year, page });

    if (data.Response === 'False') {
      errorMsg.textContent = data.Error || 'No results found.';
      showState('error');
      saveState();
      return;
    }

    state.page    = page;
    state.total   = parseInt(data.totalResults, 10);
    state.results = data.Search;
    state.view    = 'results';

    resultCount.textContent = `${state.total.toLocaleString()} result${state.total !== 1 ? 's' : ''} for`;
    resultQuery.textContent = `"${query}"`;

    renderGrid(state.results);
    renderPagination(state.page, state.total);
    showState('results');
    saveState();

  } catch (err) {
    errorMsg.textContent = 'Could not connect to the API. Please try again.';
    showState('error');
    console.error(err);
  }
}

async function goToPage(page) {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  await doSearch(page);
  setURLParams();
}

// ─── Detail flow ──────────────────────────────────────────────────────────────

async function openDetail(imdbId) {
  state.view   = 'detail';
  state.imdbId = imdbId;
  showState('loading');

  try {
    const data = await fetchDetail(imdbId);
    if (data.Response === 'False') {
      errorMsg.textContent = data.Error || 'Movie not found.';
      showState('error');
      return;
    }
    renderDetail(data);
    showState('detail');
    setURLParams();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    errorMsg.textContent = 'Could not load movie details.';
    showState('error');
    console.error(err);
  }
}

function closeDetail() {
  state.view   = 'results';
  state.imdbId = null;

  if (state.results.length) {
    renderGrid(state.results);
    renderPagination(state.page, state.total);
    showState('results');
  } else {
    showState('empty');
  }
  setURLParams();
}

// ─── Persistence ──────────────────────────────────────────────────────────────

const LS_KEY = 'cinema_state';

function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify({
    query:   state.query,
    type:    state.type,
    year:    state.year,
    page:    state.page,
    view:    state.view,
    imdbId:  state.imdbId,
    total:   state.total,
    results: state.results,
  }));
  setURLParams();
}

function setURLParams() {
  const url = new URL(window.location.href);
  if (state.query) url.searchParams.set('q', state.query); else url.searchParams.delete('q');
  if (state.type)  url.searchParams.set('type', state.type); else url.searchParams.delete('type');
  if (state.year)  url.searchParams.set('y', state.year); else url.searchParams.delete('y');
  url.searchParams.set('page', state.page);
  if (state.view === 'detail' && state.imdbId) url.searchParams.set('id', state.imdbId);
  else url.searchParams.delete('id');
  history.replaceState(null, '', url);
}

async function restoreState() {
  // 1. Try URL params first (shareable links)
  const url    = new URL(window.location.href);
  const qParam = url.searchParams.get('q');
  const idParam = url.searchParams.get('id');

  if (qParam) {
    state.query = qParam;
    state.type  = url.searchParams.get('type') || '';
    state.year  = url.searchParams.get('y') || '';
    state.page  = parseInt(url.searchParams.get('page'), 10) || 1;
    syncFilters();
    if (idParam) {
      state.imdbId = idParam;
      state.view   = 'detail';
      await doSearch(state.page);  // load results in background for back button
      await openDetail(idParam);
    } else {
      await doSearch(state.page);
    }
    return;
  }

  // 2. Fall back to LocalStorage
  const saved = localStorage.getItem(LS_KEY);
  if (!saved) return;

  try {
    const s = JSON.parse(saved);
    Object.assign(state, s);
    syncFilters();

    if (state.view === 'results' && state.query) {
      await doSearch(state.page);
    } else if (state.view === 'detail' && state.imdbId) {
      if (state.results.length) {
        // silently rehydrate results for back button
        renderGrid(state.results);
        renderPagination(state.page, state.total);
      }
      await openDetail(state.imdbId);
    }
  } catch {
    localStorage.removeItem(LS_KEY);
  }
}

function syncFilters() {
  searchInput.value  = state.query;
  typeFilter.value   = state.type;
  yearFilter.value   = state.year;
}

// ─── Event listeners ──────────────────────────────────────────────────────────

searchBtn.addEventListener('click', () => triggerSearch());

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') triggerSearch();
});

typeFilter.addEventListener('change', () => {
  state.type = typeFilter.value;
  if (state.query) triggerSearch();
});

yearFilter.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    state.year = yearFilter.value;
    if (state.query) triggerSearch();
  }
});

yearFilter.addEventListener('change', () => {
  state.year = yearFilter.value;
  if (state.query) triggerSearch();
});

backBtn.addEventListener('click', closeDetail);

function triggerSearch() {
  const q = searchInput.value.trim();
  if (!q) return;
  state.query = q;
  state.type  = typeFilter.value;
  state.year  = yearFilter.value;
  state.page  = 1;
  doSearch(1);
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Init ─────────────────────────────────────────────────────────────────────

restoreState();
