/**
 * seeds/users.seed.ts
 * Création des comptes système : ADMIN et TEACHER
 * Ces comptes sont pré-vérifiés (sans OTP).
 * PARENT et STUDENT se créent via l'inscription sur la plateforme.
 */

import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

const systemUsers = [
    {
        email: 'admin@techkids.com',
        password: 'Admin123!',
        role: UserRole.ADMIN,
        firstName: 'Admin',
        lastName: 'TechKids',
    },
    {
        email: 'teacher@techkids.com',
        password: 'Teacher123!',
        role: UserRole.TEACHER,
        firstName: 'Prof',
        lastName: 'TechKids',
    },
];

export async function seedUsers(prisma: PrismaClient) {
    console.log('\n── Comptes système (ADMIN, TEACHER) ──');

    for (const u of systemUsers) {
        const passwordHash = await bcrypt.hash(u.password, SALT_ROUNDS);

        const user = await prisma.user.upsert({
            where: { email: u.email },
            update: { isEmailVerified: true },
            create: {
                email: u.email,
                passwordHash,
                role: u.role,
                isEmailVerified: true,
                profile: {
                    create: { firstName: u.firstName, lastName: u.lastName },
                },
            },
        });

        console.log(`  ✅ ${u.role.padEnd(8)} → ${user.email}  (mdp: ${u.password})`);
    }
}
