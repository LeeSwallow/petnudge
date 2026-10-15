// One shared tooltip for every element carrying `data-tip`.
export const installTooltip = () => {
  const tooltip = document.getElementById('tooltip')!;
  document.addEventListener('mouseover', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-tip]') : null;
    if (!target) {
      tooltip.hidden = true;
      return;
    }
    tooltip.textContent = target.getAttribute('data-tip');
    tooltip.hidden = false;
  });
  document.addEventListener('mousemove', (event) => {
    if (tooltip.hidden) return;
    const { width, height } = tooltip.getBoundingClientRect();
    const x = Math.min(window.innerWidth - width - 4, event.clientX + 12);
    const y = event.clientY - height - 10 < 0 ? event.clientY + 16 : event.clientY - height - 10;
    tooltip.style.left = `${Math.max(4, x)}px`;
    tooltip.style.top = `${y}px`;
  });
};
