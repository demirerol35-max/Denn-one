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

