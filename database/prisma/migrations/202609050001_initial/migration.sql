-- CreateTable
CREATE TABLE "players" (
    "id" UUID NOT NULL,
    "wechat_subject_hash" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "cash" BIGINT NOT NULL DEFAULT 0,
    "stamina" INTEGER NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sceneId" TEXT NOT NULL DEFAULT 'INTERIOR_B_INN',
    "x" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "tradeCounts" JSONB NOT NULL DEFAULT '{}',
    "metNpcs" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_appearance" (
    "playerId" UUID NOT NULL,
    "gender" TEXT NOT NULL,
    "baseAvatarId" TEXT NOT NULL,
    "hairStyleId" TEXT NOT NULL,
    "hairColorId" TEXT NOT NULL,
    "topStyleId" TEXT NOT NULL,
    "topColorId" TEXT NOT NULL,
    "bottomStyleId" TEXT NOT NULL,
    "bottomColorId" TEXT NOT NULL,
    "shoesId" TEXT NOT NULL,
    "accessoryIds" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_appearance_pkey" PRIMARY KEY ("playerId")
);

-- CreateTable
CREATE TABLE "player_inventory" (
    "playerId" UUID NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "player_inventory_pkey" PRIMARY KEY ("playerId","itemId")
);

-- CreateTable
CREATE TABLE "player_cosmetics" (
    "playerId" UUID NOT NULL,
    "appearanceId" TEXT NOT NULL,
    "obtainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_cosmetics_pkey" PRIMARY KEY ("playerId","appearanceId")
);

-- CreateTable
CREATE TABLE "player_ledger" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "before" BIGINT NOT NULL,
    "after" BIGINT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_requests" (
    "playerId" UUID NOT NULL,
    "requestId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_requests_pkey" PRIMARY KEY ("playerId","requestId")
);

-- CreateTable
CREATE TABLE "ghost_snapshots" (
    "playerId" UUID NOT NULL,
    "snapshot" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ghost_snapshots_pkey" PRIMARY KEY ("playerId")
);

-- CreateTable
CREATE TABLE "world_releases" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "config" JSONB NOT NULL,
    "basedOn" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "world_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit" (
    "id" UUID NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_mailbox" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "mailType" TEXT NOT NULL,
    "senderPlayerId" UUID,
    "title" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNCLAIMED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "player_mailbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_transactions" (
    "id" UUID NOT NULL,
    "senderPlayerId" UUID NOT NULL,
    "receiverPlayerId" UUID NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "affinityDelta" INTEGER NOT NULL,
    "sceneId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "gift_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_relationships" (
    "playerA" UUID NOT NULL,
    "playerB" UUID NOT NULL,
    "affinity" INTEGER NOT NULL DEFAULT 0,
    "relationshipLevel" INTEGER NOT NULL DEFAULT 0,
    "giftCount" INTEGER NOT NULL DEFAULT 0,
    "lastInteractionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_relationships_pkey" PRIMARY KEY ("playerA","playerB")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "plotId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "propertyType" TEXT NOT NULL,
    "purchasePrice" BIGINT NOT NULL,
    "currentValue" BIGINT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "customName" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "players_wechat_subject_hash_key" ON "players"("wechat_subject_hash");

-- CreateIndex
CREATE INDEX "player_ledger_playerId_createdAt_idx" ON "player_ledger"("playerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "player_ledger_playerId_requestId_key" ON "player_ledger"("playerId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "world_releases_version_key" ON "world_releases"("version");

-- CreateIndex
CREATE INDEX "player_mailbox_playerId_status_idx" ON "player_mailbox"("playerId", "status");

-- CreateIndex
CREATE INDEX "gift_transactions_senderPlayerId_createdAt_idx" ON "gift_transactions"("senderPlayerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "properties_plotId_key" ON "properties"("plotId");

-- AddForeignKey
ALTER TABLE "player_appearance" ADD CONSTRAINT "player_appearance_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_inventory" ADD CONSTRAINT "player_inventory_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_cosmetics" ADD CONSTRAINT "player_cosmetics_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_ledger" ADD CONSTRAINT "player_ledger_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_requests" ADD CONSTRAINT "idempotency_requests_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ghost_snapshots" ADD CONSTRAINT "ghost_snapshots_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invariants also enforced by PostgreSQL, independent of the API implementation.
ALTER TABLE "players" ADD CONSTRAINT "players_cash_bounds" CHECK ("cash" >= 0 AND "cash" <= 1000000000000);
ALTER TABLE "players" ADD CONSTRAINT "players_stamina_bounds" CHECK ("stamina" >= 0 AND "stamina" <= 100);
ALTER TABLE "player_inventory" ADD CONSTRAINT "inventory_positive" CHECK ("quantity" > 0);
ALTER TABLE "player_ledger" ADD CONSTRAINT "ledger_balances" CHECK ("after" = "before" + "amount" AND "before" >= 0 AND "after" >= 0);
CREATE UNIQUE INDEX "one_published_world" ON "world_releases" ("status") WHERE "status" = 'PUBLISHED';
