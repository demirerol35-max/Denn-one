# Deen One — contrat des notifications de prière (Web Push)

Le service worker reçoit les messages Web Push, mais **ne programme pas** leur envoi. Aucun serveur d'envoi ni abonnement Push n'est actuellement configuré dans ce dépôt.

## Format du message

Le serveur doit envoyer un JSON, par exemple :

```json
{
  "type": "prayer",
  "prayer": "Isha",
  "lang": "fr",
  "scheduledAt": 1795035600000
}
```

- `type` : exactement `prayer`.
- `prayer` : `Fajr`, `Dhuhr`, `Asr`, `Maghrib` ou `Isha`.
- `lang` : `fr`, `tr`, `ar`, `en` ou `de` (français par défaut).
- `scheduledAt` : **obligatoire**, entier sûr représentant l'heure de prière en millisecondes Unix UTC, calculée à partir du fuseau horaire local choisi.
- Le texte affiché est généré par le service worker dans la langue choisie ; le serveur ne fournit pas de texte libre.

Les messages reçus **avant** `scheduledAt` ou plus de 10 minutes après sont ignorés. Le serveur doit éviter les doublons et recalculer les horaires lors des changements de ville, de méthode de calcul ou de fuseau horaire.

## Travail restant avant fonctionnement Android

1. Demander la permission de notification par une action explicite de l'utilisateur.
2. Créer un abonnement `PushManager.subscribe` avec une clé publique VAPID.
3. Conserver les abonnements de façon sécurisée côté serveur, avec désinscription et suppression des données.
4. Programmer les cinq prières avec le bon fuseau horaire et gérer les changements d'heure.
5. Envoyer les messages signés avec les clés privées VAPID **uniquement sur le serveur**, jamais dans GitHub Pages.
6. Tester sur Android application ouverte, en arrière-plan et fermée, ainsi qu'après redémarrage du téléphone.

GitHub Pages seul ne peut pas déclencher ces messages à une heure donnée. Le service worker ne garantit pas non plus la lecture automatique de l'Adhan ou une vibration particulière : ces comportements nécessitent des tests et éventuellement une application Android native.

## Architecture d'envoi retenue (à implémenter)

- **Application cliente** : demande l'autorisation uniquement après un clic explicite ; souscrit avec la clé VAPID publique ; transmet l'abonnement au serveur via HTTPS ; propose la désinscription.
- **API sécurisée** : enregistre un abonnement avec un identifiant aléatoire non devinable, la ville/pays, la méthode de calcul, le fuseau horaire et les prières activées ; permet de mettre à jour ou supprimer ces données. Ne jamais exposer les clés privées dans le navigateur ni le dépôt public.
- **Planificateur serveur** : recalcule les horaires de chaque journée pour chaque localisation, convertit l'heure locale en instant UTC et déduplique chaque envoi par abonnement, prière et date locale. Prévoir un contrôle des fuseaux et changements d'heure.
- **Émetteur Web Push** : envoie uniquement le format JSON ci-dessus avec une authentification VAPID ; supprime les abonnements expirés (HTTP 404/410) et limite les tentatives.
- **Protection des données** : minimiser les données (ville plutôt que GPS si possible), imposer HTTPS, quotas et limitation des requêtes ; permettre la révocation des abonnements et éviter de conserver des coordonnées inutiles.

**Statut actuel : architecture documentée, pas de serveur déployé.** L'application sur GitHub Pages ne peut pas réaliser seule les étapes API, planification et émission.

## Tests de validation avant activation

1. France, Turquie et Algérie : comparer cinq horaires et leur fuseau à la source affichée.
2. Changer de ville ou de méthode : vérifier que les anciennes alertes sont annulées côté serveur.
3. Recevoir exactement une alerte par prière à l'heure prévue, pas avant et pas après dix minutes.
4. Tester l'abonnement, la désinscription, le refus de permission et l'expiration de l'abonnement.
5. Tester Samsung Android avec l'application visible, en arrière-plan, fermée et après redémarrage.
6. Vérifier les traductions FR, TR, AR, EN et DE ; vérifier qu'aucun Adhan automatique n'est promis sans prise en charge native.
