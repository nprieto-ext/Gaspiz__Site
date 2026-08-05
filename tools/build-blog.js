#!/usr/bin/env node
/**
 * Génère le blog Gaspiz à partir des fichiers Markdown de content/blog/.
 *
 * Produit, à chaque exécution :
 *   - blog/<slug>.html   une page par article
 *   - blog.html          la grille de cartes (entre les marqueurs BLOG-GRID)
 *   - sitemap.xml        pages fixes + articles
 *
 * Aucune dépendance npm : `node tools/build-blog.js` suffit.
 * Les fichiers générés ne doivent jamais être édités à la main, ils sont
 * réécrits au prochain build.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content', 'blog');
const OUT_DIR = path.join(ROOT, 'blog');
const SITE = 'https://gaspiz.fr';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// Emoji affiché devant la catégorie, dans l'en-tête de l'article.
const EMOJI_CATEGORIE = {
  'Média': '📰',
  'Radio': '📻',
  'Télévision': '📺',
  'Presse': '📰',
  'Partenaires': '🤝',
  'Coulisses': '💛',
  'Actualité': '✨',
};

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */

/** Échappe le texte destiné au corps du HTML. */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Échappe le texte destiné à un attribut HTML. */
function escAttr(s) {
  return esc(s).replace(/"/g, '&quot;');
}

/** Préfixe un chemin interne de `../` : les articles vivent dans blog/. */
function asset(p) {
  if (/^(https?:)?\/\//.test(p) || p.startsWith('../')) return p;
  return '../' + p.replace(/^\/+/, '');
}

/** `image_dim: 640x255` → ` width="640" height="255"`, sinon rien. */
function dimensions(valeur) {
  if (!valeur) return '';
  const m = String(valeur).match(/^(\d+)\s*[x×]\s*(\d+)$/);
  if (!m) return '';
  return ` width="${m[1]}" height="${m[2]}"`;
}

function moisAnnee(date) {
  const [y, m] = date.split('-');
  const nom = MOIS[Number(m) - 1];
  return nom.charAt(0).toUpperCase() + nom.slice(1) + ' ' + y;
}

/**
 * Version des assets (style.css?v=…), lue dans index.html pour rester
 * alignée avec le reste du site quand on bump le cache-buster.
 */
function assetVersion() {
  try {
    const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const m = index.match(/style\.css\?v=([0-9a-zA-Z._-]+)/);
    if (m) return m[1];
  } catch (_) { /* index.html absent : on retombe sur la date du jour */ }
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

/* ------------------------------------------------------------------ */
/* Lecture du Markdown                                                 */
/* ------------------------------------------------------------------ */

/** Sépare l'en-tête `---` du corps de l'article. */
function parseFrontMatter(raw, fichier) {
  const texte = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const m = texte.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) {
    throw new Error(
      `${fichier} : en-tête manquant. Le fichier doit commencer par une ligne ` +
      `"---", les informations de l'article, puis une ligne "---".`);
  }

  const meta = {};
  for (const ligne of m[1].split('\n')) {
    if (!ligne.trim() || ligne.trim().startsWith('#')) continue;
    const sep = ligne.indexOf(':');
    if (sep === -1) {
      throw new Error(`${fichier} : ligne d'en-tête invalide → "${ligne}"`);
    }
    const cle = ligne.slice(0, sep).trim();
    let valeur = ligne.slice(sep + 1).trim();
    // Les guillemets autour de la valeur sont tolérés mais pas conservés.
    if (/^".*"$/.test(valeur) || /^'.*'$/.test(valeur)) {
      valeur = valeur.slice(1, -1);
    }
    meta[cle] = valeur;
  }
  return { meta, corps: m[2] };
}

/** Gras, italique et liens, sur du texte déjà échappé. */
function inline(texte) {
  let t = esc(texte);
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
    const externe = /^https?:/.test(url);
    const href = escAttr(externe ? url : asset(url));
    const attrs = externe ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${href}"${attrs}>${label}</a>`;
  });
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return t;
}

/** Découpe `cle="valeur"` d'une ligne de bloc `:::`. */
function parseArgs(ligne, fichier) {
  const args = {};
  const re = /([a-z_]+)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(ligne)) !== null) args[m[1]] = m[2];
  if (Object.keys(args).length === 0 && ligne.trim() !== '') {
    throw new Error(
      `${fichier} : bloc mal écrit → "${ligne}". Les valeurs doivent être ` +
      `entre guillemets, par exemple : url="https://…"`);
  }
  return args;
}

