/**
 * imageSlicer.js
 *
 * Utility zum Zerschneiden eines PNG/JPEG (File oder DataURL) in N Teile (Raster) und Speichern der Teile.
 * Browser-API (keine Module) - stellt ein globales Objekt `ImageSlicer` bereit.
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
   * Reads a File object as a Data URL.
   * @param {File} file
   * @returns {Promise<string>} Data URL
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
   * Slice an image (DataURL or File) into n pieces and return array of DataURLs.
   * Uses full image; if aspect differs from grid, it stretches to fit (no cropping).
   * @param {string|File} input - dataURL string or File
   * @param {number} n - desired number of pieces (positive integer)
   * @param {{mime?: string, quality?: number, maxSide?: number, stretchToRatio?: boolean, targetRatio?: number}} [options]
   *        options.mime: 'image/png' (default) or 'image/jpeg'
   *        options.quality: number 0..1 used for JPEG
   *        options.maxSide: max width/height of processed image (scales down if larger)
   *        options.stretchToRatio: stretch width/height to targetRatio instead of cropping
   *        options.targetRatio: width/height ratio to enforce when stretching; defaults to grid ratio
   * @returns {Promise<string[]>} - resolves to array of data URLs length === n (or less if input error)
   */
  ImageSlicer.sliceImageToPieces = async function (input, n, options) {
    if (!n || typeof n !== 'number' || n <= 0) throw new TypeError('n must be a positive integer');
    options = Object.assign({ mime: 'image/png', quality: 0.92, maxSide: 1400, stretchToRatio: true, targetRatio: null }, options || {});

    let dataUrl = null;
    if (typeof input === 'string') {
      dataUrl = input;
    } else if (input instanceof File) {
      dataUrl = await ImageSlicer.readFileAsDataURL(input);
    } else {
      throw new TypeError('input must be a DataURL string or a File');
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

          // Stretch (non-uniform) to reach grid ratio without cropping
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

          // Re-apply maxSide cap if stretching exceeded it
          const postMaxDim = Math.max(targetW, targetH);
          if (postMaxDim > maxSide) {
            const adjust = maxSide / postMaxDim;
            targetW = Math.max(1, Math.round(targetW * adjust));
            targetH = Math.max(1, Math.round(targetH * adjust));
          }

          // draw scaled (possibly stretched) canvas once, slice from it
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
   * Save array of dataURLs to localStorage under key. Returns true on success.
   * @param {string} key
   * @param {string[]} pieces
   * @returns {boolean}
   */
  ImageSlicer.savePiecesToLocalStorage = function (key, pieces) {
    try {
      const json = JSON.stringify(pieces);
      // quick size check (rough) - localStorage limits vary; alert developer if large
      const bytes = new Blob([json]).size;
      const maxWarning = 3 * 1024 * 1024; // 3MB
      if (bytes > maxWarning) {
        console.warn(`Saving pieces (~${Math.round(bytes / 1024)} KB) may exceed localStorage limits. Consider IndexedDB.`);
      }
      localStorage.setItem(key, json);
      return true;
    } catch (err) {
      console.error('Failed to save pieces to localStorage', err);
      return false;
    }
  };

  /**
   * Load pieces array from localStorage key
   * @param {string} key
   * @returns {string[]|null}
   */
  ImageSlicer.loadPiecesFromLocalStorage = function (key) {
    try {
      const json = localStorage.getItem(key);
      if (!json) return null;
      return JSON.parse(json);
    } catch (err) {
      console.error('Failed to load pieces from localStorage', err);
      return null;
    }
  };

  // expose
  global.ImageSlicer = ImageSlicer;

})(window);
