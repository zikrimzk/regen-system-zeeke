const CertificationsSection = (() => {
  function render(stepNum) { return `<div class="step-header"><div class="step-header-info"><div class="step-count">Step ${stepNum}</div><h2 class="step-title">Certifications</h2><p class="step-subtitle">Include the credential, issuer and year.</p></div><button type="button" class="skip-btn">Skip ${ReGenIcons.icon('arrowRight')}</button></div><div class="form-body form-section"><label class="form-label" for="cert-points">Licenses & Certifications</label><textarea id="cert-points" class="points-editor cert-input" data-preserve-spaces="true" rows="8" maxlength="16000" placeholder="e.g. AWS Certified Cloud Practitioner, AWS (2025)"></textarea><p class="points-hint">Each line becomes a bullet in your resume.</p></div>`; }
  function attachEvents(data) { document.getElementById('cert-points').value = ReGenPoints.format(data || []); ReGenPoints.bind(document.getElementById('step-content')); }
  function getData() { return {isValid:true, data:ReGenPoints.lines(document.getElementById('cert-points').value)}; }
  return {render,attachEvents,getData};
})();