function idYoutube(url) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

/* ------------------------------------------------------------------ */
/* Blocs spéciaux (:::presse, :::video, :::audio, :::image)            */
/* ------------------------------------------------------------------ */

const BLOCS = {
  presse(a, fichier) {
    for (const cle of ['url', 'logo', 'titre']) {
      if (!a[cle]) throw new Error(`${fichier} : bloc :::presse, ${cle}="…" manquant.`);
    }
    const site = a.site || new URL(a.url).hostname.replace(/^www\./, '');
    return `        <a href="${escAttr(a.url)}" target="_blank" rel="noopener" class="press-link-box">
          <img src="${escAttr(asset(a.logo))}" alt="${escAttr(a.alt || site)}" />
          <div class="press-link-box-text">
            <strong>${esc(a.titre)}</strong>
            <span>${esc(site)}</span>
          </div>
        </a>`;
  },

  video(a, fichier) {
    if (!a.url) throw new Error(`${fichier} : bloc :::video, url="…" manquant.`);
    const id = idYoutube(a.url);
    if (!id) throw new Error(`${fichier} : lien YouTube non reconnu → ${a.url}`);
    const vignette = a.image
      ? asset(a.image)
      : `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    return `        <a href="${escAttr(a.url)}" target="_blank" rel="noopener" class="article-video-box">
          <img src="${escAttr(vignette)}" alt="${escAttr(a.alt || 'Vidéo')}" loading="lazy" />
          <div class="video-play"><svg viewBox="0 0 24 24"><polygon points="6,4 20,12 6,20" fill="#241E0F"/></svg></div>
        </a>`;
  },

  audio(a, fichier) {
    if (!a.fichier) throw new Error(`${fichier} : bloc :::audio, fichier="…" manquant.`);
    const src = asset(a.fichier);
    return `        <div class="audio-player-box">
          <div class="audio-emoji">${esc(a.emoji || '🎙️')}</div>
          <div class="audio-player-info">
            <strong>${esc(a.titre || 'Écouter')}</strong>
            <span>${esc(a.sous_titre || '')}</span>
            <audio controls preload="none">
              <source src="${escAttr(src)}" type="audio/mpeg" />
              Votre navigateur ne supporte pas la lecture audio. Vous pouvez <a href="${escAttr(src)}" style="color: var(--yellow);">télécharger le fichier</a> directement.
            </audio>
          </div>
        </div>`;
  },

  image(a, fichier) {
    if (!a.fichier) throw new Error(`${fichier} : bloc :::image, fichier="…" manquant.`);
    return `        <img src="${escAttr(asset(a.fichier))}" alt="${escAttr(a.alt || '')}" loading="lazy" class="article-image" />`;
  },
};

/* ------------------------------------------------------------------ */
/* Markdown → HTML                                                     */
/* ------------------------------------------------------------------ */

function corpsHtml(corps, fichier) {
  const lignes = corps.split('\n');
  const out = [];
  let para = [];
  let liste = null;

  const flushPara = () => {
    if (para.length) {
      out.push({ type: 'p', html: `        <p>${inline(para.join(' '))}</p>` });
      para = [];
    }
  };
  const flushListe = () => {
    if (liste) {
      const items = liste.map((item) => `          <li>${inline(item)}</li>`);
      out.push({ type: 'p', html: ['        <ul>', ...items, '        </ul>'].join('\n') });
      liste = null;
    }
  };
  const flush = () => { flushPara(); flushListe(); };

  for (const ligne of lignes) {
    const t = ligne.trim();

    if (t === '') { flush(); continue; }

    if (t.startsWith(':::')) {
      flush();
      const nom = t.slice(3).split(/\s/)[0];
      const bloc = BLOCS[nom];
      if (!bloc) {
        throw new Error(
          `${fichier} : bloc ":::${nom}" inconnu. Blocs disponibles : ` +
          Object.keys(BLOCS).map((n) => ':::' + n).join(', '));
      }
      out.push({ type: 'bloc', html: bloc(parseArgs(t.slice(3 + nom.length), fichier), fichier) });
      continue;
    }

    if (t.startsWith('## ')) {
      flush();
      out.push({ type: 'titre', html: `        <h2>${inline(t.slice(3))}</h2>` });
      continue;
    }
    if (t.startsWith('### ')) {
      flush();
      out.push({ type: 'titre', html: `        <h3>${inline(t.slice(4))}</h3>` });
      continue;
    }
    if (t.startsWith('> ')) {
      flush();
      out.push({ type: 'p', html: `        <blockquote>${inline(t.slice(2))}</blockquote>` });
      continue;
    }
    if (/^[-*]\s+/.test(t)) {
      flushPara();
      (liste = liste || []).push(t.replace(/^[-*]\s+/, ''));
      continue;
    }
    if (t.startsWith('#')) {
      throw new Error(
        `${fichier} : "${t.slice(0, 30)}…" — le titre de l'article se met dans ` +
        `l'en-tête (titre:), pas avec un seul #. Utilisez ## pour les intertitres.`);
    }

    flushListe();
    para.push(t);
  }
  flush();

  // Ligne vide avant un intertitre et autour des blocs :::, rien entre deux
  // paragraphes qui se suivent — la mise en forme du HTML reste lisible.
  return out.map((el, i) => {
    if (i === 0) return el.html;
    const separe = el.type !== 'p' || out[i - 1].type === 'bloc';
    return (separe ? '\n\n' : '\n') + el.html;
  }).join('');
}

