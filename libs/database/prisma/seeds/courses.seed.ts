/**
 * seeds/courses.seed.ts
 * Création des données de test Edu-Tracker :
 * 2 cours × 3 modules × 2 exercices = 12 exercices au total
 * Conforme au checklist Phase 2 ligne 71
 */

import { PrismaClient, CourseLevel, ExerciseType } from '@prisma/client';

// ── Données de test ─────────────────────────────────────────────────────────

const coursesData = [
    {
        title: 'Arduino pour débutants',
        description: "Découverte de l'électronique avec Arduino — LED, capteurs, et circuits simples.",
        level: CourseLevel.BEGINNER,
        modules: [
            {
                title: 'Introduction à Arduino',
                order: 1,
                content: '# Introduction à Arduino\n\nArduino est une plateforme open-source permettant de créer des projets électroniques interactifs.',
                exercises: [
                    {
                        title: 'Quiz : Les composants de base',
                        instructions: 'Identifiez les composants suivants : résistance, LED, condensateur.',
                        exerciseType: ExerciseType.QUIZ,
                        solution: "Résistance = limite le courant | LED = diode électroluminescente | Condensateur = stocke l'énergie",
                    },
                    {
                        title: 'Circuit : Première LED',
                        instructions: 'Montez un circuit simple avec une LED et une résistance de 220Ω sur le pin 13.',
                        exerciseType: ExerciseType.CIRCUIT_BUILD,
                        solution: 'LED(+) → 220Ω → pin13 | LED(-) → GND',
                    },
                ],
            },
            {
                title: 'LEDs et résistances',
                order: 2,
                content: "# LEDs et résistances\n\nUne LED sans résistance = LED grillée ! La résistance protège la LED en limitant le courant.",
                exercises: [
                    {
                        title: 'Quiz : Calcul de résistance',
                        instructions: 'Calculez la résistance pour une LED rouge (Vf=2V, If=20mA) alimentée en 5V.',
                        exerciseType: ExerciseType.QUIZ,
                        solution: 'R = (5-2) / 0.02 = 150Ω → arrondir à 220Ω (valeur standard)',
                    },
                    {
                        title: 'Code : LED clignotante',
                        instructions: 'Écrivez le code Arduino pour faire clignoter une LED toutes les 500ms.',
                        exerciseType: ExerciseType.CODE_CHALLENGE,
                        solution: 'void loop() { digitalWrite(13, HIGH); delay(500); digitalWrite(13, LOW); delay(500); }',
                    },
                ],
            },
            {
                title: 'Capteurs et entrées',
                order: 3,
                content: '# Capteurs et entrées\n\nLes capteurs permettent à Arduino de lire le monde réel : température, lumière, distance...',
                exercises: [
                    {
                        title: 'Quiz : Types de capteurs',
                        instructions: 'Quel capteur utilise-t-on pour mesurer la température ? La luminosité ?',
                        exerciseType: ExerciseType.QUIZ,
                        solution: 'Température : DHT11/DS18B20 | Luminosité : LDR (photorésistance)',
                    },
                    {
                        title: 'Code : Lecture capteur température',
                        instructions: "Écrivez le code pour lire la température avec un DHT11 et l'afficher sur le moniteur série.",
                        exerciseType: ExerciseType.CODE_CHALLENGE,
                        solution: 'dht.read11(DHT_PIN); Serial.print("Temp: "); Serial.println(dht.temperature);',
                    },
                ],
            },
        ],
    },
    {
        title: 'Programmation avec Scratch',
        description: 'Initiation à la programmation visuelle par blocs avec Scratch — logique, boucles, conditions.',
        level: CourseLevel.BEGINNER,
        modules: [
            {
                title: 'Introduction à Scratch',
                order: 1,
                content: '# Introduction à Scratch\n\nScratch est un langage de programmation visuel créé par le MIT pour apprendre à coder.',
                exercises: [
                    {
                        title: "Quiz : L'interface Scratch",
                        instructions: "Identifiez les 4 zones de l'interface Scratch : Scène, Lutins, Scripts, Palette de blocs.",
                        exerciseType: ExerciseType.QUIZ,
                        solution: "Scène = zone d'exécution | Lutins = personnages | Scripts = code | Palette = blocs disponibles",
                    },
                    {
                        title: 'Code : Premier programme',
                        instructions: 'Créez un programme qui fait bouger le lutin quand on appuie sur la flèche droite.',
                        exerciseType: ExerciseType.CODE_CHALLENGE,
                        solution: 'Quand [flèche droite ▼] pressée → Avancer de (10) pas',
                    },
                ],
            },
            {
                title: 'Boucles et conditions',
                order: 2,
                content: '# Boucles et conditions\n\nLes boucles répètent des actions. Les conditions décident quoi faire selon une situation.',
                exercises: [
                    {
                        title: 'Quiz : Boucles vs répétitions',
                        instructions: "Quelle est la différence entre 'Répéter 10 fois' et 'Répéter jusqu'à ce que' ?",
                        exerciseType: ExerciseType.QUIZ,
                        solution: "'Répéter N fois' = boucle bornée | 'Jusqu'à ce que' = boucle conditionnelle (s'arrête selon condition)",
                    },
                    {
                        title: 'Code : Jeu de déplacement',
                        instructions: 'Créez un programme où le lutin rebondit sur les bords et change de couleur à chaque rebond.',
                        exerciseType: ExerciseType.CODE_CHALLENGE,
                        solution: 'Répéter indéfiniment → Avancer(10) → Si au bord, rebondir → Changer couleur de (25)',
                    },
                ],
            },
            {
                title: 'Projet final : Animation interactive',
                order: 3,
                content: "# Projet final\n\nAppliquez tout ce que vous avez appris pour créer une animation interactive complète avec Scratch.",
                exercises: [
                    {
                        title: 'Quiz : Récapitulatif Scratch',
                        instructions: 'Quels blocs utilise-t-on pour : détecter un clic, jouer un son, changer de costume ?',
                        exerciseType: ExerciseType.QUIZ,
                        solution: 'Clic = [quand ce lutin est cliqué] | Son = [jouer son] | Costume = [basculer costume]',
                    },
                    {
                        title: 'Code : Mini-jeu complet',
                        instructions: 'Créez un mini-jeu où le lutin attrape des étoiles tombantes et compte le score.',
                        exerciseType: ExerciseType.CODE_CHALLENGE,
                        solution: 'Variable Score | Clone étoile → tombe → si touche lutin → Score +1 → supprimer clone',
                    },
                ],
            },
        ],
    },
];

