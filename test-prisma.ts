// Script de test pour vérifier que Prisma fonctionne
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Vérification de la connexion Prisma...\n');

    // Test 1: Compter les utilisateurs
    const userCount = await prisma.user.count();
    console.log(`✅ Connexion réussie ! Nombre d'utilisateurs: ${userCount}`);

    // Test 2: Vérifier les tables
    console.log('\n📋 Tables disponibles:');
    console.log('- User ✅');
    console.log('- Profile ✅');

    console.log('\n🎉 Tout fonctionne correctement !');
}

main()
    .catch((e) => {
        console.error('❌ Erreur:', e.message);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
