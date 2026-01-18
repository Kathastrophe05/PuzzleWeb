// playZone JS: einfache Thumbnail-Scroll-Logik
document.addEventListener('DOMContentLoaded', function () {
  const thumbs = document.getElementById('thumbs');
  const left = document.getElementById('thumbs-left');
  const right = document.getElementById('thumbs-right');
  const thumbsContainer = document.querySelector('.thumbs-container');
  const info = document.getElementById('selection-info');
  const settingsBtn = document.getElementById('open-settings');
  const puzzleGrid = document.getElementById('puzzle-grid');

  // Zeige Query-Parameter (difficulty, size) falls vorhanden
  const params = new URLSearchParams(window.location.search);
  const difficulty = params.get('difficulty');
  const size = parseInt(params.get('size') || '0', 10);
  if (difficulty || size) {
    info.textContent = `Schwierigkeit: ${difficulty || '-'} · Größe: ${size || '-'} `;
  }

  // Default: sichtbare Thumbs
  let visibleCount = parseInt(localStorage.getItem('visibleThumbCount') || '8', 10);

  /**
   * Setzt die gewünschte Anzahl gleichzeitig sichtbarer Thumbnails und aktualisiert die CSS-Variable.
   * @param {number} n - Anzahl der angezeigten Thumbs
   */
  function applyVisibleCount(n) {
    visibleCount = Number(n) || 8;
    const container = document.querySelector('.thumbs-container');
    if (container) container.style.setProperty('--visible-count', visibleCount);
    adjustThumbSizes();
  }

  /**
   * Berechnet die Thumbnail-Abmessungen anhand der Containerbreite und passt jedes Thumbnail an.
   */
  function adjustThumbSizes() {
    const container = document.querySelector('.thumbs-container');
    if (!container) return;
    const thumbsEl = document.getElementById('thumbs');
    const available = container.clientWidth;
    const gap = 8;
    const thumbWidth = Math.floor((available - (visibleCount - 1) * gap) / visibleCount);
    Array.from(thumbsEl.children).forEach(t => {
      t.style.width = thumbWidth + 'px';
      t.style.height = Math.round(thumbWidth * 0.66) + 'px';
    });
  }

  applyVisibleCount(visibleCount);
  window.addEventListener('resize', () => adjustThumbSizes());

  /**
   * Scrollt die Thumbnail-Leiste um einen festen Schritt nach links/rechts.
   * @param {number} delta - 1 für rechts, -1 für links
   */
  function scrollThumbs(delta) {
    if (!thumbs) return;
    const container = thumbs.parentElement; // .thumbs-container
    const step = Math.max(80, container.clientWidth * 0.25);
    container.scrollBy({ left: delta * step, behavior: 'smooth' });
  }

  left.addEventListener('click', function () { scrollThumbs(-1); });
  right.addEventListener('click', function () { scrollThumbs(1); });

  left.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); scrollThumbs(-1); } });
  right.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); scrollThumbs(1); } });

  // --- Einstellungen Modal Logik ---
  const settingsModalEl = document.getElementById('settingsModal');
  let settingsModal = null;
  if (settingsModalEl && typeof bootstrap !== 'undefined') {
    settingsModal = new bootstrap.Modal(settingsModalEl, { keyboard: true });
  }

  if (settingsBtn && settingsModal) {
    settingsBtn.addEventListener('click', () => settingsModal.show());
  }

  // Sieg Logik
  const victoryModalEl = document.getElementById('victoryModal');
  let victoryModal = null;
  let victoryShown = false;
  if (victoryModalEl && typeof bootstrap !== 'undefined') {
    // verhindere Schließen durch Klick außerhalb oder Escape
    victoryModal = new bootstrap.Modal(victoryModalEl, { keyboard: false, backdrop: 'static' });
  }

  const victoryNextBtn = document.getElementById('victory-next-btn');
  if (victoryNextBtn) {
    victoryNextBtn.addEventListener('click', () => {
      // clear current puzzle data so the next config starts clean
      try { localStorage.removeItem(PIECES_KEY); localStorage.removeItem(PLACEMENTS_KEY); } catch (e) {}
      window.location.href = 'configGame.html';
    });
  }

  // Count buttons
  const countButtons = Array.from(document.querySelectorAll('.count-btn'));
  function updateCountSelectionUI(selected) {
    countButtons.forEach(b => {
      if (b.getAttribute('data-count') === String(selected)) b.classList.add('selected'); else b.classList.remove('selected');
    });
  }

  countButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-count');
      updateCountSelectionUI(val);
      applyVisibleCount(Number(val));
    });
  });

  if (settingsModalEl) {
    settingsModalEl.addEventListener('show.bs.modal', () => {
      const saved = localStorage.getItem('visibleThumbCount') || String(visibleCount);
      updateCountSelectionUI(saved);
      applyVisibleCount(Number(saved));
    });
  }

  const saveBtn = document.getElementById('save-settings');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      localStorage.setItem('visibleThumbCount', String(visibleCount));
      if (settingsModal) settingsModal.hide();
    });
  }

  const restartBtn = document.getElementById('restart-btn');
  if (restartBtn) restartBtn.addEventListener('click', () => {
    // Leere alle Placements so, dass alle Teile zurück in die Thumbnail-Liste gelangen.
    const n = (size && Number(size) > 0) ? Number(size) : (pieces && pieces.length) ? pieces.length : FALLBACK_PIECE_COUNT;
    const empty = Array(n).fill(null);
    setPlacements(empty);
    // UI aktualisieren
    renderPieceThumbs();
    createGrid(n);
    // Hinweis: wir schließen das Modal nicht automatisch, damit der Nutzer ggf. weitermachen kann.
  });

  const nextPuzzleBtn = document.getElementById('next-puzzle-btn');
  if (nextPuzzleBtn) {
    nextPuzzleBtn.addEventListener('click', () => {
      // Weiterleitung zur Konfigurationsseite für ein neues Puzzle
      window.location.href = 'configGame.html';
    });
  }

  // --- Puzzelteile Logik ---
  const PIECES_KEY = 'puzzlePieces';
  const PLACEMENTS_KEY = 'puzzlePlacements';

  // Lade gespeicherte Teile aus localStorage
  let pieces = [];
  try {
    const json = localStorage.getItem(PIECES_KEY);
    console.debug('playZone: raw puzzlePieces json length=', json ? json.length : 0);
    const parsed = json ? JSON.parse(json) : [];
    if (!Array.isArray(parsed)) console.debug('playZone: parsed puzzlePieces is not array, type=', typeof parsed);
    pieces = Array.isArray(parsed) ? parsed : [];
  } catch (err) { pieces = []; console.error('playZone: error parsing puzzlePieces from localStorage', err); }

  console.debug('playZone: loaded puzzlePieces from localStorage, count=', pieces.length);

  const FALLBACK_PIECE_COUNT = 9; // 3x3 Standard, falls nichts konfiguriert ist
  let targetPiecesCount = (size && Number(size) > 0) ? Number(size) : (pieces && pieces.length) ? pieces.length : FALLBACK_PIECE_COUNT;
  if (targetPiecesCount < 1) targetPiecesCount = FALLBACK_PIECE_COUNT;

  /**
   * Erzeugt SVG-Platzhalter für fehlende Puzzleteile (Debug/Offline-Fallback).
   * @param {number} n - Anzahl gewünschter Platzhalter
   * @returns {string[]} Data-URLs der generierten Platzhalter
   */
  function createPlaceholderPieces(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const w = 240, h = 160;
      const bgHue = Math.floor((i * 137) % 360); // varied colors
      const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>` +
                  `<rect width='100%' height='100%' fill='hsl(${bgHue} 60% 70%)'/>` +
                  `<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='36' fill='#333' font-family='Arial, sans-serif'>Teil ${i+1}</text>` +
                  `</svg>`;
      const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      out.push(dataUrl);
    }
    return out;
  }

  // wenn keine Teile vorhanden sind und Größe definiert ist, generiere Platzhalter-Teile
  if ((!pieces || pieces.length === 0)) {
    console.debug('No pieces found; generating', targetPiecesCount, 'placeholder pieces');
    pieces = createPlaceholderPieces(targetPiecesCount);
    try {
      localStorage.setItem(PIECES_KEY, JSON.stringify(pieces));
      // lösche alte Placements
      localStorage.removeItem(PLACEMENTS_KEY);
    } catch (e) { console.error('Failed to save placeholder pieces to localStorage', e); }
  } else if (pieces.length < targetPiecesCount) {
    // Wenn weniger Teile als Zielanzahl vorhanden sind, passe die Zielanzahl an
    targetPiecesCount = pieces.length;
  }

  // Fallback-Objekt für Drag-Informationen
  let currentDrag = null;

  //  Placements storage Hilfsfunktionen
  /**
   * Liest den aktuellen Placement-Zustand aus localStorage.
   * @returns {(string|null)[]} Array mit Data-URLs pro Zelle oder leerem Array
   */
  function getPlacements() {
    let placements;
    try { placements = JSON.parse(localStorage.getItem(PLACEMENTS_KEY) || '[]'); } catch (e) { placements = []; }
    return Array.isArray(placements) ? placements : [];
  }

  /**
   * Persistiert die übergebenen Placements und triggert eine Siegprüfung.
   * @param {(string|null)[]} arr - Placement-Array in Grid-Reihenfolge
   */
  function setPlacements(arr) {
    localStorage.setItem(PLACEMENTS_KEY, JSON.stringify(arr));
    try { checkSolved(); } catch (e) { console.error('checkSolved failed', e); }
  }

  /**
   * Prüft, ob alle Zellen korrekt belegt sind und öffnet ggf. den Gewinn-Dialog.
   * @returns {boolean} true, wenn gelöst
   */
  function checkSolved() {
    if (!pieces || !pieces.length) return false;
    const placements = getPlacements();
    if (!Array.isArray(placements) || placements.length !== pieces.length) return false;
    for (let i = 0; i < pieces.length; i++) {
      if (!placements[i]) return false;
      if (placements[i] !== pieces[i]) return false;
    }
    // all match
    if (victoryModal && !victoryShown) {
      victoryShown = true;
      try { victoryModal.show(); } catch (e) { alert('Herzlichen Glückwunsch! Puzzle gelöst.'); }
    }
    return true;
  }

  // Touch Drag-and-Drop Hilfsfunktionen
  const touchState = {
    active: false,
    id: null,
    startX: 0,
    startY: 0,
    dragging: false,
    from: null,
    pieceIndex: null,
    cellIndex: null,
    sourceEl: null,
    ghost: null
  };

  // Erstelle ein Ghost-Element für das Touch-Dragging
  /**
   * Erzeugt ein halbtransparentes Ghost-Image für Touch-Dragging.
   * @param {string} src - Bildquelle/Data-URL
   * @param {number} x - Start-X auf dem Screen
   * @param {number} y - Start-Y auf dem Screen
   */
  function createTouchGhost(src, x, y) {
    removeTouchGhost();
    if (!src) return;
    const img = document.createElement('img');
    img.src = src;
    img.className = 'drag-ghost';
    img.style.left = (x - 40) + 'px';
    img.style.top = (y - 40) + 'px';
    document.body.appendChild(img);
    img.onload = () => {
      img.style.left = (x - img.width / 2) + 'px';
      img.style.top = (y - img.height / 2) + 'px';
    };
    touchState.ghost = img;
  }

  /**
   * Aktualisiert die Position des Ghost-Elements während des Dragging.
   */
  function moveTouchGhost(x, y) {
    if (!touchState.ghost) return;
    touchState.ghost.style.left = (x - touchState.ghost.width / 2) + 'px';
    touchState.ghost.style.top = (y - touchState.ghost.height / 2) + 'px';
  }

  /**
   * Entfernt das Ghost-Element aus dem DOM.
   */
  function removeTouchGhost() {
    if (touchState.ghost && touchState.ghost.parentNode) {
      touchState.ghost.parentNode.removeChild(touchState.ghost);
    }
    touchState.ghost = null;
  }

  /**
   * Entfernt alle aktiven Drop-Highlight-Klassen.
   */
  function clearDropTargets() {
    document.querySelectorAll('.puzzle-cell.drop-target, #thumbs.drop-target, .thumbs-container.drop-target').forEach(el => el.classList.remove('drop-target'));
  }

  /**
   * Bestimmt die Puzzle-Zelle unter einer Bildschirmkoordinate.
   * @param {number} x
   * @param {number} y
   * @returns {HTMLElement|null} Gefundene Zelle oder null
   */
  function findCellFromPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    return el.closest('.puzzle-cell');
  }

  /**
   * Prüft, ob eine Bildschirmkoordinate über dem Thumbnails-Bereich liegt.
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  function isOverThumbsArea(x, y) {
    let el = document.elementFromPoint(x, y);
    if (!el) return false;
    return !!el.closest('#thumbs') || !!el.closest('.thumbs-container');
  }

  /**
   * Kern-Drop-Logik für Mouse/Touch: setzt oder tauscht Teile im Grid.
   * @param {Object} params
   * @param {'thumbs'|'grid'} params.from - Quelle des Dragging
   * @param {number} params.pieceIndex - Index des gezogenen Teils
   * @param {number|null} params.sourceCellIndex - Ursprungszelle (nur bei Grid)
   * @param {HTMLElement} params.targetCellEl - Zielzelle
   */
  function performDropLogic({ from, pieceIndex, sourceCellIndex, targetCellEl }) {
    const n = (size && Number(size) > 0) ? Number(size) : (pieces && pieces.length) ? pieces.length : 0;
    if (!targetCellEl) return;
    const targetIdx = parseInt(targetCellEl.getAttribute('data-cell-index'), 10);
    if (isNaN(targetIdx)) return;
    let placements = getPlacements();
    if (from === 'thumbs') {
      placements[targetIdx] = pieces[pieceIndex];
    } else if (from === 'grid') {
      const sourceIdx = Number.isFinite(sourceCellIndex) ? sourceCellIndex : null;
      if (sourceIdx !== null && !isNaN(sourceIdx) && sourceIdx !== targetIdx) {
        const temp = placements[targetIdx];
        placements[targetIdx] = placements[sourceIdx];
        placements[sourceIdx] = temp;
      }
    }
    setPlacements(placements);
    renderPieceThumbs();
    createGrid(n);
  }

  /**
   * Initialisiert Touch-Dragging-Status für Thumbs oder Grid-Zellen.
   * @param {TouchEvent} e
   * @param {'thumbs'|'grid'} from - Quelle
   * @param {number} pieceIndex - Index im pieces-Array
   * @param {number|null} cellIndex - Grid-Zellenindex (bei Quelle Grid)
   * @param {HTMLElement} sourceEl - Element, das den Drag auslöste
   */
  function handleTouchStartGeneric(e, from, pieceIndex, cellIndex, sourceEl) {
    if (!e || !e.changedTouches) return;
    if (e.changedTouches.length > 1) return; // ignore multi-touch
    const t = e.changedTouches[0];
    touchState.active = true;
    touchState.id = t.identifier;
    touchState.startX = t.clientX;
    touchState.startY = t.clientY;
    touchState.dragging = false;
    touchState.from = from;
    touchState.pieceIndex = pieceIndex;
    touchState.cellIndex = (typeof cellIndex !== 'undefined') ? cellIndex : null;
    touchState.sourceEl = sourceEl;
    createTouchGhost((from === 'thumbs') ? pieces[pieceIndex] : (pieces[pieceIndex] || null), t.clientX, t.clientY);

    document.addEventListener('touchmove', touchMoveHandler, { passive: false });
    document.addEventListener('touchend', touchEndHandler);
    document.addEventListener('touchcancel', touchEndHandler);
  }

  /**
   * Touch-Move-Handler: aktiviert Dragging nach kurzer Distanz und markiert mögliche Drop-Ziele.
   */
  function touchMoveHandler(e) {
    if (!touchState.active) return;
    let t = null;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchState.id) { t = e.changedTouches[i]; break; }
    }
    if (!t) return;
    const dx = t.clientX - touchState.startX;
    const dy = t.clientY - touchState.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (!touchState.dragging && dist > 8) {
      touchState.dragging = true;
      if (touchState.sourceEl) touchState.sourceEl.classList.add('touch-dragging');
      clearDropTargets();
    }
    if (touchState.dragging) {
      e.preventDefault(); // prevent scroll while dragging
      moveTouchGhost(t.clientX, t.clientY);
      clearDropTargets();
      const cell = findCellFromPoint(t.clientX, t.clientY);
      if (cell) cell.classList.add('drop-target');
      if (isOverThumbsArea(t.clientX, t.clientY)) {
        if (thumbs) thumbs.classList.add('drop-target');
        if (thumbsContainer) thumbsContainer.classList.add('drop-target');
      }
    }
  }

  /**
   * Touch-End-Handler: führt Drop-Logik aus oder triggert Klick bei kurzem Tipp.
   */
  function touchEndHandler(e) {
    if (!touchState.active) return;
    let t = null;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchState.id) { t = e.changedTouches[i]; break; }
    }
    if (!t) return;

    if (!touchState.dragging) {
      if (touchState.sourceEl && typeof touchState.sourceEl.click === 'function') {
        touchState.sourceEl.click();
      }
    } else {
      const x = t.clientX; const y = t.clientY;
      const targetCell = findCellFromPoint(x, y);
      // Drop auf Zelle
      if (targetCell) {
        performDropLogic({ from: touchState.from, pieceIndex: touchState.pieceIndex, sourceCellIndex: touchState.cellIndex, targetCellEl: targetCell });
      } else if (isOverThumbsArea(x, y)) {
        // Drop auf Thumbs-Bereich: nur Rückgabe ins Lager bei from='grid'
        if (touchState.from === 'grid') {
          let placements = getPlacements();
          const idx = touchState.cellIndex;
          if (!isNaN(idx) && placements[idx]) {
            placements[idx] = null;
            setPlacements(placements);
            setTimeout(() => {
              renderPieceThumbs();
              const nAfter = (size && Number(size) > 0) ? Number(size) : (pieces && pieces.length) ? pieces.length : 0;
              createGrid(nAfter);
            }, 0);
          }
        }
      }
    }

    // Cleanup
    clearDropTargets();
    if (touchState.sourceEl) touchState.sourceEl.classList.remove('touch-dragging');
    removeTouchGhost();
    touchState.active = false;
    touchState.id = null;
    touchState.dragging = false;
    touchState.from = null;
    touchState.pieceIndex = null;
    touchState.cellIndex = null;
    touchState.sourceEl = null;

    document.removeEventListener('touchmove', touchMoveHandler, { passive: false });
    document.removeEventListener('touchend', touchEndHandler);
    document.removeEventListener('touchcancel', touchEndHandler);
  }

  // generiere das Puzzle-Grid
  /**
   * Baut das Puzzle-Grid neu auf und synchronisiert Drag-/Drop-Handler pro Zelle.
   * @param {number} n - Anzahl der erwarteten Teile
   */
  function createGrid(n) {
    console.debug('createGrid called with n=', n, 'pieces.length=', pieces.length);
    if (!puzzleGrid) return;
    puzzleGrid.innerHTML = '';
    if (!n || n <= 0) {
      puzzleGrid.style.gridTemplateColumns = '1fr';
      puzzleGrid.innerHTML = '<div class="puzzle-cell placeholder"></div>';
      return;
    }
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);

    // responsive grid und rows
    puzzleGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    puzzleGrid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

    // Lade Placements
    let placements = getPlacements();
    console.debug('createGrid: placements length=', placements.length, 'placements sample=', placements.slice(0,5));
    if (!Array.isArray(placements) || placements.length !== n) {
      placements = Array(n).fill(null);
      setPlacements(placements);
    }


    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (idx >= n) break;
        const cell = document.createElement('div');
        cell.className = 'puzzle-cell placeholder';
        cell.setAttribute('data-cell-index', idx);
        cell.setAttribute('role', 'gridcell');
        // remove explicit width/height so CSS controls sizing
        // Nur belegte Zellen sind draggable
        const placed = placements[idx];
        if (placed) {
          // make the cell itself draggable so dragging from different targets works
          cell.setAttribute('draggable', 'true');
          const img = document.createElement('img');
          img.src = placed;
          img.setAttribute('draggable', 'true');
          // ensure image fills cell but doesn't change layout
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'cover';
          cell.appendChild(img);
          cell.classList.remove('placeholder');

          // ensure dragging the image (not only the cell) works
          img.addEventListener('dragstart', function (e) {
            console.debug('img dragstart idx=', idx);
            const pIdx = pieces.indexOf(placed);
            // set fallback
            currentDrag = { from: 'grid', pieceIndex: pIdx, cellIndex: idx };
            e.dataTransfer.setData('text/plain', String(pIdx));
            e.dataTransfer.setData('from', 'grid');
            e.dataTransfer.setData('cell-index', String(idx));
            e.dataTransfer.effectAllowed = 'move';
            try { e.dataTransfer.dropEffect = 'move'; } catch (err) { /* ignore */ }
            try { e.dataTransfer.setDragImage(img, img.width/2, img.height/2); } catch (err) { /* ignore */ }
            cell.classList.add('dragging');
          });
          img.addEventListener('dragend', function (e) { console.debug('img dragend idx=', idx, 'effect=', e.dataTransfer && e.dataTransfer.dropEffect); cell.classList.remove('dragging'); currentDrag = null; });

          // touchstart fallback for touch devices
          img.addEventListener('touchstart', function (ev) {
            const pIdx = pieces.indexOf(placed);
            handleTouchStartGeneric(ev, 'grid', pIdx, idx, cell);
          }, { passive: true });
        }

        // debug: dragging über thumbs container/log
        if (thumbsContainer) {
          thumbsContainer.addEventListener('dragenter', (e) => { console.debug('dragenter thumbsContainer'); });
        }
        if (thumbs) {
          thumbs.addEventListener('dragenter', (e) => { console.debug('dragenter thumbs'); });
        }

        // drag über handlers
        cell.addEventListener('dragover', (e) => { e.preventDefault(); cell.classList.add('drop-target'); });
        cell.addEventListener('dragleave', () => { cell.classList.remove('drop-target'); });
        cell.addEventListener('drop', (e) => {
          e.preventDefault();
          cell.classList.remove('drop-target');
          const pieceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
          const from = e.dataTransfer.getData('from');
          if (isNaN(pieceIndex) || !pieces[pieceIndex]) return;
          let placements = getPlacements();
          const targetIdx = idx;
          if (from === 'thumbs') {
            // Aus der Leiste ins Grid
            placements[targetIdx] = pieces[pieceIndex];
          } else if (from === 'grid') {
            // Tausch zwischen Zellen
            const sourceIdx = parseInt(e.dataTransfer.getData('cell-index'), 10);
            if (!isNaN(sourceIdx) && sourceIdx !== targetIdx) {
              const temp = placements[targetIdx];
              placements[targetIdx] = placements[sourceIdx];
              placements[sourceIdx] = temp;
            }
          }
          setPlacements(placements);
          renderPieceThumbs();
          createGrid(n);
        });

        // Dragstart für Grid-Zellen (nur wenn belegt)
        cell.addEventListener('dragstart', (e) => {
          const placements = getPlacements();
          if (placements[idx]) {
            console.debug('cell dragstart idx=', idx);
            const pIdx = pieces.indexOf(placements[idx]);
            currentDrag = { from: 'grid', pieceIndex: pIdx, cellIndex: idx };
            e.dataTransfer.setData('text/plain', String(pIdx));
            e.dataTransfer.setData('from', 'grid');
            e.dataTransfer.setData('cell-index', String(idx));
            e.dataTransfer.effectAllowed = 'move';
            try { e.dataTransfer.dropEffect = 'move'; } catch (err) { /* ignore */ }
            cell.classList.add('dragging');
          } else {
            e.preventDefault();
          }
        });
        cell.addEventListener('dragend', (e) => { console.debug('cell dragend idx=', idx); cell.classList.remove('dragging'); currentDrag = null; });

        // Klick auf belegte Zelle: Teil zurück in die Leiste
        cell.addEventListener('click', () => {
          let placements = getPlacements();
          if (placements[idx]) {
            placements[idx] = null;
            setPlacements(placements);
            renderPieceThumbs();
            createGrid(n);
          }
        });
        // Doppelklick bleibt als Alternative (gleiches Verhalten)
        cell.addEventListener('dblclick', () => {
          let placements = getPlacements();
          if (placements[idx]) {
            placements[idx] = null;
            setPlacements(placements);
            renderPieceThumbs();
            createGrid(n);
          }
        });

        puzzleGrid.appendChild(cell);
      }
    }
  }

  /**
   * Rendert alle noch nicht platzierten Teile als Thumbnails und mischt die Reihenfolge.
   */
  function renderPieceThumbs() {
    if (!thumbs) return;
    thumbs.innerHTML = '';
    // Zeige nur nicht platzierte Teile
    const placements = getPlacements();
    console.debug('renderPieceThumbs: pieces.length=', pieces.length, 'placements.length=', placements.length);

    // Sammle unplatzierte Teile
    const unplaced = [];
    pieces.forEach((dataUrl, idx) => {
      if (!placements.includes(dataUrl)) unplaced.push({ dataUrl, idx });
    });

    // shuffel
    for (let i = unplaced.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = unplaced[i]; unplaced[i] = unplaced[j]; unplaced[j] = tmp;
    }

    // Render die gemischte Liste
    unplaced.forEach(({ dataUrl, idx }) => {
      const el = document.createElement('div');
      el.className = 'thumb';
      el.setAttribute('draggable', 'true');
      el.setAttribute('data-piece-index', idx);

      const img = document.createElement('img');
      img.src = dataUrl;
      img.alt = `Teil ${idx + 1}`;
      el.appendChild(img);

      // dragstart
      el.addEventListener('dragstart', (e) => {
        currentDrag = { from: 'thumbs', pieceIndex: idx };
        e.dataTransfer.setData('text/plain', String(idx));
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('from', 'thumbs');
      });
      el.addEventListener('dragend', () => { currentDrag = null; });

      // touchstart for thumbs
      el.addEventListener('touchstart', function (ev) {
        handleTouchStartGeneric(ev, 'thumbs', idx, null, el);
      }, { passive: true });

      thumbs.appendChild(el);
    });

    adjustThumbSizes();
  }

  // inistialisiere das Grid und die Thumbnails
   const initialN = targetPiecesCount;
   console.debug('playZone:init', { sizeParam: size, piecesLength: pieces.length, initialN });
   if (!puzzleGrid) console.warn('playZone: puzzleGrid element not found');
   if (!thumbs) console.warn('playZone: thumbs element not found');
   createGrid(initialN);
   renderPieceThumbs();
  (function () {
    try {
      checkSolved();
    } catch (e) {
      console.error('initial checkSolved failed', e);
    }
  })();

  // Ermögliche Drop auf die Thumbs-Leiste, um Teile aus dem Grid zurückzuholen
  /**
   * Ermöglicht Drop zurück in die Thumbnail-Leiste, um Grid-Zellen zu leeren.
   * @param {DragEvent} e
   */
  function handleThumbsDrop(e) {
    e.preventDefault();
    if (thumbs) thumbs.classList.remove('drop-target');
    if (thumbsContainer) thumbsContainer.classList.remove('drop-target');
    let from = e.dataTransfer.getData('from') || (currentDrag && currentDrag.from);
    let cellIdx = parseInt(e.dataTransfer.getData('cell-index'), 10);
    if ((cellIdx === undefined || isNaN(cellIdx)) && currentDrag) cellIdx = currentDrag.cellIndex;
    console.debug('thumbs drop, from=', from, 'cellIdx=', cellIdx, 'currentDrag=', currentDrag);
    if (from === 'grid') {
      let placements = getPlacements();
      if (!isNaN(cellIdx) && placements[cellIdx]) {
        placements[cellIdx] = null;
        setPlacements(placements);
        setTimeout(() => {
          renderPieceThumbs();
          const nAfter = (size && Number(size) > 0) ? Number(size) : (pieces && pieces.length) ? pieces.length : 0;
          createGrid(nAfter);
        }, 0);
      }
    }
  }

  // Debugging Drag Events auf Dokument-Ebene
  document.addEventListener('dragstart', (e) => { console.debug('document dragstart event, target=', e.target); });
  document.addEventListener('dragend', (e) => { console.debug('document dragend event, target=', e.target); });

  if (thumbs) {
    thumbs.addEventListener('dragover', (e) => { e.preventDefault(); thumbs.classList.add('drop-target'); });
    thumbs.addEventListener('dragleave', () => { thumbs.classList.remove('drop-target'); });
    thumbs.addEventListener('drop', (e) => { e.preventDefault(); handleThumbsDrop(e); });
    thumbs.addEventListener('dragenter', (e) => { console.debug('thumbs dragenter'); });
  }
  if (thumbsContainer) {
    thumbsContainer.addEventListener('dragover', (e) => { e.preventDefault(); thumbsContainer.classList.add('drop-target'); });
    thumbsContainer.addEventListener('dragleave', () => { thumbsContainer.classList.remove('drop-target'); });
    thumbsContainer.addEventListener('drop', (e) => { e.preventDefault(); handleThumbsDrop(e); });
    thumbsContainer.addEventListener('dragenter', (e) => { console.debug('thumbsContainer dragenter'); });
  }

});