// ── Fonction principale ──────────────────────────────────────────────────────

export async function seedCourses(prisma: PrismaClient) {
    console.log('\n── Cours, Modules et Exercices de test ──');

    const teacher = await prisma.user.findUnique({ where: { email: 'teacher@techkids.com' } });
    if (!teacher) throw new Error('❌ Teacher introuvable — seedUsers() doit être lancé avant seedCourses()');

    for (const courseData of coursesData) {
        // Créer le cours s'il n'existe pas
        let course = await prisma.course.findFirst({
            where: { title: courseData.title, teacherId: teacher.id },
        });
        if (!course) {
            course = await prisma.course.create({
                data: {
                    title: courseData.title,
                    description: courseData.description,
                    level: courseData.level,
                    isPublished: true,
                    teacherId: teacher.id,
                },
            });
        }
        console.log(`\n  📚 "${course.title}"`);

        for (const moduleData of courseData.modules) {
            // Créer le module s'il n'existe pas
            let module = await prisma.module.findFirst({
                where: { title: moduleData.title, courseId: course.id },
            });
            if (!module) {
                module = await prisma.module.create({
                    data: {
                        title: moduleData.title,
                        order: moduleData.order,
                        content: moduleData.content,
                        courseId: course.id,
                    },
                });
            }
            console.log(`    📖 Module ${moduleData.order} : "${module.title}"`);

            for (const ex of moduleData.exercises) {
                // Créer l'exercice s'il n'existe pas
                const existing = await prisma.exercise.findFirst({
                    where: { title: ex.title, moduleId: module.id },
                });
                if (!existing) {
                    await prisma.exercise.create({
                        data: {
                            title: ex.title,
                            instructions: ex.instructions,
                            exerciseType: ex.exerciseType,
                            solution: ex.solution,
                            moduleId: module.id,
                        },
                    });
                }
                console.log(`      ✏️  [${ex.exerciseType.padEnd(15)}] "${ex.title}"`);
            }
        }
    }
}
