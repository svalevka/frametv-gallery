(() => {
  const grid = document.getElementById('grid');
  const sentinel = document.getElementById('sentinel');
  const searchInput = document.getElementById('search');
  const movementSelect = document.getElementById('filter-movement');
  const centurySelect = document.getElementById('filter-century');
  const letterSelect = document.getElementById('filter-letter');
  const clearFiltersBtn = document.getElementById('clear-filters');
  const selectionCount = document.getElementById('selection-count');
  const sendBtn = document.getElementById('send-to-frametv');
  const clearSelectionBtn = document.getElementById('clear-selection');
  const statusBanner = document.getElementById('status-banner');
  const toast = document.getElementById('toast');

  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxTitle = document.getElementById('lightbox-title');
  const lightboxArtist = document.getElementById('lightbox-artist');
  const lightboxTags = document.getElementById('lightbox-tags');
  const lightboxClose = document.getElementById('lightbox-close');
  const lightboxSelectBtn = document.getElementById('lightbox-select');
  const lightboxSendBtn = document.getElementById('lightbox-send');
  const lightboxShareBtn = document.getElementById('lightbox-share');
  const lightboxPrevBtn = document.getElementById('lightbox-prev');
  const lightboxNextBtn = document.getElementById('lightbox-next');

  const state = {
    page: 1,
    pageSize: 60,
    total: Infinity,
    loading: false,
    query: '',
    movement: '',
    century: '',
    letter: '',
    selected: new Map(), // id -> { artist, title }
    currentLightboxId: null,
    orderedIds: [], // ids in the order they were rendered, for prev/next navigation
    itemsById: new Map(),
  };

  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => (toast.hidden = true), 2500);
  }

  async function loadFilters() {
    const res = await fetch('/api/filters');
    const data = await res.json();
    fillSelect(movementSelect, data.movements);
    fillSelect(centurySelect, data.centuries);
    fillSelect(letterSelect, data.letters);
  }

  function fillSelect(select, values) {
    for (const v of values) {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    }
  }

  async function checkStatus() {
    const res = await fetch('/api/status');
    const data = await res.json();
    if (!data.available) {
      statusBanner.hidden = false;
      statusBanner.textContent = `Source disk not found at ${data.sourceRoot}. Connect the external drive and reload.`;
    } else {
      statusBanner.hidden = true;
    }
    return data.available;
  }

  function resetGrid() {
    state.page = 1;
    state.total = Infinity;
    state.orderedIds = [];
    state.itemsById = new Map();
    grid.innerHTML = '';
  }

  function buildQuery() {
    const params = new URLSearchParams({
      page: state.page,
      pageSize: state.pageSize,
    });
    if (state.query) params.set('q', state.query);
    if (state.movement) params.set('movement', state.movement);
    if (state.century) params.set('century', state.century);
    if (state.letter) params.set('letter', state.letter);
    return params.toString();
  }

  async function loadNextPage() {
    if (state.loading) return;
    if ((state.page - 1) * state.pageSize >= state.total) return;
    state.loading = true;

    const res = await fetch(`/api/images?${buildQuery()}`);
    const data = await res.json();
    state.total = data.total;

    if (state.page === 1 && data.items.length === 0) {
      grid.innerHTML = '<div class="empty-state">No images match your search or filters.</div>';
    }

    for (const item of data.items) {
      state.orderedIds.push(item.id);
      state.itemsById.set(item.id, item);
      grid.appendChild(renderCard(item));
    }

    state.page += 1;
    state.loading = false;
  }

  function renderCard(item) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = item.id;
    if (state.selected.has(item.id)) card.classList.add('selected');

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.src = `/api/thumb/${item.id}`;
    img.alt = item.title;

    const check = document.createElement('div');
    check.className = 'check';
    check.textContent = '✓';
    check.title = 'Select';
    check.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSelect(item, card);
    });

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = `<div class="title">${escapeHtml(item.title)}</div><div class="artist">${escapeHtml(item.artist)}</div>`;

    card.appendChild(img);
    card.appendChild(check);
    card.appendChild(meta);

    if (item.inFrameTV) {
      const badge = document.createElement('div');
      badge.className = 'badge';
      badge.textContent = 'On TV';
      card.appendChild(badge);
    }

    card.addEventListener('click', () => openLightbox(item));

    return card;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function toggleSelect(item, cardEl) {
    if (state.selected.has(item.id)) {
      state.selected.delete(item.id);
      cardEl?.classList.remove('selected');
    } else {
      state.selected.set(item.id, item);
      cardEl?.classList.add('selected');
    }
    updateSelectionBar();
  }

  function updateSelectionBar() {
    const n = state.selected.size;
    selectionCount.textContent = `${n} selected`;
    sendBtn.disabled = n === 0;
    clearSelectionBtn.disabled = n === 0;
  }

  clearSelectionBtn.addEventListener('click', () => {
    state.selected.clear();
    document.querySelectorAll('.card.selected').forEach((c) => c.classList.remove('selected'));
    updateSelectionBar();
  });

  sendBtn.addEventListener('click', async () => sendSelectionToFrameTV());

  async function sendSelectionToFrameTV(ids) {
    const idList = ids || Array.from(state.selected.keys());
    if (idList.length === 0) return;
    sendBtn.disabled = true;
    const res = await fetch('/api/frametv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: idList }),
    });
    const data = await res.json();
    showToast(
      `Sent ${data.copied.length} image(s) to Frame TV${data.skipped.length ? `, ${data.skipped.length} already there` : ''}.`
    );
    document.querySelectorAll('.card').forEach((card) => {
      if (idList.includes(Number(card.dataset.id))) {
        let badge = card.querySelector('.badge');
        if (!badge) {
          badge = document.createElement('div');
          badge.className = 'badge';
          badge.textContent = 'On TV';
          card.appendChild(badge);
        }
      }
    });
    if (!ids) {
      state.selected.clear();
      document.querySelectorAll('.card.selected').forEach((c) => c.classList.remove('selected'));
      updateSelectionBar();
    }
  }

  // --- Lightbox ---
  function openLightbox(item) {
    state.currentLightboxId = item.id;
    lightboxImg.src = `/api/full/${item.id}`;
    lightboxImg.alt = item.title;
    lightboxTitle.textContent = item.title;
    lightboxArtist.textContent = item.artist;
    const tags = [...item.movements, ...item.centuries].join(' · ');
    lightboxTags.textContent = tags;
    lightboxSelectBtn.textContent = state.selected.has(item.id) ? 'Deselect' : 'Select';
    lightboxShareBtn.disabled = false;
    lightboxShareBtn.textContent = 'Share via AirDrop';
    updateNavButtons();
    if (!lightbox.open) lightbox.showModal();
  }

  function updateNavButtons() {
    const idx = state.orderedIds.indexOf(state.currentLightboxId);
    lightboxPrevBtn.disabled = idx <= 0;
    const isLastLoaded = idx === state.orderedIds.length - 1;
    lightboxNextBtn.disabled = isLastLoaded && state.orderedIds.length >= state.total;
  }

  async function navigateLightbox(delta) {
    const idx = state.orderedIds.indexOf(state.currentLightboxId);
    if (idx === -1) return;
    let targetIdx = idx + delta;

    if (targetIdx >= state.orderedIds.length && state.orderedIds.length < state.total) {
      await loadNextPage();
    }
    if (targetIdx < 0 || targetIdx >= state.orderedIds.length) return;

    const nextId = state.orderedIds[targetIdx];
    const item = state.itemsById.get(nextId);
    if (item) openLightbox(item);
  }

  lightboxPrevBtn.addEventListener('click', () => navigateLightbox(-1));
  lightboxNextBtn.addEventListener('click', () => navigateLightbox(1));

  lightbox.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') navigateLightbox(-1);
    if (e.key === 'ArrowRight') navigateLightbox(1);
  });

  lightboxClose.addEventListener('click', () => lightbox.close());
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) lightbox.close();
  });

  lightboxSelectBtn.addEventListener('click', () => {
    const id = state.currentLightboxId;
    if (id == null) return;
    const card = grid.querySelector(`.card[data-id="${id}"]`);
    const item = state.selected.get(id) || state.itemsById.get(id);
    toggleSelect(item, card);
    lightboxSelectBtn.textContent = state.selected.has(id) ? 'Deselect' : 'Select';
  });

  lightboxSendBtn.addEventListener('click', () => {
    const id = state.currentLightboxId;
    if (id == null) return;
    sendSelectionToFrameTV([id]);
  });

  lightboxShareBtn.addEventListener('click', async () => {
    const id = state.currentLightboxId;
    if (id == null) return;
    const item = state.itemsById.get(id);
    const filename = item?.filename || `${lightboxTitle.textContent}.jpg`;

    lightboxShareBtn.disabled = true;
    lightboxShareBtn.textContent = 'Preparing…';
    try {
      const res = await fetch(`/api/full/${id}`);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: lightboxTitle.textContent });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        showToast("Browser can't open the share sheet — downloaded instead. AirDrop it from Finder.");
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(err);
        showToast('Could not share image.');
      }
    } finally {
      lightboxShareBtn.disabled = false;
      lightboxShareBtn.textContent = 'Share via AirDrop';
    }
  });

  // --- Filters / search ---
  let searchDebounce;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.query = searchInput.value;
      resetGrid();
      loadNextPage();
    }, 300);
  });

  function onFilterChange() {
    state.movement = movementSelect.value;
    state.century = centurySelect.value;
    state.letter = letterSelect.value;
    resetGrid();
    loadNextPage();
  }

  movementSelect.addEventListener('change', onFilterChange);
  centurySelect.addEventListener('change', onFilterChange);
  letterSelect.addEventListener('change', onFilterChange);

  clearFiltersBtn.addEventListener('click', () => {
    searchInput.value = '';
    movementSelect.value = '';
    centurySelect.value = '';
    letterSelect.value = '';
    state.query = '';
    state.movement = '';
    state.century = '';
    state.letter = '';
    resetGrid();
    loadNextPage();
  });

  // --- Infinite scroll ---
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) loadNextPage();
    },
    { rootMargin: '600px' }
  );
  observer.observe(sentinel);

  // --- Init ---
  (async function init() {
    const available = await checkStatus();
    if (!available) return;
    await loadFilters();
    await loadNextPage();
  })();
})();
