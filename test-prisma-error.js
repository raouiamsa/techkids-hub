const { PrismaClient, SourceType, DraftStatus } = require('@prisma/client');

const prisma = new PrismaClient();

async function testInsert() {
    try {
        console.log("1. Upsert Source...");
        const source = await prisma.contentSource.upsert({
            where: { url: "test-url-123" },
            update: { title: "Test Title" },
            create: { title: "Test Title", type: SourceType.PDF, url: "test-url-123" }
        });
        console.log("Source UPSERT OK:", source.id);

        console.log("2. Find First Teacher...");
        const teacher = await prisma.user.findFirst({ where: { role: 'TEACHER' } });
        if (!teacher) throw new Error("No teacher found in DB.");
        console.log("Teacher Found:", teacher.id);

        console.log("3. Create Draft...");
        const draft = await prisma.generatedDraft.create({
            data: {
                syllabus: "# Module 1 Fake Syllabus",
                content: "Fake content output from AI",
                teacherId: teacher.id,
                sourceId: source.id,
                status: DraftStatus.PENDING_REVIEW
            }
        });
        console.log("Draft Create OK:", draft.id);

    } catch (e) {
        console.error("ERREUR PRISMA COMPLÈTE :");
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

testInsert();
