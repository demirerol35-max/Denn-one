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
- `body` : texte facultatif, limité à 160 caractères côté réception.

Les messages reçus plus de 10 minutes après ou plus de 2 minutes avant `scheduledAt` sont ignorés. Le serveur doit éviter les doublons et recalculer les horaires lors des changements de ville, de méthode de calcul ou de fuseau horaire.

## Travail restant avant fonctionnement Android

1. Demander la permission de notification par une action explicite de l'utilisateur.
2. Créer un abonnement `PushManager.subscribe` avec une clé publique VAPID.
3. Conserver les abonnements de façon sécurisée côté serveur, avec désinscription et suppression des données.
4. Programmer les cinq prières avec le bon fuseau horaire et gérer les changements d'heure.
5. Envoyer les messages signés avec les clés privées VAPID **uniquement sur le serveur**, jamais dans GitHub Pages.
6. Tester sur Android application ouverte, en arrière-plan et fermée, ainsi qu'après redémarrage du téléphone.

GitHub Pages seul ne peut pas déclencher ces messages à une heure donnée. Le service worker ne garantit pas non plus la lecture automatique de l'Adhan ou une vibration particulière : ces comportements nécessitent des tests et éventuellement une application Android native.
