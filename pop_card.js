// Install card behavior: shows only when #installBtn is clicked.
// Works with beforeinstallprompt. Does not auto-show.
(function(){
  const installBtn = document.getElementById('installBtn');
  const card = document.getElementById('installCard');
  const installAction = document.getElementById('installCardInstall');
  const cancelAction = document.getElementById('installCardCancel');

  // fallback if elements not present — do nothing
  if(!installBtn || !card || !installAction || !cancelAction) return;

  // store the event when browser fires beforeinstallprompt
  window.deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    // prevent the default mini-infobar from appearing
    e.preventDefault();
    window.deferredInstallPrompt = e;
    // we DO NOT auto-show the card — the user clicks installBtn to open
  });

  function showCard() {
    card.style.display = 'flex';
    // small entrance animation
    requestAnimationFrame(()=> card.classList.add('show'));
  }
  function hideCard() {
    card.classList.remove('show');
    // wait a bit then hide to stop click-through
    setTimeout(()=> card.style.display = 'none', 180);
  }

  // When user clicks site Install button, show the custom card
  installBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    showCard();
  });

  // User cancels the card
  cancelAction.addEventListener('click', () => {
    hideCard();
  });

  // User chooses to install
  installAction.addEventListener('click', async () => {
    hideCard();
    const promptEvent = window.deferredInstallPrompt;
    if(!promptEvent){
      // If the browser doesn't support beforeinstallprompt (or it's not available),
      // fall back to calling the native install flow (if present) or show the browser prompt by focusing the installBtn's handler.
      // If your existing code already handles install prompts via a variable (like M), that will still work.
      return;
    }
    try {
      promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      // optional: you can track the user's choice (accepted/dismissed)
      try { sessionStorage.setItem('installPromptChoice', choice.outcome); } catch(e){}
      // clear stored event as it can be used only once
      window.deferredInstallPrompt = null;
    } catch(err){
      console.warn('Install prompt failed:', err);
    }
  });

  // close when clicking outside panel (backdrop)
  card.addEventListener('click', (ev) => {
    if(ev.target.classList && ev.target.classList.contains('install-card-backdrop')) hideCard();
  });

})();
