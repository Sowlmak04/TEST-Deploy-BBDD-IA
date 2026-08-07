// ---------- Acciones rápidas de progreso ----------
function refreshProgressViews() {
  renderPendientes("series");

  const summary = document.querySelector('.screen[data-screen="resumen-home"].active');
  if (summary && typeof renderStatisticsDashboard === "function") {
    renderStatisticsDashboard();
  }
}

document.addEventListener("click", event => {
  const button = event.target.closest("[data-progress-action]");
  if (!button) return;

  event.preventDefault();
  event.stopPropagation();

  const id = button.dataset.progressId;
  const action = button.dataset.progressAction;
  if (!id || !action) return;

  if (action === "advance" || action === "back") {
    const updated = action === "advance"
      ? SeriesProgressService.advance(id)
      : SeriesProgressService.back(id);

    if (updated) {
      showToast(`Progreso: T${updated.currentSeason} · E${updated.currentEpisode}`);
      refreshProgressViews();
    }
    return;
  }

  if (action === "finish" && typeof window.openSeriesCompletion === "function") {
    window.openSeriesCompletion(id);
  }
});