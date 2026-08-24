/* LIFE OS — allow explicitly re-saving an activity that was deleted before. */
(() => {
  const DELETED_SAVED_KEY = 'life-os-v1-deleted-saved-activities';
  const savedKey = (value) => String(value ?? '').trim().toLowerCase();

  function clearDeletedMarker(name) {
    const key = savedKey(name);
    if (!key) return;
    try {
      const raw = localStorage.getItem(DELETED_SAVED_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed) || !parsed.length) return;
      const next = parsed.map(savedKey).filter(Boolean).filter((item) => item !== key);
      if (next.length !== parsed.length) {
        localStorage.setItem(DELETED_SAVED_KEY, JSON.stringify(next));
      }
    } catch {}
  }

  document.addEventListener('click', (event) => {
    const saveButton = event.target.closest?.('[data-tracker-action="save-normal"]');
    if (!saveButton) return;
    const saveView = saveButton.closest('.life-tracker-save') || document;
    const name = saveView.querySelector?.('.orb-title')?.textContent?.trim();
    clearDeletedMarker(name);
  }, true);
})();
