# Deen One — feuille de route priorisée (19 novembre 2026)

**Nom officiel : Deen One.** « Nour Al-Imane » reste un candidat, sans renommage. Application gratuite pour tous, sans Premium ; localisation et données privées minimisées.

## P0 — Fiabilité indispensable avant publication
1. **Notifications Android en arrière-plan** — Service worker de réception existant ; planificateur et tests ajoutés. À construire : API d'abonnement HTTPS, stockage chiffré/protégé, clé VAPID serveur, tâche planifiée, révocation, contrôle des doublons et tests sur appareil fermé. Ne jamais promettre de son Adhan automatique en arrière-plan dans la PWA.
2. **Lecture du Coran hors connexion** — Le cache actuel ne couvre que la coque statique, pas le texte/audio coranique. Fournir des packs de sourates téléchargeables volontairement, versionnés, avec origine et licence vérifiées, estimation d'espace, suppression et vérification d'intégrité. Aucun stockage automatique de données personnelles.
3. **Sauvegarde privée des progrès** — Export/import local chiffré par phrase secrète (Web Crypto), sans serveur ni compte ; inclure schéma/version, contrôle de validité et confirmation avant remplacement. Ne pas inclure localisation GPS ni abonnement push.

## P1 — Usage quotidien
4. **Widget des cinq prières** — Pour Android natif : widget d'écran d'accueil avec actualisation, localisation choisie et cinq horaires. Une PWA GitHub Pages ne peut pas installer un véritable widget Android ; commencer par une carte compacte dans l'app, puis développer le composant Android lors de l'emballage natif.
5. **Objectifs Coran et mémorisation** — Lecture quotidienne facultative (5/10/20 min), position de reprise, révisions espacées et statistiques locales ; ne pas pénaliser les jours manqués.
6. **Espace enfants** — Parcours lettres arabes, petites sourates, histoires adaptées et quiz ; validation pédagogique et sources, contrôle parental local, sans publicité ni collecte d'identité des enfants.

## P2 — Élargissement
7. **Ramadan** — Souhour/Iftar calculés selon lieu et méthode ; calendrier et invocations sourcées ; suivi du jeûne facultatif ; gérer les avis locaux et les cas particuliers.
8. **Recherche de mosquées** — Carte/liste via fournisseur de données documenté, recherche par ville sans GPS obligatoire ; signaler que les horaires et lieux doivent être vérifiés, respecter quotas et vie privée.


## Coran — deux éditions Mushaf distinctes (demande du 22 novembre 2026)
- **Hafs ‘an ‘Âsim** : Mushaf de Médine avec pagination et texte authentiques, navigation droite-gauche.
- **Warsh ‘an Nâfi‘** : édition Mushaf Warsh vérifiée, avec sa propre graphie, vocalisation, pagination et récitations correspondantes. Ne pas réutiliser artificiellement la mise en page Hafs.
- Sélecteur explicite **Hafs / Warsh** dans la rubrique Coran, choix mémorisé localement, et affichage permanent de l'édition active.
- Chaque édition doit disposer d'une source documentée, d'une autorisation/licence de diffusion, d'une validation éditoriale et de tests de correspondance texte–page–audio avant activation.
- La lecture actuelle verset par verset reste disponible indépendamment du futur mode Mushaf. Ne pas afficher le mode Mushaf comme terminé avant intégration réelle des pages.

## Critères de livraison
- FR/TR/AR/EN/DE, dont RTL arabe, et test sur petits écrans.
- Aucune permission sensible sans action ou choix clair ; aucun secret dans le dépôt GitHub Pages.
- Tests automatiques + essais sur Samsung Android (app visible, fermée, redémarrée).
- Distinguer « code préparé », « testé » et « fonctionnel en production ».
