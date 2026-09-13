ALTER TABLE "player_appearance" ADD COLUMN "faceId" TEXT;
ALTER TABLE "player_appearance" ADD COLUMN "headwearId" TEXT;
UPDATE "player_appearance" SET "faceId" = CASE WHEN "gender" = 'MALE' THEN 'M_FACE_01' ELSE 'F_FACE_01' END;
ALTER TABLE "player_appearance" ALTER COLUMN "faceId" SET NOT NULL;
