# Publier un article sur le blog Gaspiz

Un article = **un seul fichier** dans ce dossier. Le reste (la page HTML,
la carte sur la page Blog, le sitemap pour Google) est fabriqué
automatiquement. Il n'y a jamais de HTML à écrire.

---

## Une seule fois, au début

1. Créer un compte sur [github.com](https://github.com) et donner le nom
   d'utilisateur à Nico, qui ajoute le compte au dépôt `Gaspiz__Site`.
2. Installer [GitHub Desktop](https://desktop.github.com) et y cloner le dépôt
   `nprieto-ext/Gaspiz__Site`. Ça crée un dossier du site sur l'ordinateur.
3. Ouvrir Claude Code dans ce dossier.

## À chaque nouvel article

### 1. Récupérer la dernière version

Dans GitHub Desktop, cliquer sur **Fetch origin** puis **Pull**. Ça évite les
conflits avec ce que Nico a modifié de son côté.

### 2. Demander l'article à Claude

Ouvrir Claude Code dans le dossier du site et décrire l'article :

> Écris un article de blog sur notre passage dans l'émission X sur Y.
> C'était le 12 août 2026, la journaliste s'appelle Z, voici le lien de
> la vidéo : … Le visuel à utiliser est dans img/2026-08-emission.webp.

Claude connaît le format (tout est écrit dans `CLAUDE.md` à la racine du
dépôt) : il crée le fichier `.md`, lance le générateur et prévient si quelque
chose cloche. Il suffit ensuite de relire ce qu'il a écrit et de demander les
corrections.

Pour vérifier le rendu avant publication, demander à Claude d'ouvrir
`blog.html` dans le navigateur.

### 3. Publier

Dans GitHub Desktop : écrire une courte description en bas à gauche
(« Ajoute l'article sur l'émission X »), cliquer sur **Commit to main**, puis
sur **Push origin**.

**L'article est en ligne sur gaspiz.fr en quelques minutes.** Rien d'autre à
faire.

---

## Écrire l'article à la main

C'est possible aussi, sans Claude : copier `_MODELE.md`, le renommer
`AAAA-MM-titre-court.md` (minuscules, tirets, sans accent), le remplir, puis
lancer le générateur. Sous Windows, dans le dossier du site :

```
node tools/build-blog.js
```

Si quelque chose ne va pas dans le fichier, le script s'arrête et dit
précisément quoi corriger. Rien n'est cassé tant que l'erreur n'est pas réglée.

La liste complète des champs de l'en-tête et des blocs disponibles
(`:::presse`, `:::video`, `:::audio`, `:::image`) est dans `CLAUDE.md`, à la
racine du dépôt.

## Les images

Déposer les visuels dans le dossier `img/`, nommés `AAAA-MM-sujet.webp`.
Éviter les fichiers de plusieurs Mo : au-delà de ~200 Ko, la page devient
lente à charger. Claude sait convertir et compresser une image si on lui
demande.

## En cas de doute

- **Se tromper n'est pas grave** : tant que le commit n'est pas poussé, rien
  n'est en ligne. Et un article publié peut toujours être corrigé ou supprimé.
- **Supprimer un article** = supprimer son fichier `.md` et relancer le
  générateur. La page, la carte et l'entrée du sitemap disparaissent avec.
- **Préparer un article sans le publier** : ajouter `brouillon: oui` dans
  l'en-tête. Il reste dans le dépôt mais n'apparaît nulle part sur le site.
