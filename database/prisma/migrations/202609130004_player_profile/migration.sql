CREATE TABLE "player_profiles" (
  "playerId" UUID NOT NULL PRIMARY KEY,
  "surname" TEXT NOT NULL,
  "givenName" TEXT NOT NULL,
  "nickname" TEXT NOT NULL,
  "personalityTag" TEXT NOT NULL,
  CONSTRAINT "player_profiles_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "player_profile_identity_unique" ON "player_profiles"("surname", "givenName", "nickname");
