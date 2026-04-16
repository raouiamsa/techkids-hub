/**
 * seeds/courses.seed.ts
 * Création des données de test détaillées (Rich Content Ready).
 * 2 cours × 3 modules × 2 exercices = 12 exercices au total.
 */

import { PrismaClient, CourseLevel, ExerciseType } from '@prisma/client';

const coursesData = [
    {
        title: 'Arduino pour débutants',
        description: "Découverte de l'électronique avec Arduino — LED, capteurs, et circuits simples.",
        level: CourseLevel.BEGINNER,
        placementBank: [],
        certificationBank: [],
        finalProject: {
            title: "Station Météo Intelligente",
            description: "Crée une station qui affiche la température et allume une alarme si la chaleur est trop forte.",
            steps: ["Brancher le capteur DHT11", "Configurer le seuil de température", "Tester l'alarme sonore"],
            solution: "void setup() { ... }"
        },
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
                        solution: "Résistance = limite le courant | LED = diode électroluminescente",
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
                        solution: 'R = (5-2) / 0.02 = 150Ω → arrondir à 220Ω',
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
                        instructions: 'Quel capteur utilise-t-on pour mesurer la température ?',
                        exerciseType: ExerciseType.QUIZ,
                        solution: 'Température : DHT11/DS18B20 | Luminosité : LDR',
                    },
                    {
                        title: 'Code : Lecture capteur température',
                        instructions: "Écrivez le code pour lire la température avec un DHT11.",
                        exerciseType: ExerciseType.CODE_CHALLENGE,
                        solution: 'dht.read11(DHT_PIN); Serial.println(dht.temperature);',
                    },
                ],
            },
        ],
    },
    {
        title: 'Programmation avec Scratch',
        description: 'Initiation à la programmation visuelle par blocs — logique, boucles, conditions.',
        level: CourseLevel.BEGINNER,
        placementBank: [],
        certificationBank: [],
        finalProject: {
            title: "Labyrinthe Interactif",
            description: "Crée un jeu de labyrinthe où le personnage doit éviter les murs pour atteindre un trésor.",
            steps: ["Dessiner le labyrinthe", "Gérer les déplacements fléchés", "Détecter la collision avec le noir"],
            solution: "Bloc Si [Touche couleur Noir] alors [Retour Départ]"
        },
        modules: [
            {
                title: 'Introduction à Scratch',
                order: 1,
                content: '# Introduction à Scratch\n\nScratch est un langage de programmation visuel créé par le MIT.',
                exercises: [
                    {
                        title: "Quiz : L'interface Scratch",
                        instructions: "Identifiez les zones de l'interface Scratch.",
                        exerciseType: ExerciseType.QUIZ,
                        solution: "Scène = zone d'exécution | Lutins = personnages",
                    },
                    {
                        title: 'Code : Premier programme',
                        instructions: 'Faire bouger le lutin quand on appuie sur la flèche droite.',
                        exerciseType: ExerciseType.CODE_CHALLENGE,
                        solution: 'Quand [flèche droite] pressée → Avancer de (10) pas',
                    },
                ],
            },
            {
                title: 'Boucles et conditions',
                order: 2,
                content: '# Boucles et conditions\n\nLes boucles répètent des actions. Les conditions décident quoi faire.',
                exercises: [
                    {
                        title: 'Quiz : Boucles vs répétitions',
                        instructions: "Différence entre 'Répéter 10 fois' et 'Jusqu'à ce que' ?",
                        exerciseType: ExerciseType.QUIZ,
                        solution: "'Répéter N fois' = boucle bornée | 'Jusqu'à ce que' = boucle conditionnelle",
                    },
                    {
                        title: 'Code : Jeu de déplacement',
                        instructions: 'Lutin rebondit sur les bords et change de couleur.',
                        exerciseType: ExerciseType.CODE_CHALLENGE,
                        solution: 'Répéter indéfiniment → Avancer(10) → Si au bord, rebondir',
                    },
                ],
            },
            {
                title: 'Projet final : Animation',
                order: 3,
                content: "# Projet final\n\nAppliquez tout ce que vous avez appris pour créer une animation.",
                exercises: [
                    {
                        title: 'Quiz : Récapitulatif',
                        instructions: 'Quels blocs pour : jouer un son, changer de costume ?',
                        exerciseType: ExerciseType.QUIZ,
                        solution: 'Son = [jouer son] | Costume = [basculer costume]',
                    },
                    {
                        title: 'Code : Mini-jeu complet',
                        instructions: 'Attraper des étoiles tombantes et compter le score.',
                        exerciseType: ExerciseType.CODE_CHALLENGE,
                        solution: 'Variable Score | Si touche lutin → Score +1',
                    },
                ],
            },
        ],
    },
];

export async function seedCourses(prisma: PrismaClient) {
    console.log('\n── Cours, Modules et Exercices de test (Seed Riche & AI Ready) ──');

    const teacher = await prisma.user.findUnique({ where: { email: 'teacher@techkids.com' } });
    if (!teacher) throw new Error('Teacher introuvable — seedUsers() doit être lancé avant seedCourses()');

    for (const courseData of coursesData) {
        // 1. Créer ou mettre à jour le cours (Idempotency)
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
                    placementBank: courseData.placementBank,
                    certificationBank: courseData.certificationBank,
                    finalProject: courseData.finalProject
                },
            });
        } else {
            // Mise à jour pour s'assurer que les nouveaux champs JSON existent
            course = await prisma.course.update({
                where: { id: course.id },
                data: {
                    placementBank: course.placementBank ?? [],
                    certificationBank: course.certificationBank ?? [],
                    finalProject: course.finalProject ?? courseData.finalProject
                }
            });
        }

        console.log(`\n"${course.title}"`);

        for (const moduleData of courseData.modules) {
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
            console.log(`Module ${moduleData.order} : "${module.title}"`);

            for (const ex of moduleData.exercises) {
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
            }
        }
    }
}