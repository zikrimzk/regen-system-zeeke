window.FormCards = (() => {
  function refresh(root) {
    root.querySelectorAll('.entry-cards').forEach(list => {
      const cards = [...list.children].filter(card => card.matches('.entry-card'));
      cards.forEach((card, index) => {
        const number = card.querySelector('.entry-card-num');
        if (number && number.textContent !== String(index + 1)) number.textContent = index + 1;
        const tools = card.querySelector('.entry-arrange');
        if (!tools) return;
        tools.hidden = cards.length < 2;
        tools.querySelector('[data-move="up"]').disabled = index === 0;
        tools.querySelector('[data-move="down"]').disabled = index === cards.length - 1;
        const position = tools.querySelector('span');
        const text = `Position ${index + 1} of ${cards.length}`;
        if (position.textContent !== text) position.textContent = text;
      });
    });
  }

  function bind(root) {
    root.querySelectorAll('.entry-card:not([data-card-bound])').forEach(card => {
      card.dataset.cardBound = 'true';
      const header = card.querySelector('.entry-card-header'), title = card.querySelector('.entry-card-title'), body = card.querySelector('.form-section');
      if (!header || !title || !body) return;
      const fallback = title.textContent;
      const toggle = document.createElement('button');
      toggle.type = 'button'; toggle.className = 'entry-collapse';
      if (!body.id) body.id = `${card.id}-fields`;
      toggle.setAttribute('aria-controls', body.id);
      toggle.setAttribute('aria-expanded', 'true');
      toggle.innerHTML = ReGenIcons.icon('arrowDown');
      header.insertBefore(toggle, header.querySelector('.entry-delete-btn'));
      const update = () => {
        const field = card.querySelector('.exp-title,.proj-title,.extra-org,.edu-degree,.ref-name,.additional-title');
        const name = field?.value.trim() || fallback;
        if (title.textContent !== name) title.textContent = name;
        toggle.setAttribute('aria-label', `${body.hidden ? 'Expand' : 'Collapse'} ${name}`);
      };
      toggle.addEventListener('click', () => {
        body.hidden = !body.hidden;
        toggle.setAttribute('aria-expanded', String(!body.hidden)); update();
      });
      card.addEventListener('input', update);
      card.addEventListener('change', update);
      update();
      card.addEventListener('invalid', () => {
        body.hidden = false; toggle.setAttribute('aria-expanded', 'true'); update();
      }, true);
      const tools = document.createElement('div'); tools.className = 'entry-arrange';
      tools.innerHTML = '<span></span><button type="button" data-move="up">Move up</button><button type="button" data-move="down">Move down</button>';
      body.append(tools);
      tools.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
        const list = card.parentElement;
        if (button.dataset.move === 'up' && card.previousElementSibling) list.insertBefore(card, card.previousElementSibling);
        else if (button.dataset.move === 'down' && card.nextElementSibling) list.insertBefore(card.nextElementSibling, card);
        refresh(root);
        // Keep keyboard focus on the moved entry, including when the action becomes disabled.
        toggle.focus({preventScroll:true});
        root.dispatchEvent(new Event('input', {bubbles:true}));
      }));
    });
  }

  function observe(root) {
    bind(root); refresh(root);
    new MutationObserver(records => {
      const entriesChanged = records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1 && (node.matches('.entry-card') || node.querySelector('.entry-card'))));
      if (entriesChanged) { bind(root); refresh(root); }
    }).observe(root, {childList:true, subtree:true});
  }
  function ordered(ids, listId) {
    const positions = new Map([...document.getElementById(listId).children].map((card,index) => [card.id.split('-').pop(), index]));
    return [...ids].sort((a,b) => (positions.get(String(a)) ?? 0) - (positions.get(String(b)) ?? 0));
  }
  function prepare(root) {
    bind(root);
    refresh(root);
    root.querySelectorAll('.entry-cards').forEach(list => {
      [...list.children].slice(1).forEach(card => card.querySelector('.entry-collapse[aria-expanded="true"]')?.click());
    });
  }
  function expand(root) { root.querySelectorAll('.entry-collapse[aria-expanded="false"]').forEach(toggle => toggle.click()); }
  return {observe,prepare,ordered,expand};
})();
