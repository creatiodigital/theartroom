-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('artist', 'admin', 'curator', 'general');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "userType" "UserType" NOT NULL DEFAULT 'general',
    "handler" TEXT NOT NULL,
    "biography" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT,
    "profileImageUrl" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artwork" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "artworkType" TEXT NOT NULL DEFAULT 'image',
    "title" TEXT,
    "author" TEXT,
    "year" TEXT,
    "technique" TEXT,
    "dimensions" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "textContent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artwork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exhibition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "handler" TEXT NOT NULL,
    "mainTitle" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "bannerUrl" TEXT,
    "spaceId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exhibition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExhibitionArtwork" (
    "id" TEXT NOT NULL,
    "exhibitionId" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "wallId" TEXT NOT NULL,
    "posX2d" DOUBLE PRECISION NOT NULL,
    "posY2d" DOUBLE PRECISION NOT NULL,
    "width2d" DOUBLE PRECISION NOT NULL,
    "height2d" DOUBLE PRECISION NOT NULL,
    "posX3d" DOUBLE PRECISION NOT NULL,
    "posY3d" DOUBLE PRECISION NOT NULL,
    "posZ3d" DOUBLE PRECISION NOT NULL,
    "quaternionX" DOUBLE PRECISION NOT NULL,
    "quaternionY" DOUBLE PRECISION NOT NULL,
    "quaternionZ" DOUBLE PRECISION NOT NULL,
    "quaternionW" DOUBLE PRECISION NOT NULL,
    "showFrame" BOOLEAN NOT NULL DEFAULT false,
    "frameColor" TEXT NOT NULL DEFAULT '#000000',
    "frameThickness" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "showPassepartout" BOOLEAN NOT NULL DEFAULT false,
    "passepartoutColor" TEXT NOT NULL DEFAULT '#ffffff',
    "passepartoutThickness" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "fontFamily" TEXT NOT NULL DEFAULT 'Montserrat',
    "fontSize" DOUBLE PRECISION NOT NULL DEFAULT 16,
    "fontWeight" TEXT NOT NULL DEFAULT '400',
    "letterSpacing" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lineHeight" DOUBLE PRECISION NOT NULL DEFAULT 1.4,
    "textColor" TEXT NOT NULL DEFAULT '#000000',
    "textAlign" TEXT NOT NULL DEFAULT 'left',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExhibitionArtwork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_handler_key" ON "User"("handler");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Exhibition_url_key" ON "Exhibition"("url");

-- CreateIndex
CREATE UNIQUE INDEX "ExhibitionArtwork_exhibitionId_artworkId_key" ON "ExhibitionArtwork"("exhibitionId", "artworkId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- AddForeignKey
ALTER TABLE "Artwork" ADD CONSTRAINT "Artwork_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exhibition" ADD CONSTRAINT "Exhibition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExhibitionArtwork" ADD CONSTRAINT "ExhibitionArtwork_exhibitionId_fkey" FOREIGN KEY ("exhibitionId") REFERENCES "Exhibition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExhibitionArtwork" ADD CONSTRAINT "ExhibitionArtwork_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

