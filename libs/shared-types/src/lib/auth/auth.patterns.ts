// Patterns TCP pour l'auth-service
export const AUTH_PATTERNS = {
    REGISTER: { cmd: 'auth.register' },
    LOGIN: { cmd: 'auth.login' },
    VERIFY_EMAIL: { cmd: 'auth.verify-email' },
    RESEND_VERIFICATION: { cmd: 'auth.resend-verification' },
} as const;
