-- A single action may both trade and award a quest, or accept and advance a quest.
-- Idempotency is enforced by idempotency_requests(playerId, requestId).
DROP INDEX IF EXISTS "player_ledger_playerId_requestId_key";
