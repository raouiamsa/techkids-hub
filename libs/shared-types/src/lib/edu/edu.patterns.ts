// Patterns TCP pour l'edu-tracker-service
export const EDU_PATTERNS = {
    // Cours
    COURSES_LIST: { cmd: 'edu.courses.list' },
    COURSES_GET: { cmd: 'edu.courses.get' },
    COURSES_CREATE: { cmd: 'edu.courses.create' },
    // Modules
    MODULES_LIST: { cmd: 'edu.modules.list' },
    MODULES_GET: { cmd: 'edu.modules.get' },
    // Inscriptions
    ENROLL: { cmd: 'edu.enroll' },
    MY_ENROLLMENTS: { cmd: 'edu.enrollments.my' },
    // Progression
    UPDATE_PROGRESS: { cmd: 'edu.progress.update' },
    MY_PROGRESS: { cmd: 'edu.progress.my' },
    CHILD_PROGRESS: { cmd: 'edu.progress.child' }, // Pour les parents (progression enfant)
    // Exercices
    SUBMIT_EXERCISE: { cmd: 'edu.exercise.submit' },
    MY_SUBMISSIONS: { cmd: 'edu.submissions.my' },
    // Brouillons IA (Drafts)
    DRAFTS_CREATE: { cmd: 'edu.drafts.create' },
    DRAFTS_LIST: { cmd: 'edu.drafts.list' },
    DRAFTS_PUBLISH: { cmd: 'edu.drafts.publish' },
    DRAFTS_DELETE: { cmd: 'edu.drafts.delete' },
} as const;

