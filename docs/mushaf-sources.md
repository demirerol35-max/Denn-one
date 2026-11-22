# Mushaf Hafs et Warsh — provenance et décision de publication (22 novembre 2026)

## État
Le lecteur et les contrôles de manifeste et SHA-256 sont codés. **Aucune édition n'est actuellement publiée**, et aucun manifeste de pages n'est présent. Le contrôle cryptographique garantit l'identité des octets face au manifeste ; il ne garantit pas l'authenticité religieuse, ni les droits de reproduction.

## Sources candidates à examiner
1. **Quran Foundation / Quran.com** — documentation officielle de rendu de pages, API et ressources Mushaf : https://api-docs.quran.com/docs/tutorials/fonts/page-layout/ ; conditions https://api-docs.quran.com/docs/tutorials/faq/. L'API nécessite authentification ; les contenus ne doivent pas être copiés dans un dépôt public comme dataset. Un compte développeur, les crédits et la conformité aux conditions sont nécessaires. Ne jamais placer de jeton secret dans GitHub Pages.
2. **quran-ws/quran-svg** — pages SVG annoncées pour Hafs et Warsh, avec dossiers distincts et métadonnées de versets : https://github.com/quran-ws/quran-svg. La licence du calque de métadonnées (CC BY 4.0) ne suffit pas à prouver les droits des images calligraphiques sous-jacentes. Confirmer directement les autorisations de l'éditeur du Mushaf et les conditions applicables avant copie, intégration ou distribution.
3. **Quranpedia** — API indiquant des images et des éditions : https://api.quranpedia.net/. Confirmer pour chaque édition les droits de redistribution, l'origine et la pagination avant toute intégration.

## Critères de validation avant activation
- Une édition clairement identifiée (riwâya, éditeur, édition/version, pagination), revue par une personne qualifiée.
- Autorisation explicite compatible avec diffusion gratuite dans une application et avec son hébergement web, ainsi que mentions d'attribution.
- Manifeste complet : Hafs 604 pages pour l'édition de Médine choisie ; pagination Warsh conforme à **son édition exacte** (ne pas déduire qu'elle est identique à Hafs).
- Chaque image conservée localement dans le dossier de **sa propre édition** et comparée à son SHA-256 avant affichage.
- Tests sur téléphone : navigation, zoom/plein écran, rendu arabe, mémoire de page, réseau absent, intégrité et absence de confusion entre éditions.
- Ne pas publier des images obtenues sous des conditions interdisant leur redistribution dans un dépôt GitHub public.

## État des tests
Les tests automatisés portent sur le schéma, la séparation Hafs/Warsh, les bornes de navigation et la vérification d'intégrité. Ils ne valident pas encore le rendu Android, l'exactitude du texte, les permissions d'utilisation ou la disponibilité des pages.
