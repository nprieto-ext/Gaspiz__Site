// ===========================
// GASPIZ — script.js
// ===========================

// MESURE D'AUDIENCE ET CONSENTEMENT
// Google Analytics depose des cookies : la loi impose de demander l'accord du
// visiteur AVANT de le charger. Tant qu'il n'a pas repondu, ou s'il refuse,
// aucun script Google n'est telecharge et aucun cookie n'est ecrit.
//
// Pour activer la mesure : coller ici l'identifiant du flux GA4, de la forme
// G-XXXXXXXXXX (Google Analytics > Admin > Flux de donnees). Tant que la
// valeur est vide, le bandeau ne s'affiche pas et rien n'est charge.
const GA_ID = '';

const CONSENT_CLE = 'gaspiz-cookies';
const CONSENT_ACCEPTE = 'accepte';
const CONSENT_REFUSE = 'refuse';

// Le mode navigation privee de certains navigateurs fait echouer localStorage :
// en cas d'erreur on se comporte comme si le visiteur n'avait pas repondu.
function lireConsentement() {
  try { return localStorage.getItem(CONSENT_CLE); } catch (e) { return null; }
}

function ecrireConsentement(valeur) {
  try { localStorage.setItem(CONSENT_CLE, valeur); } catch (e) { /* tant pis */ }
}

function chargerAnalytics() {
  if (!GA_ID || window.gaspizAnalyticsCharge) return;
  window.gaspizAnalyticsCharge = true;

  const tag = document.createElement('script');
  tag.async = true;
  tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(tag);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  // anonymize_ip : Google tronque l'adresse IP avant de l'enregistrer
  gtag('config', GA_ID, { anonymize_ip: true });
}

function afficherBandeauCookies() {
  const banner = document.createElement('div');
  banner.className = 'cookie-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Consentement aux cookies de mesure');
  banner.innerHTML =
    '<h4>On peut compter les visites ?</h4>' +
    '<p>Gaspiz utilise Google Analytics pour savoir combien de personnes ' +
    'consultent le site et quelles pages les intéressent. Aucune donnée ' +
    'n\'est revendue. Vous pouvez refuser, le site fonctionnera pareil. ' +
    '<a href="/confidentialite">En savoir plus</a>.</p>' +
    '<div class="cookie-actions">' +
    '<button type="button" class="btn btn-dark" data-cookie="accepte">Accepter</button>' +
    '<button type="button" class="btn btn-outline" data-cookie="refuse">Refuser</button>' +
    '</div>';

  banner.querySelectorAll('[data-cookie]').forEach(btn => {
    btn.addEventListener('click', () => {
      const choix = btn.dataset.cookie === 'accepte' ? CONSENT_ACCEPTE : CONSENT_REFUSE;
      ecrireConsentement(choix);
      banner.remove();
      if (choix === CONSENT_ACCEPTE) chargerAnalytics();
    });
  });

  document.body.appendChild(banner);
  requestAnimationFrame(() => banner.classList.add('show'));
}

if (GA_ID) {
  const consentement = lireConsentement();
  if (consentement === CONSENT_ACCEPTE) {
    chargerAnalytics();
  } else if (consentement !== CONSENT_REFUSE) {
    afficherBandeauCookies();
  }
}

// NAV SCROLL
const navbar = document.getElementById('navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  });
}

// BURGER MENU
const burger = document.getElementById('burger');
const navLinks = document.getElementById('navLinks');

if (burger && navLinks) {
  // La classe menu-open sur <body> sert aussi au CSS : elle desactive le
  // backdrop-filter de la navbar, sans quoi l'overlay fixed est clipe a la
  // hauteur de la barre (la navbar devient son bloc conteneur).
  const setMenu = (open) => {
    burger.classList.toggle('open', open);
    navLinks.classList.toggle('open', open);
    document.body.classList.toggle('menu-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  setMenu(false);

  burger.addEventListener('click', () => {
    setMenu(!navLinks.classList.contains('open'));
  });

  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => setMenu(false));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navLinks.classList.contains('open')) setMenu(false);
  });
}

