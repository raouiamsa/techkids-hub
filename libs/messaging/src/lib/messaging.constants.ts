/**
 * libs/messaging/src/lib/messaging.constants.ts
 *
 * Centralise tous les noms des queues et des événements RabbitMQ.
 * Toujours utiliser ces constantes pour éviter les fautes de frappe.
 */

/** Noms des queues RabbitMQ */
export const QUEUES = {
    MAIN: 'techkids_main_queue',
} as const;

/** Noms des événements inter-services */
export const EVENTS = {
    // ─── E-Commerce (PFE 1) ──────────────────────────────────────
    /** ecommerce-service → edu-tracker-service : commande payée */
    ORDER_COMPLETED: 'order.completed',
    /** ecommerce-service → logistique : location démarrée */
    RENTAL_STARTED: 'rental.started',
    /** ecommerce-service → logistique : item retourné */
    RENTAL_RETURNED: 'rental.returned',
    /** ecommerce-service → edu-tracker-service : kit activé via QR */
    KIT_ACTIVATED: 'kit.activated',

    // ─── Edu-Tracker (PFE 2) ─────────────────────────────────────
    /** edu-tracker → élève : cours déverouillé */
    COURSE_ACTIVATED_FOR_STUDENT: 'course.activatedForStudent',
    /** edu-tracker → analytics : progression mise à jour */
    PROGRESSION_UPDATED: 'progression.updated',

    // ─── Virtual Lab (PFE 3) ─────────────────────────────────────
    /** virtual-lab → edu-tracker : soumission validée */
    LAB_SUBMISSION_VALIDATED: 'lab.submission.validated',

    // ─── Content Generator (PFE 4) ───────────────────────────────
    /** content-generator → admins : draft IA créé */
    DRAFT_CREATED: 'draft.created',
    /** content-generator → edu-tracker : module publié */
    MODULE_PUBLISHED: 'module.published',
} as const;
