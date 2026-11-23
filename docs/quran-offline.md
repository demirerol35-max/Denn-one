# Lecture classique du Coran hors connexion

L’utilisateur peut enregistrer la sourate affichée avec son texte arabe, sa translittération et la traduction sélectionnée. La copie reste sur l’appareil ; aucun fichier audio n’est téléchargé. La liste permet de rouvrir une copie sans solliciter le réseau et de la supprimer. Les traductions d’une même sourate sont enregistrées séparément.

Les réponses doivent correspondre à la sourate et à l’identifiant d’édition demandés, avec une suite de versets complète et identique entre les trois éditions. Une édition manquante laisse la lecture arabe disponible, mais désactive l’enregistrement. Les extraits provisoires intégrés à l’application ne peuvent pas être enregistrés comme des copies du fournisseur.

Les textes sont conservés tels que reçus, sans modification des signes ou de l’orthographe. Le nom de chaque édition, dont celui du traducteur fourni par l’API, apparaît sous les commandes de sauvegarde. Le format local est versionné et son empreinte SHA-256 est contrôlée avant chaque ouverture. Cette empreinte détecte une altération de la copie ; elle ne certifie pas l’authenticité éditoriale du fournisseur.

Le stockage accepte 20 copies au maximum, langues comprises, avec une limite globale de 12 Mio et de 2 Mio par copie. Une mise à jour remplace uniquement la même sourate dans la même langue. Le quota ou un stockage inaccessible produit un message d’échec ; aucune ancienne copie n’est évincée automatiquement. Les copies illisibles restent dans la liste afin de pouvoir les supprimer. Le navigateur peut lui-même libérer ce stockage : il ne s’agit pas d’une sauvegarde permanente.

Le catalogue conserve les 114 choix après une première récupération valide. Sans catalogue, les numéros restent sélectionnables et les noms des copies présentes sont repris. Le choix de sourate et les positions de lecture restent disponibles lors d’une réouverture hors connexion. Le module de stockage fait partie de la coque conservée par le service worker ; son cache de textes est indépendant des caches de pages Mushaf.

## Source et conditions consultées le 23 novembre 2026

- API utilisée : [AlQuran Cloud](https://alquran.cloud/api), déjà utilisée par la lecture classique.
- [Conditions du fournisseur](https://alquran.cloud/terms-and-conditions) : conservation et affichage du texte autorisés, en conservant exactement ses signes et son orthographe ; attribution des traductions à leurs auteurs.
- Éditions : `ar.alafasy`, `en.transliteration` et, selon le choix, `fr.hamidullah`, `en.sahih`, `tr.diyanet` ou `de.bubenheim`.
- Ces copies personnelles ne constituent pas une publication de packs coraniques ou une validation des éditions Mushaf Hafs/Warsh. Les pages Mushaf restent soumises à la procédure décrite dans `mushaf-sources.md`.

## Vérifications

`node --test tests/quran-offline.test.mjs` vérifie la séparation des sourates et langues, les réponses incomplètes, le quota, les écritures échouées, la corruption, la suppression, l’annulation et le délai réseau.

`npx playwright test --config playwright.quran.config.cjs` vérifie le parcours utilisateur sur écran mobile : enregistrement explicite, véritable rechargement hors réseau avec service worker, reprise au verset enregistré, langues de traduction séparées, suppression, échec de stockage, texte incomplet et changement de sourate pendant un chargement. Les données de ces tests sont synthétiques et ne contiennent pas de texte coranique.

Les essais sur un téléphone Android réel restent à effectuer.
