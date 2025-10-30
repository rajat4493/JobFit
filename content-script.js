(function () {
  'use strict';

  // ==== CONFIG ====
  const SELS = {
    title: [
      'h1.top-card-layout__title',
      'h1.jobs-unified-top-card__job-title',
      'h1.jobs-details-top-card__job-title'
    ],
    company: [
      '.topcard__org-name-link',
      'a.jobs-unified-top-card__company-name',
      'a.jobs-details-top-card__company-url'
    ],
    location: [
      '.topcard__flavor--bullet',
      '.jobs-unified-top-card__bullet',
      '.jobs-details-top-card__primary-description div'
    ],
    description: [
      'div.show-more-less-html__markup',
      'div.jobs-description-content__text',
      'div.jobs-box__html-content',
      'div.jobs-description__content',
      '[data-test-description]'
    ],
    seeMoreBtn: [
      'button[aria-label="See more"]',
      'button[aria-label="Show more"]',
      'button[aria-expanded="false"][data-control-name*="show_more"]'
    ]
  };

  // ==== HELPERS ====
  const $ = (sel) => document.querySelector(sel);
  const any = (arr) => arr.map((s) => $(s)).find(Boolean);
  const clean = (t, max = 20000) =>
    (t || '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max);

  const isJobPage = () =>
    location.hostname.includes('linkedin.com') &&
    location.pathname.includes('/jobs/');

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function expandDescription() {
    for (const sel of SELS.seeMoreBtn) {
      const btn = $(sel);
      if (btn) {
        try { btn.click(); await sleep(150); } catch {}
      }
    }
  }

  function scrapeJob() {
    const titleEl = any(SELS.title);
    const companyEl = any(SELS.company);
    const locationEl = any(SELS.location);
    const descNodes = SELS.description
      .map((s) => Array.from(document.querySelectorAll(s)))
      .flat();

    const description = clean(descNodes.map((n) => n?.textContent || '').join(' '), 18000);

    return {
      url: location.href,
      title: clean(titleEl?.textContent || '', 256),
      company: clean(companyEl?.textContent || '', 256),
      location: clean(locationEl?.textContent || '', 256),
      description,
      scrapedAt: new Date().toISOString()
    };
  }

  function renderOverlay(result) {
    document.querySelector('#cvsync-overlay')?.remove();
    const root = document.createElement('div');
    root.id = 'cvsync-overlay';

    const score = Math.max(0, Math.min(100, parseInt(result.matchScore || 0)));
    const level =
      score >= 85 ? 'EXCELLENT MATCH' :
      score >= 70 ? 'STRONG MATCH' :
      score >= 50 ? 'FAIR MATCH' : 'LOW MATCH';

    const reasons = Array.isArray(result.reasons) ? result.reasons.slice(0, 5) : [];

    root.innerHTML = `
      <div class="cv-header">
        <div class="cv-title">CVSync Match</div>
        <button class="cv-close" aria-label="Close">×</button>
      </div>
      <div class="cv-score">
        <div class="cv-score-val">${score}%</div>
        <div class="cv-score-sub">${level}</div>
      </div>
      <div class="cv-reasons">
        <ul>${reasons.map((r) => `<li>${r}</li>`).join('')}</ul>
      </div>`;
    document.body.appendChild(root);
    root.querySelector('.cv-close').onclick = () => root.remove();
  }

  async function analyzeWithRetries() {
    // Retry a few times because LinkedIn renders content lazily
    for (let attempt = 0; attempt < 8; attempt++) {
      await expandDescription();
      const job = scrapeJob();

      // Require at least some description to avoid early/empty reads
      if ((job.title && job.description && job.description.length > 200) || attempt >= 5) {
        const { cvText } = await new Promise((res) => chrome.storage.local.get(['cvText'], res));
        if (!cvText || String(cvText).length < 50) return;

        return chrome.runtime.sendMessage(
          { action: 'matchJob', data: { cvText, job } },
          (resp) => { if (resp && resp.success) renderOverlay(resp.data); }
        );
      }
      await sleep(400 + attempt * 150);
    }
  }

  // Detect SPA URL changes reliably
  function hookHistory() {
    const push = history.pushState;
    history.pushState = function () {
      push.apply(this, arguments);
      window.dispatchEvent(new Event('cvsync:navigate'));
    };
    const replace = history.replaceState;
    history.replaceState = function () {
      replace.apply(this, arguments);
      window.dispatchEvent(new Event('cvsync:navigate'));
    };
    window.addEventListener('popstate', () => window.dispatchEvent(new Event('cvsync:navigate')));
  }

  function watchNavigation() {
    let lastURL = location.href;
    const fire = () => {
      if (!isJobPage()) return;
      document.querySelector('#cvsync-overlay')?.remove();
      analyzeWithRetries();
    };

    // 1) Listen to our custom events from pushState/replaceState/popstate
    window.addEventListener('cvsync:navigate', () => {
      if (location.href !== lastURL) {
        lastURL = location.href;
        setTimeout(fire, 800);
      }
    });

    // 2) Fallback: MutationObserver for major DOM swaps
    const mo = new MutationObserver(() => {
      if (location.href !== lastURL) {
        lastURL = location.href;
        setTimeout(fire, 800);
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(analyzeWithRetries, 1000));
  } else {
    setTimeout(analyzeWithRetries, 1000);
  }
  hookHistory();
  watchNavigation();
})();
