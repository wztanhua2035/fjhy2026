# Quest Dialogue and NPC Voice V1

Quest dialogue belongs to `QuestConfig.dialogues`, not to a Web or WeChat screen. Each line uses a stable `speakerId`; `PLAYER` represents the protagonist and every other value must be an enabled NPC ID.

The supported moments are `accept`, `steps`, `completion`, and `repeat`. `steps` follows the quest step order. A meaningful handoff, delivery, or report should have one or two short lines. Ambient and repeat lines remain short so functional NPCs stay quick to use.

Completion order is fixed: the relevant interaction records the completed step, the NPC completion dialogue plays, then the client calls the server-only quest finalize endpoint. The server checks `QUEST_READY_TO_COMPLETE`, verifies the final NPC location, removes a final delivery item if needed, and writes the one-time reward ledger entry. If the player exits during dialogue, the ready marker remains and the final NPC can replay the completion dialogue. Repeating finalize requests remain idempotent through the existing request ledger.

## White Stone Street voices

- **陈掌柜 (`NPC_001`)** — 厚道、稳重、熟悉地方；照顾年轻人但不说教。语句平实，有生活经验。
- **街坊杂货铺店员 (`NPC_GROCERY_CLERK`)** — 热络、麻利、熟悉街坊消息；生活化，不像销售机器人。
- **白石商行伙计 (`NPC_TRADE_CLERK`)** — 精明、利落、账目清楚；评价成色和价格，不夸张叫卖。
- **青丝美发师 (`NPC_SALON_HAIRDRESSER`)** — 细致、审美敏感、语气轻快；关注人是否精神、是否合适。
- **春衫掌柜 (`NPC_CLOTH_SHOPKEEPER`)** — 温和、讲究、重视面料和搭配；从容，不急着推销。

Task dialogue must not change shop prices, rewards, inventory rules, or player personality outcomes. Web and WeChat render the same server response and shared quest state.
