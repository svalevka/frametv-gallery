(() => {
  const grid = document.getElementById('grid');
  const sentinel = document.getElementById('sentinel');
  const searchInput = document.getElementById('search');
  const movementSelect = document.getElementById('filter-movement');
  const centurySelect = document.getElementById('filter-century');
  const letterSelect = document.getElementById('filter-letter');
  const clearFiltersBtn = document.getElementById('clear-filters');
  const selectionCount = document.getElementById('selection-count');
  const sendTvBtn = document.getElementById('send-to-tv');
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
  const lightboxSendTvBtn = document.getElementById('lightbox-send-tv');
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

  function showToast(message, duration = 4000) {
    toast.textContent = message;
    if (!toast.matches(':popover-open')) toast.showPopover();
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.hidePopover(), duration);
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

  async function checkTvStatus() {
    const res = await fetch('/api/tv/status');
    const data = await res.json();
    sendTvBtn.hidden = !data.configured;
    lightboxSendTvBtn.hidden = !data.configured;
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
    img.addEventListener('error', () => card.classList.add('thumb-missing'), { once: true });

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
    sendTvBtn.disabled = n === 0;
    clearSelectionBtn.disabled = n === 0;
  }

  clearSelectionBtn.addEventListener('click', () => {
    state.selected.clear();
    document.querySelectorAll('.card.selected').forEach((c) => c.classList.remove('selected'));
    updateSelectionBar();
  });

  sendTvBtn.addEventListener('click', async () => sendSelectionToTV());

  async function sendSelectionToTV(ids) {
    const idList = ids || Array.from(state.selected.keys());
    if (idList.length === 0) return;
    sendTvBtn.disabled = true;
    sendTvBtn.textContent = 'Sending…';
    lightboxSendTvBtn.disabled = true;
    lightboxSendTvBtn.textContent = 'Sending…';
    try {
      const res = await fetch('/api/tv/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idList }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');
      const ok = data.results.filter((r) => r.ok).length;
      const failed = data.results.filter((r) => !r.ok);
      if (failed.length) {
        const uniqueErrors = [...new Set(failed.map((r) => r.error))];
        showToast(
          `${ok ? `Sent ${ok} image(s) to the TV. ` : ''}${uniqueErrors.join(' ')}`,
          7000
        );
        console.error('Send to TV failures:', failed);
      } else {
        showToast(`Sent ${ok} image(s) to the TV.`);
      }
    } catch (err) {
      console.error(err);
      showToast(`Could not send to TV: ${err.message}`, 7000);
    } finally {
      sendTvBtn.disabled = state.selected.size === 0;
      sendTvBtn.textContent = 'Send to TV (Wi-Fi)';
      lightboxSendTvBtn.disabled = false;
      lightboxSendTvBtn.textContent = 'Send to TV (Wi-Fi)';
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

  lightboxImg.addEventListener('error', () => {
    showToast('Image unavailable — check that the external drive is connected.', 6000);
  });

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

  lightboxSendTvBtn.addEventListener('click', () => {
    const id = state.currentLightboxId;
    if (id == null) return;
    sendSelectionToTV([id]);
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
    await checkTvStatus();
    const available = await checkStatus();
    if (!available) return;
    await loadFilters();
    await loadNextPage();
  })();
})();