/* ------------------------------------------------------------------ */
/* Chargement des articles                                             */
/* ------------------------------------------------------------------ */

function chargerArticles() {
  if (!fs.existsSync(CONTENT_DIR)) {
    throw new Error(`Dossier introuvable : ${CONTENT_DIR}`);
  }
  const fichiers = fs.readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_') && f !== 'README.md'
      && !f.startsWith('COMMENT-'));

  const articles = fichiers.map((fichier) => {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, fichier), 'utf8');
    const { meta, corps } = parseFrontMatter(raw, fichier);

    for (const cle of ['titre', 'date', 'description']) {
      if (!meta[cle]) throw new Error(`${fichier} : "${cle}:" manquant dans l'en-tête.`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) {
      throw new Error(`${fichier} : date "${meta.date}" invalide, format attendu AAAA-MM-JJ.`);
    }
    if (meta.brouillon === 'oui') return null;

    // Le slug vient du nom de fichier, sans le préfixe de date : le fichier
    // 2026-08-mon-article.md donne l'URL /blog/mon-article.
    const slug = meta.slug || fichier.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-?/, '');
    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new Error(
        `${fichier} : slug "${slug}" invalide. Nommez le fichier en minuscules ` +
        `sans accent ni espace, par exemple 2026-08-mon-article.md`);
    }

    const categorie = meta.categorie || 'Média';
    return {
      fichier,
      slug,
      titre: meta.titre,
      date: meta.date,
      mois: meta.mois || moisAnnee(meta.date),
      categorie,
      emoji: meta.emoji || EMOJI_CATEGORIE[categorie] || '📰',
      description: meta.description,
      partage: meta.partage || meta.description,
      chapeau: meta.chapeau || meta.description,
      carte: meta.carte || meta.chapeau || meta.description,
      image: meta.image || '',
      image_alt: meta.image_alt || meta.titre,
      image_largeur: meta.image_largeur || '65%',
      image_dim: meta.image_dim || '',
      image_entete: meta.image_entete || '',
      image_entete_alt: meta.image_entete_alt || meta.titre,
      image_entete_largeur: meta.image_entete_largeur || '280px',
      image_entete_dim: meta.image_entete_dim || '',
      lien: meta.lien || "Lire l'article →",
      signature: meta.signature === 'non' ? null : (meta.signature || "L'équipe Gaspiz"),
      corps,
    };
  }).filter(Boolean);

  const vus = new Map();
  for (const a of articles) {
    if (vus.has(a.slug)) {
      throw new Error(`Deux articles ont la même URL /blog/${a.slug} : ` +
        `${vus.get(a.slug)} et ${a.fichier}`);
    }
    vus.set(a.slug, a.fichier);
  }

  // Plus récent en premier, sur le site comme dans le sitemap.
  articles.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return articles;
}

/* ------------------------------------------------------------------ */
/* Génération : page d'article                                         */
/* ------------------------------------------------------------------ */

