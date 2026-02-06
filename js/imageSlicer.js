/**
 * Utility zum Zerschneiden eines PNG/JPEG (File oder DataURL) in N Teile (Raster) und Speichern der Teile.
 * Browser API stellt ein globales Objekt `ImageSlicer` bereit.
 *
 * Funktionen:
 *  - readFileAsDataURL(file): Promise<string>  // File -> DataURL
 *  - sliceImageToPieces(input, n, options): Promise<string[]> // input = DataURL or File
 *  - savePiecesToLocalStorage(key, pieces): boolean
 *  - loadPiecesFromLocalStorage(key): string[] | null
 *
 * Hinweise:
 *  - localStorage hat Speicherbegrenzungen (~5MB). Für große Bilder/Anzahlen wird empfohlen, IndexedDB zu verwenden.
 *  - Die Funktion versucht, n gleichmäßig verteilte Kacheln zu erzeugen (cols = ceil(sqrt(n)), rows = ceil(n/cols)).
 */

(function (global) {
  'use strict';

  const ImageSlicer = {};

  /**
   * Liest ein File-Objekt und gibt dessen Data-URL zurück.
   * @param {File} file
   * @returns {Promise<string>} Data-URL
   */
  ImageSlicer.readFileAsDataURL = function (file) {
    return new Promise((resolve, reject) => {
      if (!(file instanceof File)) return reject(new TypeError('Expected a File'));
      const reader = new FileReader();
      reader.onload = (e) => resolve(String(e.target.result));
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  };

  /**
   * Schneidet ein Bild (DataURL oder File) in n Teile und gibt ein Array von Data-URLs zurück.
   * Verwendet das gesamte Bild; falls das Seitenverhältnis vom Raster abweicht, wird das Bild gestreckt (kein Zuschneiden).
   * @param {string|File} input - dataURL string oder File
   * @param {number} n - gewünschte Anzahl von Teilen (positive Ganzzahl)
   * @param {{mime?: string, quality?: number, maxSide?: number, stretchToRatio?: boolean, targetRatio?: number}} [options]
   *        options.mime: 'image/png' (Standard) oder 'image/jpeg'
   *        options.quality: Zahl 0..1, verwendet für JPEG
   *        options.maxSide: maximale Breite/Höhe des verarbeiteten Bildes (skaliert bei größeren Bildern herunter)
   *        options.stretchToRatio: Bild non-uniform strecken, um targetRatio zu erreichen anstatt es zu beschneiden
   *        options.targetRatio: Breite/Höhe-Verhältnis, das beim Strecken erzwungen werden soll; standardmäßig das Rasterverhältnis
   * @returns {Promise<string[]>} - löst mit einem Array von Data-URLs auf, Länge === n (oder weniger bei Eingabefehlern)
   */
  ImageSlicer.sliceImageToPieces = async function (input, n, options) {
    if (!n || typeof n !== 'number' || n <= 0) throw new TypeError('n muss positive integer sein');
    options = Object.assign({ mime: 'image/png', quality: 0.92, maxSide: 1400, stretchToRatio: true, targetRatio: null }, options || {});

    let dataUrl = null;
    if (typeof input === 'string') {
      dataUrl = input;
    } else if (input instanceof File) {
      dataUrl = await ImageSlicer.readFileAsDataURL(input);
    } else {
      throw new TypeError('input muss DataURL string oder File sein');
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const w = img.naturalWidth;
          const h = img.naturalHeight;

          const cols = Math.ceil(Math.sqrt(n));
          const rows = Math.ceil(n / cols);
          const targetRatio = options.targetRatio || (cols / rows);

          const maxSide = Math.max(400, options.maxSide || 1400);
          const baseScale = Math.min(1, maxSide / Math.max(w, h));
          let targetW = Math.max(1, Math.round(w * baseScale));
          let targetH = Math.max(1, Math.round(h * baseScale));

          // strecken
          if (options.stretchToRatio && targetRatio > 0) {
            const currentRatio = targetW / targetH;
            if (Math.abs(currentRatio - targetRatio) > 0.01) {
              if (currentRatio > targetRatio) {
                targetW = Math.round(targetH * targetRatio);
              } else {
                targetH = Math.round(targetW / targetRatio);
              }
            }
          }

          const postMaxDim = Math.max(targetW, targetH);
          if (postMaxDim > maxSide) {
            const adjust = maxSide / postMaxDim;
            targetW = Math.max(1, Math.round(targetW * adjust));
            targetH = Math.max(1, Math.round(targetH * adjust));
          }

          const baseCanvas = document.createElement('canvas');
          baseCanvas.width = targetW;
          baseCanvas.height = targetH;
          const baseCtx = baseCanvas.getContext('2d');
          baseCtx.drawImage(img, 0, 0, w, h, 0, 0, targetW, targetH);

          const tileW = Math.floor(targetW / cols);
          const tileH = Math.floor(targetH / rows);

          const pieces = [];
          let count = 0;

          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              if (count >= n) break;
              const sxTile = c * tileW;
              const syTile = r * tileH;
              const sw = (c === cols - 1) ? (targetW - sxTile) : tileW;
              const sh = (r === rows - 1) ? (targetH - syTile) : tileH;

              const canvas = document.createElement('canvas');
              canvas.width = sw;
              canvas.height = sh;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(baseCanvas, sxTile, syTile, sw, sh, 0, 0, sw, sh);

              const data = canvas.toDataURL(options.mime, options.quality);
              pieces.push(data);
              count++;
            }
            if (count >= n) break;
          }

          resolve(pieces);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image for slicing'));
      img.src = dataUrl;
    });
  };

  /**
   * Speichert ein Array von Data-URLs unter dem angegebenen key in localStorage. Gibt true bei Erfolg zurück.
   * @param {string} key
   * @param {string[]} pieces
   * @returns {boolean}
   */
  ImageSlicer.savePiecesToLocalStorage = function (key, pieces) {
    try {
      const json = JSON.stringify(pieces);
      const bytes = new Blob([json]).size;
      const maxWarning = 3 * 1024 * 1024; // 3MB
      if (bytes > maxWarning) {
        console.warn(`Speichere Teile (~${Math.round(bytes / 1024)} KB) vieleicht zu groess fuer lokal storage.`);
      }
      localStorage.setItem(key, json);
      return true;
    } catch (err) {
      console.error('speichern fehlgeschlagen', err);
      return false;
    }
  };

  /**
   * Lädt das Array von Data-URLs aus localStorage unter key
   * @param {string} key
   * @returns {string[]|null}
   */
  ImageSlicer.loadPiecesFromLocalStorage = function (key) {
    try {
      const json = localStorage.getItem(key);
      if (!json) return null;
      return JSON.parse(json);
    } catch (err) {
      console.error('laden fehlgeschlagen', err);
      return null;
    }
  };

  // expose
  global.ImageSlicer = ImageSlicer;

})(window);
