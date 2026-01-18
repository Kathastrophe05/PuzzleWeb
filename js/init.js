// Initialisierungs-Skript für index.html

document.addEventListener('DOMContentLoaded', function () {
  try {
    const navLinks = Array.from(document.querySelectorAll('.navbar .nav-link'));

    // Wenn alle Links nur '#' sind, ändere nichts (vermeide unerwünschtes Entfernen von 'active')
    const allHashes = navLinks.length > 0 && navLinks.every(l => (l.getAttribute('href') || '').trim() === '#');
    if (!allHashes) {
      const currentHash = location.hash || '';
      const currentPath = location.pathname || '';

      navLinks.forEach(link => {
        const href = (link.getAttribute('href') || '').trim();
        // Normalfälle behandeln
        let isActive = false;
        if (href && href !== '#') {
          if (href === currentHash || href === currentPath) isActive = true;
          // falls href ein einfacher Dateiname oder Pfad ist, prüfen ob currentPath damit endet
          if (!isActive && href.length > 1 && currentPath.endsWith(href)) isActive = true;
        }
        if (isActive) link.classList.add('active'); else link.classList.remove('active');
      });
    }
  } catch (err) {
    console.error('Fehler beim Setzen der Navigation:', err);
  }

  // Bootstrap Tooltips initialisieren (falls Bootstrap geladen ist)
  try {
    if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
      var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
      tooltipTriggerList.map(function (el) {
        return new bootstrap.Tooltip(el);
      });
    }
  } catch (err) {
    console.error('Fehler beim Initialisieren der Tooltips:', err);
  }
});

