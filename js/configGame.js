// JS für configGame.html: Auswahllogik und Start-Weiterleitung

document.addEventListener('DOMContentLoaded', function () {
  let selectedDifficulty = null;
  let selectedSize = null;

  const difficultyButtons = Array.from(document.querySelectorAll('.difficulty-btn'));
  const sizeButtons = Array.from(document.querySelectorAll('.size-btn'));
  const startButton = document.getElementById('start-game');

  const imageInput = document.getElementById('image-upload');
  const imagePreview = document.getElementById('image-preview');
  const imageFeedback = document.getElementById('image-feedback');
  let uploadedImage = null; // Image DataURL

  const MAX_FILE_SIZE = 6 * 1024 * 1024; // 6MB Schutz für localStorage

  function setFeedback(msg, isError = false) {
    if (!imageFeedback) return;
    imageFeedback.textContent = msg;
    imageFeedback.classList.toggle('text-danger', isError);
    imageFeedback.classList.toggle('text-muted', !isError);
  }

  function gridFromCount(n) {
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    return { cols, rows };
  }

  function updateAriaPressed(group) {
    group.forEach(btn => {
      btn.setAttribute('aria-pressed', btn.classList.contains('selected'));
    });
  }

  difficultyButtons.forEach(btn => {
    btn.addEventListener('click', function () {
      difficultyButtons.forEach(b => b.classList.remove('selected'));
      this.classList.add('selected');
      selectedDifficulty = this.getAttribute('data-difficulty');
      updateAriaPressed(difficultyButtons);
    });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.click();
      }
    });
  });

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

  // Image upload handling
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

  startButton.addEventListener('click', async function () {
    // Wenn keine Auswahl getroffen wurde, zeige eine kurze visuelle Rückmeldung
    if (!selectedDifficulty || !selectedSize) {
      // einfacher visueller Hinweis: kurz die Schaltfläche schütteln (CSS class)
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
        setFeedback('Das Bild konnte nicht verarbeitet werden.', true);
      }
    } else {
      // Keinen Upload: entferne ggf. vorhandene pieces
      localStorage.removeItem('puzzlePieces');
      localStorage.removeItem('puzzlePlacements');
    }

    // Weiterleitung mit Query-Parametern
    const params = new URLSearchParams({ difficulty: selectedDifficulty, size: selectedSize });
    window.location.href = 'playZone.html?' + params.toString();
  });

});