function pageArticle(a, v) {
  const url = `${SITE}/blog/${a.slug}`;
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.titre,
    description: a.description,
    datePublished: a.date,
    author: { '@type': 'Organization', name: 'Gaspiz' },
    publisher: { '@type': 'Organization', name: 'Gaspiz' },
  }, null, 2).split('\n').map((l) => '  ' + l).join('\n');

  const imageEntete = a.image_entete
    ? `\n      <img src="${escAttr(asset(a.image_entete))}" alt="${escAttr(a.image_entete_alt)}" style="max-width: ${escAttr(a.image_entete_largeur)}; width: 100%; margin: 2rem auto 0; border-radius: var(--radius); box-shadow: var(--shadow); display: block;"${dimensions(a.image_entete_dim)} />`
    : '';

  const signature = a.signature
    ? `\n        <p style="font-weight: 700;">${esc(a.signature)}</p>`
    : '';

  const partageUrl = encodeURIComponent(url);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="icon" type="image/png" sizes="32x32" href="../img/favicon-32.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="../img/apple-touch-icon.png" />
  <title>${esc(a.titre)} | Blog Gaspiz</title>
  <meta name="description" content="${escAttr(a.description)}" />
  <meta name="author" content="Gaspiz" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${url}" />

  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escAttr(a.titre)}" />
  <meta property="og:description" content="${escAttr(a.partage)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:site_name" content="Gaspiz" />
  <meta property="og:locale" content="fr_FR" />
  <meta property="og:image" content="${SITE}/img/og-gaspiz.jpg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="Gaspiz, l'application anti-gaspi de Guadeloupe, Martinique et Guyane" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escAttr(a.titre)}" />
  <meta name="twitter:description" content="${escAttr(a.partage)}" />
  <meta name="twitter:image" content="${SITE}/img/og-gaspiz.jpg" />

  <script type="application/ld+json">
${jsonLd}
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

  <link rel="stylesheet" href="../style.css?v=${v}" />
</head>
<body>

  <!-- NAV -->
  <nav class="navbar" id="navbar">
    <div class="nav-container">
      <a href="../index.html" class="nav-logo">
        <img src="../img/2025-04-Gaspiz_avectitre_compress-300x99.png" alt="Logo Gaspiz" />
      </a>
      <ul class="nav-links" id="navLinks">
        <li><a href="../index.html">Accueil</a></li>
        <li><a href="../commercants.html">Commerçants</a></li>
        <li><a href="../blog.html">Blog</a></li>
        <li><a href="../contact.html">Contact</a></li>
        <li><a href="../telecharger.html" class="nav-cta">Télécharger <span class="arrow-down">↓</span></a></li>
      </ul>
      <button class="burger" id="burger" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  </nav>

  <!-- ARTICLE HEADER -->
  <header class="article-header">
    <div class="section-container">
      <div class="article-meta"><span>${esc(a.emoji)} ${esc(a.categorie)}</span> · <span>${esc(a.mois)}</span></div>
      <h1 class="article-title">${esc(a.titre)}</h1>
      <p class="article-lead">${inline(a.chapeau)}</p>${imageEntete}
    </div>
  </header>

  <!-- ARTICLE BODY -->
  <section class="article-body">
    <div class="section-container">
      <div class="article-wrap">
        <a href="../blog.html" class="article-back">← Retour au blog</a>

