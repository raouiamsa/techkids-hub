/**
 * libs/database/prisma/seed.ts
 * Point d'entrée principal du seed.
 * Appelle chaque seed spécifique à son domaine.
 *
 * Commande : npx prisma db seed --schema=libs/database/prisma/schema.prisma
 */

import { PrismaClient } from '@prisma/client';
import { seedUsers } from './seeds/users.seed';
import { seedCourses } from './seeds/courses.seed';

const prisma = new PrismaClient();

async function main() {
    console.log(' Démarrage du seed principal...');

    await seedUsers(prisma);    // Comptes système (ADMIN, TEACHER)
    await seedCourses(prisma);  // Cours, Modules, Exercices Edu-Tracker

    // ── Résumé ────────────────────────────────────────────────
    const stats = {
        users: await prisma.user.count(),
        courses: await prisma.course.count(),
        modules: await prisma.module.count(),
        exercises: await prisma.exercise.count(),
    };

    console.log('\n Seed global terminé !');
    console.log(`    Users     : ${stats.users}`);
    console.log(`    Cours     : ${stats.courses}`);
    console.log(`    Modules   : ${stats.modules}`);
    console.log(`     Exercices : ${stats.exercises}`);
    console.log('\n  Login → POST /api/auth/login');
    console.log('  { "email": "teacher@techkids.com", "password": "Teacher123!" }');
}

main()
    .catch((e) => {
        console.error(' Erreur globale seed :', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
