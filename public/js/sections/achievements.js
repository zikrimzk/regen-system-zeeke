const AchievementsSection = (() => {
  function render(stepNum) { return `<div class="step-header"><div class="step-header-info"><div class="step-count">Step ${stepNum}</div><h2 class="step-title">Achievements</h2><p class="step-subtitle">List awards or accomplishments relevant to the role.</p></div><button type="button" class="skip-btn">Skip ${ReGenIcons.icon('arrowRight')}</button></div><div class="form-body form-section"><label class="form-label" for="ach-points">Achievements & Awards</label><textarea id="ach-points" class="points-editor ach-input" data-preserve-spaces="true" rows="8" maxlength="16000" placeholder="e.g. Faculty Merit Award, Universiti Malaya (2024)"></textarea><p class="points-hint">Each line becomes a bullet in your resume.</p></div>`; }
  function attachEvents(data) { document.getElementById('ach-points').value = ReGenPoints.format(data || []); ReGenPoints.bind(document.getElementById('step-content')); }
  function getData() { return {isValid:true, data:ReGenPoints.lines(document.getElementById('ach-points').value)}; }
  return {render,attachEvents,getData};
})();