${corpsHtml(a.corps, a.fichier)}${signature}

        <div class="article-share">
          <span>Partager</span>
          <a href="https://www.facebook.com/sharer/sharer.php?u=${partageUrl}" target="_blank" rel="noopener" aria-label="Partager sur Facebook">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116c.73 0 1.323-.593 1.323-1.325V1.325C24 .593 23.407 0 22.675 0z"/></svg>
          </a>
          <a href="https://www.instagram.com/gaspiz.fr" target="_blank" rel="noopener" aria-label="Voir sur Instagram">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
          </a>
        </div>
      </div>
    </div>
  </section>

  <!-- CTA FINAL -->
  <section class="cta-final">
    <div class="cta-blob"></div>
    <div class="section-container">
      <div class="cta-content reveal">
        <p class="section-tag light">Convaincu(e) ?</p>
        <h2 class="cta-title">Téléchargez Gaspiz<br />dès maintenant</h2>
        <p>Gratuit, sans engagement, disponible sur iOS et Android.</p>
        <div class="hero-cta">
          <a href="https://apps.apple.com/fr/app/gaspiz/id6738059463" target="_blank" rel="noopener" class="store-btn">
            <img src="../app-store.webp" alt="Disponible sur App Store" width="650" height="210" />
          </a>
          <a href="https://play.google.com/store/apps/details?id=com.mycompany.gaspiz" target="_blank" rel="noopener" class="store-btn">
            <img src="../play-store.webp" alt="Disponible sur Google Play" width="650" height="209" />
          </a>
        </div>
      </div>
    </div>
  </section>

  <!-- FOOTER -->
  <footer class="footer">
    <div class="footer-container">
      <div class="footer-brand">
        <img src="../img/2025-04-Gaspiz_avectitre_compress-300x99.png" alt="Logo Gaspiz" />
        <p>L'application anti-gaspi de référence en Guadeloupe, Martinique et Guyane.</p>
        <div class="footer-socials">
          <a href="https://www.instagram.com/gaspiz.fr" target="_blank" rel="noopener" aria-label="Instagram">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
          </a>
          <a href="https://www.tiktok.com/@gaspiz.fr" target="_blank" rel="noopener" aria-label="TikTok">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.74a4.85 4.85 0 01-1.01-.05z"/></svg>
          </a>
          <a href="https://www.youtube.com/channel/UCU40w-O1qCVlNCVsl5Q4lxQ" target="_blank" rel="noopener" aria-label="YouTube">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
          </a>
          <a href="https://www.facebook.com/profile.php?id=61569839091501" target="_blank" rel="noopener" aria-label="Facebook">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116c.73 0 1.323-.593 1.323-1.325V1.325C24 .593 23.407 0 22.675 0z"/></svg>
          </a>
        </div>
      </div>
      <div class="footer-links">
        <h4>Navigation</h4>
        <ul>
            <li><a href="../commercants.html">Commerçants</a></li>
          <li><a href="../blog.html">Blog</a></li>
          <li><a href="../contact.html">Contact</a></li>
        </ul>
      </div>
      <div class="footer-contact">
        <h4>Contact</h4>
        <ul>
          <li><a href="mailto:megane@gaspiz.fr">megane@gaspiz.fr</a></li>
          <li><a href="https://www.instagram.com/gaspiz.fr" target="_blank" rel="noopener">Instagram</a></li>
        </ul>
      </div>
      <div class="footer-app">
        <h4>Télécharger</h4>
        <a href="https://apps.apple.com/fr/app/gaspiz/id6738059463" target="_blank" rel="noopener">
          <img src="../app-store.webp" alt="App Store" width="650" height="210" />
        </a>
        <a href="https://play.google.com/store/apps/details?id=com.mycompany.gaspiz" target="_blank" rel="noopener">
          <img src="../play-store.webp" alt="Google Play" width="650" height="209" />
        </a>
      </div>
    </div>
    <div class="footer-bottom">
      <p>© 2026 Gaspiz. Tous droits réservés.</p>
      <div class="footer-legal">
        <a href="../mentions-legales.html">Mentions légales</a>
        <a href="../confidentialite.html">Politique de confidentialité</a>
      </div>
    </div>
  </footer>

  <script src="../script.js?v=${v}"></script>
