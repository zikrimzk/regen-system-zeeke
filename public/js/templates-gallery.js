const templateFilters = [...document.querySelectorAll('[data-template-filter]')];
const publicTemplates = [...document.querySelectorAll('.public-template[data-tier]')];

for (const filter of templateFilters) {
  filter.addEventListener('click', () => {
    const tier = filter.dataset.templateFilter;
    for (const button of templateFilters) button.setAttribute('aria-pressed', String(button === filter));
    for (const template of publicTemplates) template.hidden = tier !== 'all' && tier !== template.dataset.tier;
  });
}
