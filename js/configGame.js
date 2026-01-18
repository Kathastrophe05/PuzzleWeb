// JS für configGame.html: Auswahllogik und Start-Weiterleitung
/**
 * JS für configGame.html: Auswahllogik und Start-Weiterleitung
 *
 * Funktionen:
 * - Auswahl der Puzzle-Größe (Anzahl Teile)
 * - Bild-Upload und Zerschneiden in Teile via ImageSlicer
 * - Start-Button: Validierung, Speichern der Teile in localStorage, Weiterleitung mit Query-Parametern
 *
 * Hinweise:
 * - Benötigt ImageSlicer (js/imageSlicer.js) für Bild-Zerschneidung
 * - Speichert die Bildteile in localStorage unter 'puzzlePieces'
 * - Query-Parameter: size (Anzahl Teile)
 */
document.addEventListener('DOMContentLoaded', function () {
  let selectedSize = null;

  const sizeButtons = Array.from(document.querySelectorAll('.size-btn'));
  const startButton = document.getElementById('start-game');

  const imageInput = document.getElementById('image-upload');
  const imagePreview = document.getElementById('image-preview');
  const imageFeedback = document.getElementById('image-feedback');
  let uploadedImage = null; // Image DataURL

  const MAX_FILE_SIZE = 6 * 1024 * 1024; // 6MB Schutz für localStorage

  /** setze Feedback-Nachricht für Bild-Upload
   * @param {string} msg - Nachricht
   * @param {boolean} isError - ob es sich um eine Fehlermeldung handelt
   * */
  function setFeedback(msg, isError = false) {
    if (!imageFeedback) return;
    imageFeedback.textContent = msg;
    imageFeedback.classList.toggle('text-danger', isError);
    imageFeedback.classList.toggle('text-muted', !isError);
  }

    /** Berechne ein Raster (cols, rows) für n Teile
     * @param {number} n - Anzahl der Teile
     * @returns {{cols: number, rows: number}} - Spalten und Reihen
     * */
  function gridFromCount(n) {
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    return { cols, rows };
  }

    /** Aktualisiere aria-pressed Attribute für Button-Gruppe
     * @param {HTMLElement[]} group - Array von Buttons
     * */
  function updateAriaPressed(group) {
    group.forEach(btn => {
      btn.setAttribute('aria-pressed', btn.classList.contains('selected'));
    });
  }

  /** Größe-Auswahl-Buttons */
  sizeButtons.forEach(btn => {
    btn.addEventListener('click', function () {
      sizeButtons.forEach(b => b.classList.remove('selected'));
      this.classList.add('selected');
      selectedSize = this.getAttribute('data-size');
      updateAriaPressed(sizeButtons);
    });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.click();
      }
    });
  });

    /** Bild-Upload und Vorschau */
  if (imageInput) {
    imageInput.addEventListener('change', function (e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (!file.type || !file.type.startsWith('image/')) {
        setFeedback('Bitte ein Bildformat wählen (png/jpg/webp).', true);
        imageInput.value = '';
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setFeedback('Bild ist groß – wird zugeschnitten und verkleinert.', false);
      } else {
        setFeedback('Bild geladen. Passt nicht? Wir schneiden es passend zu.', false);
      }
      const reader = new FileReader();
      reader.onload = function (ev) {
        uploadedImage = ev.target.result; // Data URL
        if (imagePreview) {
          imagePreview.src = uploadedImage;
          imagePreview.style.display = 'block';
        }
      };
      reader.readAsDataURL(file);
    });
  }

  // entferne alte Daten im localStorage
  startButton.addEventListener('click', async function () {
    if (!selectedSize) {
      startButton.classList.add('invalid');
      setTimeout(() => startButton.classList.remove('invalid'), 400);
      return;
    }

    // Wenn ein Bild hochgeladen wurde, slice es mit ImageSlicer und speichere die Pieces in localStorage
    if (uploadedImage) {
      try {
        const n = parseInt(selectedSize, 10) || 1;
        const grid = gridFromCount(n);
        const sliceOptions = { mime: 'image/png', maxSide: 1200, stretchToRatio: true, targetRatio: grid.cols / grid.rows };
        if (window.ImageSlicer && typeof window.ImageSlicer.sliceImageToPieces === 'function') {
          const pieces = await window.ImageSlicer.sliceImageToPieces(uploadedImage, n, sliceOptions);
          localStorage.setItem('puzzlePieces', JSON.stringify(pieces));
          localStorage.removeItem('puzzlePlacements');
          setFeedback('Bild wurde zugeschnitten und in Teile zerlegt.', false);
        } else {
          if (typeof sliceImageGrid === 'function') {
            const pieces = await sliceImageGrid(uploadedImage, n);
            localStorage.setItem('puzzlePieces', JSON.stringify(pieces));
            localStorage.removeItem('puzzlePlacements');
          } else {
            console.warn('No ImageSlicer available and no fallback slicing function found.');
            setFeedback('Fehler: Kein Bild-Zuschnitt verfügbar.', true);
          }
        }
      } catch (err) {
        console.error('Fehler beim Zerteilen des Bildes', err);
        const errorDetail = err && err.message ? ': ' + err.message : '';
        setFeedback('Das Bild konnte nicht verarbeitet werden' + errorDetail, true);
      }
    } else {
      // Keinen Upload: entferne ggf. vorhandene pieces
      localStorage.removeItem('puzzlePieces');
      localStorage.removeItem('puzzlePlacements');
    }

    // Weiterleitung mit Query-Parametern (nur size)
    const params = new URLSearchParams({ size: selectedSize });
    window.location.href = 'playZone.html?' + params.toString();
  });

});
