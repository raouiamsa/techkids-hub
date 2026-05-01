# TechKids Hub — Événements Inter-Services

Liste des événements asynchrones échangés entre les microservices via **RabbitMQ**.

---

## Événements

- `order.completed` → déclenche l'activation du cours acheté dans `edu-tracker-service`
- `order.cancelled` → notifie l'élève/parent de l'annulation
- `payment.failed` → notifie l'utilisateur de l'échec du paiement
- `stock.low` → alerte l'admin quand le stock d'un item est insuffisant
- `rental.started` → enregistre le début d'une location de kit
- `rental.returned` → enregistre le retour d'un kit loué
- `kit.activated` → déclenche le déverrouillage du cours lié via scan QR
- `user.registered` → crée le profil utilisateur + notifie les analytics
- `user.role.changed` → met à jour les permissions dans tous les services
- `enrollment.created` → confirme l'inscription d'un élève dans un cours
- `course.activatedForStudent` → notifie l'élève que son cours est accessible
- `progression.updated` → met à jour le dashboard parent + alimente l'IA
- `exercise.submitted` → enregistre la tentative + envoie à `ai-brain` pour analyse
- `quiz.completed` → calcule le score + met à jour la progression
- `certificate.earned` → notifie l'élève et le parent de l'obtention du certificat
- `lab.session.started` → enregistre le début d'une session de labo virtuel
- `lab.session.ended` → enregistre la durée de la session
- `lab.submission.validated` → enregistre la soumission validée dans `edu-tracker-service`
- `draft.created` → notifie l'admin qu'un brouillon IA est prêt pour review
- `draft.approved` → publie le module approuvé dans le LMS
- `module.published` → ajoute le nouveau module dans `edu-tracker-service`
- `recommendation.generated` → affiche les recommandations de kits sur le dashboard
- `difficulty.detected` → adapte la difficulté du labo virtuel pour l'élève en difficulté
- `notification.sent` → enregistre la notification dans les logs analytics

---
