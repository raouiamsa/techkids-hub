/*
  Warnings:

  - A unique constraint covering the columns `[url]` on the table `ContentSource` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ContentSource_url_key" ON "ContentSource"("url");
