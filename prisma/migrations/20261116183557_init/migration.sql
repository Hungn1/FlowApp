-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'me',
    "name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "headline" TEXT NOT NULL DEFAULT '',
    "linkedin" TEXT NOT NULL DEFAULT '',
    "github" TEXT NOT NULL DEFAULT '',
    "portfolio" TEXT NOT NULL DEFAULT '',
    "otherLinks" TEXT NOT NULL DEFAULT '[]',
    "rawResumeText" TEXT NOT NULL DEFAULT '',
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Experience" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "start" TEXT NOT NULL DEFAULT '',
    "end" TEXT NOT NULL DEFAULT '',
    "isTechRole" BOOLEAN NOT NULL DEFAULT false,
    "bullets" TEXT NOT NULL DEFAULT '[]',
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Experience_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'technical',
    "level" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Skill_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Education" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "school" TEXT NOT NULL,
    "degree" TEXT NOT NULL DEFAULT '',
    "field" TEXT NOT NULL DEFAULT '',
    "start" TEXT NOT NULL DEFAULT '',
    "end" TEXT NOT NULL DEFAULT '',
    "coursework" TEXT NOT NULL DEFAULT '[]',
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Education_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT NOT NULL DEFAULT '',
    "issued" TEXT NOT NULL DEFAULT '',
    "expires" TEXT NOT NULL DEFAULT '',
    "credentialUrl" TEXT NOT NULL DEFAULT '',
    "inProgress" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Certification_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'personal',
    "description" TEXT NOT NULL DEFAULT '',
    "bullets" TEXT NOT NULL DEFAULT '[]',
    "tools" TEXT NOT NULL DEFAULT '[]',
    "url" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Project_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Track" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "summary" TEXT NOT NULL DEFAULT '',
    "emphasis" TEXT NOT NULL DEFAULT 'general',
    "keywords" TEXT NOT NULL DEFAULT '[]',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TrackItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "TrackItem_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "workMode" TEXT NOT NULL DEFAULT 'unknown',
    "payMin" INTEGER,
    "payMax" INTEGER,
    "payPeriod" TEXT NOT NULL DEFAULT '',
    "sourceUrl" TEXT NOT NULL DEFAULT '',
    "rawDescription" TEXT NOT NULL DEFAULT '',
    "minYears" REAL,
    "maxYears" REAL,
    "requiredDegree" TEXT NOT NULL DEFAULT '',
    "requiredCerts" TEXT NOT NULL DEFAULT '[]',
    "deadline" DATETIME,
    "labeledEntryLevel" BOOLEAN NOT NULL DEFAULT false,
    "entryLevelVerdict" TEXT NOT NULL DEFAULT 'true',
    "entryLevelReasons" TEXT NOT NULL DEFAULT '[]',
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Job_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Requirement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'hard',
    "category" TEXT NOT NULL DEFAULT 'skill',
    "matched" BOOLEAN NOT NULL DEFAULT false,
    "coveredBy" TEXT NOT NULL DEFAULT '[]',
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Requirement_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Saved',
    "boardOrder" REAL NOT NULL DEFAULT 0,
    "appliedAt" DATETIME,
    "lastResponseAt" DATETIME,
    "followUpDate" DATETIME,
    "nextAction" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "linkedin" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Contact_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "changes" TEXT NOT NULL DEFAULT '[]',
    "matchScore" INTEGER,
    "missingKeywords" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Material_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InterviewQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "InterviewQuestion_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Track_slug_key" ON "Track"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TrackItem_trackId_itemType_itemId_key" ON "TrackItem"("trackId", "itemType", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_jobId_key" ON "Application"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "Material_jobId_kind_key" ON "Material"("jobId", "kind");
