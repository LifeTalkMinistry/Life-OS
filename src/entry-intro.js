const INTRO_MARKER = 'life-os-entry-intro-v1';

function introMarkup(step) {
  if (step === 0) {
    return `
      <div class="orb-content setup-content setup-welcome-content" data-lifeos-entry-intro>
        <p class="setup-eyebrow">LIFE OS</p>
        <h1 class="setup-hero">READY TO<br>TAKE CONTROL?</h1>
        <div class="setup-options setup-options-compact">
          <button type="button" data-intro-next>TAKE CONTROL</button>
        </div>
      </div>
    `;
  }

  if (step === 1) {
    return `
      <div class="orb-content setup-content setup-welcome-content" data-lifeos-entry-intro>
        <p class="setup-eyebrow">YOUR TIME IS ALREADY GOING SOMEWHERE</p>
        <h1 class="setup-question">Being busy does not always mean your life is moving in the direction you want.</h1>
        <p class="setup-help">LIFE OS helps you see where your time is actually going.</p>
        <div class="setup-options setup-options-compact">
          <button type="button" data-intro-next>CONTINUE</button>
        </div>
      </div>
    `;
  }

  if (step === 2) {
    return `
      <div class="orb-content setup-content setup-welcome-content" data-lifeos-entry-intro>
        <p class="setup-eyebrow">WE BUILD THE PICTURE</p>
        <h1 class="setup-question">You live your life. LIFE OS organizes the time.</h1>
        <p class="setup-help">Your activities become daily, weekly and monthly insight so you can see whether the important parts of life are staying balanced.</p>
        <div class="setup-options setup-options-compact">
          <button type="button" data-intro-next>CONTINUE</button>
        </div>
      </div>
    `;
  }

  if (step === 3) {
    return `
      <div class="orb-content setup-content setup-welcome-content" data-lifeos-entry-intro>
        <p class="setup-eyebrow">YOUR ONLY JOB</p>
        <h1 class="setup-question">Tell LIFE OS what you are doing.</h1>
        <p class="setup-help">Start when you begin. Stop when you finish. LIFE OS will handle the organization, patterns and Holistic Life picture for you.</p>
        <div class="setup-options setup-options-compact">
          <button type="button" data-intro-next>CONTINUE</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="orb-content setup-content setup-welcome-content" data-lifeos-entry-intro>
      <p class="setup-eyebrow">LIFE OS</p>
      <h1 class="setup-hero">START WITH<br>RIGHT NOW.</h1>
      <p class="setup-help">What are you doing?</p>
      <div class="setup-options setup-options-compact">
        <button type="button" data-intro-start>START TRACKING</button>
      </div>
    </div>
  `;
}

function installEntryIntro() {
  const orb = document.querySelector('.setup-screen .setup-orb');
  if (!orb || orb.dataset.entryIntroInstalled === INTRO_MARKER) return;

  const existingLater = orb.querySelector('[data-entry-action="later"]');
  const existingSetup = orb.querySelector('[data-entry-action="setup-now"]');
  const isWelcome = orb.querySelector('.setup-welcome-content');
  if (!isWelcome) return;

  orb.dataset.entryIntroInstalled = INTRO_MARKER;

  // Preserve the already-wired original action before replacing its visual UI.
  // On the current entry controller, "later" opens the usable main experience
  // without forcing the legacy Life Map setup.
  const finish = () => {
    if (existingLater) {
      existingLater.click();
      return;
    }
    if (existingSetup) {
      existingSetup.click();
      return;
    }
    orb.click();
  };

  let step = 0;
  const paint = () => {
    orb.innerHTML = introMarkup(step);
    orb.removeAttribute('role');
    orb.removeAttribute('tabindex');
    orb.removeAttribute('aria-label');

    orb.querySelector('[data-intro-next]')?.addEventListener('click', (event) => {
      event.stopPropagation();
      step += 1;
      paint();
    });

    orb.querySelector('[data-intro-start]')?.addEventListener('click', (event) => {
      event.stopPropagation();
      finish();
    });
  };

  paint();
}

const observer = new MutationObserver(() => installEntryIntro());
observer.observe(document.documentElement, { childList: true, subtree: true });
installEntryIntro();