</body>
</html>
`;
}

/* ------------------------------------------------------------------ */
/* Génération : grille de blog.html                                    */
/* ------------------------------------------------------------------ */

const DEBUT_GRILLE = '<!-- BLOG-GRID:START — généré par tools/build-blog.js, ne pas éditer à la main -->';
const FIN_GRILLE = '<!-- BLOG-GRID:END -->';

function carte(a, i) {
  const delay = i === 0 ? '' : ` style="--delay: ${(i * 0.1).toFixed(1)}s"`;
  const couverture = a.image
    ? `<div class="blog-card-cover" style="background: var(--white); display: flex; align-items: center; justify-content: center;"><img src="${escAttr(a.image)}" alt="${escAttr(a.image_alt)}" loading="lazy" style="width: ${escAttr(a.image_largeur)}; height: auto; object-fit: contain;"${dimensions(a.image_dim)} /></div>`
    : `<div class="blog-card-cover"></div>`;

  return `        <a href="blog/${a.slug}.html" class="blog-card reveal"${delay}>
          ${couverture}
          <div class="blog-card-body">
            <div class="blog-meta"><span>${esc(a.mois)}</span> · <span>${esc(a.categorie)}</span></div>
            <h3>${esc(a.titre)}</h3>
            <p>${esc(a.carte)}</p>
            <span class="blog-card-link">${esc(a.lien)}</span>
          </div>
        </a>`;
}

function majBlogIndex(articles) {
  const chemin = path.join(ROOT, 'blog.html');
  const html = fs.readFileSync(chemin, 'utf8');
  const debut = html.indexOf(DEBUT_GRILLE);
  const fin = html.indexOf(FIN_GRILLE);
  if (debut === -1 || fin === -1) {
    throw new Error(
      'blog.html : marqueurs BLOG-GRID:START / BLOG-GRID:END introuvables. ' +
      'Ils délimitent la liste des articles, ne les supprimez pas.');
  }
  const grille = articles.map(carte).join('\n');
  const nouveau = html.slice(0, debut + DEBUT_GRILLE.length) +
    '\n' + grille + '\n        ' +
    html.slice(fin);
  return ecrire(chemin, nouveau);
}

/* ------------------------------------------------------------------ */
/* Génération : sitemap.xml                                            */
/* ------------------------------------------------------------------ */

const PAGES_FIXES = [
  { loc: '/', changefreq: 'weekly', priority: '1.0' },
  { loc: '/commercants', changefreq: 'monthly', priority: '0.8' },
  { loc: '/telecharger', changefreq: 'monthly', priority: '0.8' },
  { loc: '/applicationnondisponible', changefreq: 'monthly', priority: '0.7' },
  { loc: '/contact', changefreq: 'monthly', priority: '0.6' },
  // Pages legales : priorite basse, elles n'ont pas a se positionner, mais
  // Google verifie leur existence pour juger du serieux du site.
  { loc: '/mentions-legales', changefreq: 'yearly', priority: '0.2' },
  { loc: '/confidentialite', changefreq: 'yearly', priority: '0.2' },
];

function majSitemap(articles) {
  const bloc = (loc, changefreq, priority, lastmod) => [
    '  <url>',
    `    <loc>${SITE}${loc}</loc>`,
    ...(lastmod ? [`    <lastmod>${lastmod}</lastmod>`] : []),
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].join('\n');

  const urls = PAGES_FIXES.map((p) => bloc(p.loc, p.changefreq, p.priority));
  if (articles.length) {
    urls.push(bloc('/blog', 'monthly', '0.7', articles[0].date));
    for (const a of articles) {
      urls.push(bloc(`/blog/${a.slug}`, 'yearly', '0.5', a.date));
    }
  } else {
    urls.push(bloc('/blog', 'monthly', '0.7'));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Généré par tools/build-blog.js — ne pas éditer à la main -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
  return ecrire(path.join(ROOT, 'sitemap.xml'), xml);
}

/* ------------------------------------------------------------------ */
/* Écriture + point d'entrée                                           */
/* ------------------------------------------------------------------ */

const modifies = [];

/** N'écrit que si le contenu change, pour ne pas créer de commit vide. */
function ecrire(chemin, contenu) {
  const existant = fs.existsSync(chemin) ? fs.readFileSync(chemin, 'utf8') : null;
  if (existant === contenu) return false;
  fs.mkdirSync(path.dirname(chemin), { recursive: true });
  fs.writeFileSync(chemin, contenu, 'utf8');
  modifies.push(path.relative(ROOT, chemin).replace(/\\/g, '/'));
  return true;
}

function main() {
  const articles = chargerArticles();
  const v = assetVersion();

  for (const a of articles) {
    ecrire(path.join(OUT_DIR, `${a.slug}.html`), pageArticle(a, v));
  }

  // Une page HTML dont le .md a disparu doit disparaître aussi.
  const attendus = new Set(articles.map((a) => `${a.slug}.html`));
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith('.html') && !attendus.has(f)) {
      fs.unlinkSync(path.join(OUT_DIR, f));
      modifies.push(`blog/${f} (supprimé)`);
    }
  }

  majBlogIndex(articles);
  majSitemap(articles);

  console.log(`${articles.length} article(s) lus depuis content/blog/.`);
  if (modifies.length === 0) {
    console.log('Aucun changement : le site est déjà à jour.');
  } else {
    console.log('Fichiers mis à jour :');
    for (const f of modifies) console.log('  - ' + f);
  }
}

try {
  main();
} catch (e) {
  console.error('\n❌ Le blog n\'a pas pu être généré.\n');
  console.error('   ' + e.message + '\n');
  process.exit(1);
}
