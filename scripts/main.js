(function () {
  const setupScreen = document.getElementById('setup-screen');
  const header = document.getElementById('header');
  const mainDashboard = document.getElementById('main-dashboard');
  const setupForm = document.getElementById('setup-form');
  const isInitialized = localStorage.getItem('gaston_initialized');
  function bootDashboard() {
    setupScreen.style.display = 'none';
    header.style.display = 'block';
    mainDashboard.style.display = 'grid';
    document.getElementById('header-owner').textContent = localStorage.getItem('gaston_owner').toUpperCase();
    document.getElementById('header-firm').textContent = localStorage.getItem('gaston_firm').toUpperCase();
  }
  if (isInitialized) { bootDashboard(); }
  if (setupForm) {
    setupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const owner = document.getElementById('owner-name').value.trim();
      const firm = document.getElementById('firm-name').value.trim();
      if (owner && firm) {
        localStorage.setItem('gaston_owner', owner);
        localStorage.setItem('gaston_firm', firm);
        localStorage.setItem('gaston_initialized', 'true');
        bootDashboard();
      }
    });
  }
  window.triggerCampaign = async function() {
    const scraper = document.getElementById('scraper-status');
    const video = document.getElementById('video-status');
    const progress = document.getElementById('video-progress');
    scraper.textContent = 'SEARCHING NY-315...';
    await new Promise(r => setTimeout(r, 2000));
    scraper.textContent = '4 LEADS FOUND';
    video.textContent = 'RENDERING SURGICAL TEASER...';
    progress.style.width = '75%';
    await new Promise(r => setTimeout(r, 3000));
    video.textContent = 'DISPATCHED';
    progress.style.width = '100%';
  };
  window.prepareActivation = function(client) {
    alert(`Initialize secure Data Bridge for ${client}?`);
  };
})();
