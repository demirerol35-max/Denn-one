# Mushaf Hafs et Warsh — provenance et état d’intégration

Mise à jour : 22 novembre 2026.

## État réel

Le lecteur propose la navigation RTL, l’accès direct à une page, la reprise de lecture par édition, le plein écran et la reprise après erreur. Le chargement annule les requêtes précédentes au changement d’édition ou à la fermeture.

Le hors connexion conserve au maximum les 12 dernières pages vérifiées, toutes éditions confondues. Le manifeste est conservé par édition. Chaque page locale est comparée à nouveau à son SHA-256 avant affichage ; une copie altérée est supprimée. Le module du lecteur fait partie du cache de l’application. Les erreurs de stockage ne bloquent pas la lecture en ligne. Les pages jamais consultées nécessitent une connexion.

**Aucune édition ni page n’est encore publiée dans Deen One.** Ces capacités sont testées avec des données synthétiques, sans texte coranique. Elles deviendront utilisables avec l’intégration de pages validées. Une empreinte garantit l’identité des octets, pas l’exactitude religieuse du contenu.

## Source examinée : Quran.ws / Quran SVG

- Dépôt : https://github.com/quran-ws/quran-svg
- Notice : https://github.com/quran-ws/quran-svg/blob/main/NOTICE.md
- Licence : https://github.com/quran-ws/quran-svg/blob/main/LICENSE
- Provenance : https://github.com/quran-ws/quran-svg/blob/main/docs/PROVENANCE.md
- Version candidate : https://github.com/quran-ws/quran-svg/releases/tag/v1.1.1

Le projet distingue les dossiers Hafs et Warsh du Complexe du roi Fahd. La provenance décrit les archives sources de chaque édition et leurs empreintes. Pour ces deux éditions, le document décrit un contrôle structurel des 604 fichiers sources, sans comparaison géométrique complète des pages.

La notice distingue les métadonnées créées par Quran.ws, sous CC BY 4.0, des compositions originales du Complexe. Elle reproduit les conditions du Complexe pour l’utilisation numérique et logicielle. Cette information précise le dossier de droits ; elle ne constitue pas une validation éditoriale des transformations SVG.

Les pages SVG de ce fournisseur ne sont pas directement acceptées par le lecteur actuel, limité à PNG, WebP et JPEG. Une intégration devra conserver l’origine et les conditions, utiliser une version figée et vérifier les images rendues. Aucun manifeste ne doit déclarer une revue éditoriale inexistante.

## Conditions d’activation

- Identifier l’édition exacte, son éditeur, sa version et sa pagination.
- Confirmer les conditions applicables et conserver les attributions nécessaires.
- Faire contrôler le contenu rendu contre l’édition imprimée autorisée.
- Produire un manifeste complet et des empreintes des images réellement distribuées.
- Vérifier le rendu et les gestes sur téléphone, notamment sur Android.
- Garder les pages et mémoires de lecture de Hafs et Warsh séparées.

## Vérifications automatisées

Les tests couvrent le schéma, la séparation des éditions, les limites de navigation, le contrôle des octets, le cache hors connexion, son quota de 12 pages, les données locales altérées, l’annulation des chargements, les images illisibles et la disponibilité du module après activation du service worker.

Ces vérifications ne remplacent pas une revue éditoriale ni un essai sur téléphone réel.


## Préparation automatisée des pages pour contrôle

La chaîne `.github/workflows/mushaf-sources.yml` prépare séparément les éditions Hafs et Warsh, à partir du commit source figé `3ff27b46cecb0c0519d77531d9c868a579d1f623` (v1.1.1).

Le fichier `data/mushaf-source-lock.json` inventorie les 604 pages de chaque édition avec leur taille et leur empreinte Git. Le préparateur vérifie les octets sources, refuse les fichiers manquants et les références actives ou externes dans les SVG, puis produit des PNG de 1 400 pixels de large en conservant le viewBox complet. Il calcule une empreinte SHA-256 pour chaque source et chaque image produite et conserve les notices et licences d’origine.

Chaque artefact GitHub `deen-one-hafs-review` ou `deen-one-warsh-review` contient les pages, un manifeste, un rapport et une visionneuse `review.html`. Télécharger et extraire l’artefact, puis ouvrir cette page pour parcourir les images. Le préparateur refuse d’écraser un dossier existant.

Les manifestes générés portent obligatoirement `reviewed: false` et `reviewStatus: "pending"`. Le lecteur de production les refuse. Le workflow ne modifie pas l’application et ne publie pas automatiquement les images sur GitHub Pages.

