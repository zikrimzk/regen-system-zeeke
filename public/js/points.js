window.ReGenPoints = (() => {
  function lines(value) { return String(value || '').split(/\r?\n/).map(line => ZeekeSafe.cleanText(line)).filter(Boolean).slice(0,50); }
  function format(items) { return (Array.isArray(items) ? items : lines(items)).filter(Boolean).map(item => `• ${item}`).join('\n'); }
  function bind(root) {
    root.querySelectorAll('.points-editor:not([data-points-bound])').forEach(field => {
      field.dataset.pointsBound = 'true';
      field.addEventListener('keydown', event => {
        if (event.key !== 'Enter' || event.isComposing) return;
        event.preventDefault(); field.setRangeText('\n• ',field.selectionStart,field.selectionEnd,'end'); field.dispatchEvent(new Event('input',{bubbles:true}));
      });
      field.addEventListener('paste', event => {
        const content = event.clipboardData?.getData('text/plain'); if (!content) return;
        event.preventDefault(); let insertion = format(lines(content));
        const start=field.selectionStart, lineStart=field.value.lastIndexOf('\n',start-1)+1;
        if(field.value.slice(lineStart,start).trim())insertion=insertion.replace(/^• /,'');
        field.setRangeText(insertion,start,field.selectionEnd,'end');field.dispatchEvent(new Event('input',{bubbles:true}));
      });
      field.addEventListener('input',()=>{if(field.value&&!field.value.startsWith('• ')){const caret=field.selectionStart;field.value=`• ${field.value}`;field.setSelectionRange(caret+2,caret+2);}});
      field.addEventListener('blur',()=>{
        const next = format(lines(field.value));
        if (field.value !== next) {field.value = next; field.dispatchEvent(new Event('input',{bubbles:true}));}
      });
    });
  }
  return {lines,format,bind};
})();
