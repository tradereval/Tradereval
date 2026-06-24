export function renderComingSoon(container, title, description) {
  container.innerHTML = `
    <section class="card empty-state">
      <h2>${title}</h2>
      <p>${description}</p>
      <p class="muted">This module ships after the core 30-day simulation is complete.</p>
    </section>
  `;
}