Les tests automatisés vérifient aussi une préparation complète de 604 pages synthétiques, le rejet des sources modifiées et l’impossibilité d’activer un manifeste non revu. Les pages réelles 1 et 300 des deux éditions ont été converties localement et examinées visuellement ; cette vérification ponctuelle ne vaut pas revue complète des 1 208 pages.


## Présentation du lecteur en livre

Le lecteur de production prend désormais en charge une page ou une double page, avec un choix automatique : deux pages à partir de 900 pixels de largeur, une page en dessous. Le choix manuel est conservé sur l’appareil.

Les paires sont présentées dans l’ordre de lecture droite à gauche : page 1 à droite et page 2 à gauche, puis 3–4, etc. Un accès direct à une page paire conserve cette page comme position de lecture ; passer ensuite en présentation simple affiche bien la page demandée.

Le zoom va de 100 à 200 %, avec un bouton Ajuster. Quand le zoom dépasse 100 %, les gestes horizontaux et les flèches du clavier laissent déplacer la page sans déclencher un changement de page. Les boutons de navigation restent utilisables. Chaque ouverture d’édition et chaque changement de présentation revient à 100 %.

En double page, les deux images sont chargées et vérifiées avant affichage. Si l’une échoue, aucune des deux n’est affichée et la position de lecture n’est pas enregistrée. Le changement de présentation annule les chargements précédents.

La suite navigateur `tests/mushaf-book.spec.cjs` vérifie la disposition RTL, les pixels réellement peints, les limites de navigation, le passage au format mobile, le zoom et le rejet d’une seconde page corrompue. Des essais locaux de rendu utilisent également les pages sources réelles 1 et 2 de Hafs et Warsh. Ces essais portent sur l’interface et ne valident pas éditorialement l’ensemble des pages. Les artefacts de contrôle existants conservent leur visionneuse simple ; les fonctions de livre décrites ici concernent le lecteur de l’application.

Aucune édition n’est activée automatiquement par cette évolution.


## Langues et reprise de lecture

Les commandes, les descriptions des éditions, les textes d’accessibilité et les états du lecteur sont disponibles en français, anglais, turc, allemand et arabe. Un changement de langue met aussi à jour les messages de chargement, d’erreur et de lecture locale déjà affichés, sans recharger les pages ni changer la position de lecture.

La suite navigateur vérifie les cinq langues, la conservation du choix de présentation après actualisation et la séparation des positions Hafs et Warsh. Elle suit la confirmation de changement de paramètre déjà présente dans l’application.

Ces traductions et tests n’activent aucune édition non revue et ne constituent pas une validation éditoriale des pages.


## Favoris de pages

Le lecteur permet d’ajouter ou retirer la page sélectionnée des favoris. En double page, le numéro affiché dans le bouton précise laquelle des deux pages est concernée. La liste des favoris permet de rejoindre directement une page ; ses images sont vérifiées à nouveau avant affichage.

Les favoris sont conservés localement, séparément pour Hafs et Warsh. Ils sont associés à la source déclarée par l’édition : une autre version de la source ne réutilise pas des numéros de pages potentiellement différents. Les données locales malformées et les numéros hors limites sont ignorés. Aucun favori ne peut être ajouté tant que la page n’est pas vérifiée. Si l’enregistrement échoue, un message est affiché et le lecteur ne présente pas le favori comme enregistré.

Les libellés suivent les cinq langues de l’interface. Les tests couvrent l’ajout, le retrait, l’actualisation, le changement de langue, la séparation des éditions, une source modifiée, les données corrompues et un stockage indisponible.


## Identité d’une édition et retrait d’un manifeste

La reprise de lecture et les favoris sont désormais liés à une empreinte SHA-256 de l’édition, de sa source et de la liste ordonnée des pages avec leurs empreintes. Un simple nom de source identique ne suffit plus à réutiliser des positions si les images ou leur ordre changent. Les anciennes positions sans cette identité ne sont pas reprises automatiquement ; la lecture classique par versets conserve son fonctionnement indépendant.

Une édition retirée ou interdite par le serveur (HTTP 401, 403, 404 ou 410), ainsi qu’un nouveau manifeste invalide ou non revu, fait supprimer le manifeste précédemment conservé dans le cache. Il ne peut donc plus réapparaître lors de l’ouverture suivante sans réseau. Un problème temporaire du serveur (par exemple HTTP 503) n’efface pas une édition locale valide ; son ouverture hors connexion reste possible.

Les tests simulent aussi une modification des octets des pages sans changement du libellé de source. Cette protection établit une identité technique ; elle ne remplace pas la revue éditoriale.






