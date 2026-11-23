document.addEventListener('DOMContentLoaded', () => {
  const guide = document.getElementById('auth-mochi-guide');
  const form = document.getElementById('login-form') || document.getElementById('register-form');
  if (!guide || !form) return;
  const speech = document.getElementById('auth-mochi-speech-text');
  const submit = document.getElementById('login-btn') || document.getElementById('register-btn');
  const error = document.getElementById('login-error') || document.getElementById('register-error');
  const register = form.id === 'register-form';
  let mood = 'welcome';
  let returnTimer;
  const welcome = register ? 'mochiRegister' : 'mochiWelcome';
  let lastReaction = -Infinity;

  function show(next, key) {
    if (next === mood) return;
    mood = next;
    guide.dataset.authMood = next;
    if (key) speech.textContent = ReGenText.get('auth.' + key);
  }

  form.addEventListener('focusin', event => {
    if (event.target.matches('input, select') && !submit.disabled) show('attentive');
  });
  form.addEventListener('input', event => {
    if (!event.target.matches('input:not([autocomplete$="password"]):not([type="checkbox"])') || submit.disabled
      || mood === 'success' || performance.now() - lastReaction < 1600) return;
    lastReaction = performance.now();
    show('typing', 'mochiTyping');
    clearTimeout(returnTimer);
    returnTimer = setTimeout(() => show('attentive', welcome), 900);
  });

  form.addEventListener('regen:auth-denied', () => {
    show('error', 'mochiPout');
    clearTimeout(returnTimer);
    returnTimer = setTimeout(() => show('attentive', welcome), 1500);
  });
  const watchResult = new MutationObserver(() => {
    if (mood === 'success') return;
    if (error.classList.contains('visible') && !error.classList.contains('notice')) {
      clearTimeout(returnTimer);
      show('error', 'mochiPout');
    } else if (submit.disabled) {
      clearTimeout(returnTimer);
      show('waiting', register ? 'mochiSignUpWait' : 'mochiSignInWait');
    }
  });
  watchResult.observe(error, {attributes:true, attributeFilter:['class']});
  watchResult.observe(submit, {attributes:true, attributeFilter:['disabled']});

  form.addEventListener('regen:auth-success', () => {
    clearTimeout(returnTimer);
    show('success', register ? 'mochiSignUpSuccess' : 'mochiSuccess');
  });
});