// BOUTON TELECHARGER : RACCOURCI VERS LE BON STORE
// Sur mobile, le bouton de la nav envoie directement sur l'App Store ou le
// Play Store. Sur ordinateur il garde son lien vers telecharger.html, qui
// presente les deux stores et la version web.
const APP_STORE_URL = 'https://apps.apple.com/fr/app/gaspiz/id6738059463';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.mycompany.gaspiz';

function storeUrlForDevice() {
  const ua = navigator.userAgent || '';
  // Les iPad recents s'annoncent comme des Mac : on les reconnait au tactile
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) return APP_STORE_URL;
  if (/Android/.test(ua)) return PLAY_STORE_URL;
  return null;
}

const storeUrl = storeUrlForDevice();
if (storeUrl) {
  document.querySelectorAll('.nav-cta').forEach(cta => {
    cta.href = storeUrl;
    cta.target = '_blank';
    cta.rel = 'noopener';
  });
}

// ACTIVE NAV LINK SELON LA PAGE
const currentPage = (window.location.pathname.split('/').pop() || 'index.html');
document.querySelectorAll('.nav-links a[href]').forEach(link => {
  const href = link.getAttribute('href');
  if (href === currentPage) {
    link.classList.add('active');
  }
});

// REVEAL ON SCROLL
const reveals = document.querySelectorAll('.reveal');
if (reveals.length) {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' });

  reveals.forEach(el => revealObserver.observe(el));
}

// COUNTER ANIMATION
function animateCounter(el, target, duration = 1800) {
  const start = performance.now();
  const update = (now) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(eased * target).toLocaleString('fr-FR');
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

const statNumbers = document.querySelectorAll('.stat-number[data-target], .chiffre-number[data-target]');
if (statNumbers.length) {
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target = parseInt(entry.target.dataset.target, 10);
        animateCounter(entry.target, target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  statNumbers.forEach(el => counterObserver.observe(el));
}

// FAQ ACCORDION
document.querySelectorAll('.faq-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    const isOpen = item.classList.contains('open');

    item.parentElement.querySelectorAll('.faq-item.open').forEach(el => {
      el.classList.remove('open');
      el.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
    });

    if (!isOpen) {
      item.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }
  });
});

// SMOOTH SCROLL for in-page anchors
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const hash = link.getAttribute('href');
    if (hash === '#') return;
    const target = document.querySelector(hash);
    if (target) {
      e.preventDefault();
      const offset = 80;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// FORMULAIRE DE CONTACT (envoi via Formspree)
// L'adresse d'envoi est celle de l'attribut action du formulaire, dans
// contact.html. Sans JavaScript, le navigateur poste directement dessus.
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  const success = document.getElementById('contactSuccess');
  const errorBox = document.getElementById('contactError');
  const submitBtn = contactForm.querySelector('.form-submit');

  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Le formulaire porte novalidate : on declenche la validation nous-memes
    if (!contactForm.checkValidity()) {
      contactForm.reportValidity();
      return;
    }

    if (errorBox) errorBox.classList.remove('show');

    const label = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Envoi en cours…';
    }

    try {
      const response = await fetch(contactForm.action, {
        method: 'POST',
        body: new FormData(contactForm),
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) throw new Error('Reponse ' + response.status);

      contactForm.style.display = 'none';
      if (success) {
        success.classList.add('show');
        success.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (err) {
      // On laisse le formulaire en place pour ne pas perdre la saisie
      if (errorBox) {
        errorBox.classList.add('show');
        errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = label;
      }
    }
  });
}

// LECTURE VIDEO INTEGREE (temoignages commercants)
document.querySelectorAll('.video-card[data-yt-id]').forEach(card => {
  const play = () => {
    const thumb = card.querySelector('.video-thumb');
    if (!thumb || thumb.querySelector('iframe')) return;
    const id = card.dataset.ytId;
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
    iframe.title = card.getAttribute('aria-label') || 'Vidéo';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    thumb.innerHTML = '';
    thumb.appendChild(iframe);
  };
  card.addEventListener('click', play);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      play();
    }
  });
});
