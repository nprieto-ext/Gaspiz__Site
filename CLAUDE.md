# Site gaspiz.fr

Site vitrine statique : du HTML, du CSS et un peu de JavaScript, sans framework
ni serveur. Dépôt : `nprieto-ext/Gaspiz__Site`, branche `main`.

**Un push sur `main` met gaspiz.fr à jour tout seul** (Hostinger tire le dépôt).
Il n'y a pas de FTP, pas d'étape de déploiement manuelle.

Deux personnes travaillent sur ce dépôt, chacune de son côté : Nico et Mégane.
Faire `git pull --rebase` avant de commencer, et pousser dès que le travail est
fini, pour éviter que les modifications se marchent dessus.

## Le blog est généré, pas écrit à la main

Un article de blog vit dans **un seul fichier** : `content/blog/<date>-<slug>.md`.

Tout le reste est produit par `tools/build-blog.js` :

| Généré (ne jamais éditer à la main) | À partir de |
| --- | --- |
| `blog/<slug>.html` | le fichier `.md` correspondant |
| la grille de cartes dans `blog.html` (entre `BLOG-GRID:START` et `BLOG-GRID:END`) | tous les `.md` |
| `sitemap.xml` | pages fixes + tous les `.md` |

Après avoir touché un `.md`, lancer :

```bash
node tools/build-blog.js
```

Le script n'a aucune dépendance npm. Il refuse de générer et explique le
problème si un article est mal formé. Il réécrit uniquement ce qui a changé.

En cas d'oubli, la GitHub Action `.github/workflows/blog.yml` relance le
générateur après chaque push et recommite le résultat — mais lancer le script
en local reste préférable, ça permet de relire le HTML avant de pousser.

Si un `.md` est supprimé, la page HTML correspondante est supprimée aussi.

## Écrire un article

Nom du fichier : `AAAA-MM-titre-court.md`, en minuscules, sans accent ni espace.
Le préfixe de date sert au classement ; l'URL publique en est déduite —
`2026-08-nouveau-partenaire.md` → `https://gaspiz.fr/blog/nouveau-partenaire`.

### En-tête

```markdown
---
titre: Un nouveau partenaire à Basse-Terre
date: 2026-08-10
categorie: Partenaires
description: Le supermarché X rejoint Gaspiz pour lutter contre le gaspillage à Basse-Terre.
chapeau: Un nouveau commerce engagé rejoint l'aventure Gaspiz.
image: img/2026-08-partenaire.webp
---
```

Champs **obligatoires** : `titre`, `date` (format `AAAA-MM-JJ`), `description`.

| Champ | Rôle | Défaut |
| --- | --- | --- |
| `description` | meta description Google, ~150 caractères | — |
| `chapeau` | phrase d'accroche sous le titre de l'article | `description` |
| `carte` | texte de la carte sur `/blog` | `chapeau` |
| `partage` | texte affiché quand le lien est partagé sur les réseaux | `description` |
| `categorie` | affichée dans l'en-tête et sur la carte | `Média` |
| `emoji` | devant la catégorie | déduit de `categorie` |
| `image` | visuel de la carte sur `/blog`, chemin depuis la racine | aucun |
| `image_alt`, `image_largeur`, `image_dim` | réglages de cette image | `titre`, `65%`, aucune |
| `image_entete` | grande image sous le titre de l'article | aucune |
| `image_entete_alt`, `image_entete_largeur`, `image_entete_dim` | réglages de cette image | `titre`, `280px`, aucune |
| `lien` | libellé du lien sur la carte | `Lire l'article →` |
| `slug` | force l'URL au lieu de la déduire du nom de fichier | nom de fichier sans la date |
| `mois` | force le libellé de date affiché | déduit de `date` |
| `signature` | signature en fin d'article, `non` pour l'enlever | `L'équipe Gaspiz` |
| `brouillon` | `oui` = article ignoré, ni page ni carte ni sitemap | `non` |

Une valeur contenant `:` doit être entre guillemets :
`chapeau: "Une nouvelle étape : ..."`.

### Corps de l'article

Markdown simple : `## Intertitre`, `### Sous-titre`, paragraphes séparés par une
ligne vide, `**gras**`, `*italique*`, `[lien](https://…)`, listes à tirets,
`> citation`. Le `#` seul est refusé : le titre de l'article est dans l'en-tête.

Quatre blocs spéciaux, chacun seul sur sa ligne, valeurs entre guillemets :

```markdown
:::presse url="https://…" logo="img/logo-media.png" titre="Lire l'article sur Le Média" site="lemedia.fr" alt="Le Média"

:::video url="https://www.youtube.com/watch?v=XXXX" alt="Description de la vidéo"

:::audio fichier="audio/interview.mp3" titre="Interview Gaspiz" sous_titre="Août 2026 · Écoutez l'enregistrement"

:::image fichier="img/2026-08-photo.webp" alt="Description de la photo"
```

`:::video` récupère la vignette YouTube automatiquement.

## Images

Les visuels vont dans `img/`, nommés `AAAA-MM-sujet.webp`. Préférer le WebP et
rester sous ~200 Ko. Dans le Markdown, les chemins s'écrivent depuis la racine
du site (`img/photo.webp`) : le générateur ajoute le `../` nécessaire dans les
pages d'articles.

## Cache navigateur

Le CSS et le JS sont appelés avec `?v=AAAAMMJJ`. **Après toute modification de
`style.css` ou `script.js`**, remplacer cette valeur par la date du jour dans
tous les `.html` de la racine, sinon les visiteurs gardent l'ancienne version en
cache. Le générateur lit la valeur dans `index.html` et l'applique aux articles,
il n'y a donc rien à changer dans `blog/`.

Si la date du jour est déjà celle en production, suffixer avec une lettre
(`20260805b`) : réutiliser une valeur déjà servie laisserait les visiteurs du
jour sur l'ancien fichier.

## Le reste du site

Les autres pages (`index.html`, `commercants.html`, `contact.html`,
`telecharger.html`, `applicationnondisponible.html`, `mentions-legales.html`,
`confidentialite.html`, `404.html`) sont écrites à la main. Nav et footer y sont
dupliqués : une modification doit être répercutée partout, y compris dans le
gabarit d'article de `tools/build-blog.js`.

**`404.html` n'utilise que des chemins absolus** (`/style.css`, `/img/…`) :
Apache la sert pour n'importe quelle URL inexistante, y compris sous `/blog/`,
où des chemins relatifs pointeraient à côté. Ne pas les repasser en relatif.

Les pages fixes du sitemap sont listées dans `PAGES_FIXES`, en haut de la
partie sitemap de `tools/build-blog.js` : y ajouter toute nouvelle page.

`.htaccess` gère les URLs propres (`/blog` sert `blog.html`), les redirections
depuis les anciennes URLs WordPress, la page 404 et bloque `content/` et
`tools/` côté web. Le formulaire de contact passe par Formspree.

## Mesure d'audience

`script.js` contient un bandeau de consentement et le chargement de Google
Analytics. Rien ne se déclenche tant que la constante **`GA_ID`** en haut du
fichier est vide : ni bandeau, ni script Google, ni cookie. Y coller
l'identifiant de flux GA4 (`G-XXXXXXXXXX`) pour activer la mesure.

Ne jamais charger Analytics en dehors de ce mécanisme : le consentement
préalable est une obligation légale, et la politique de confidentialité décrit
ce fonctionnement.
