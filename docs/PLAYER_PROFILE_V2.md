# 玩家档案 V2

角色创建顺序：性别 → Face → Hair → Outfit → 姓名/外号 → 九句性格选择 → 确认。确认时一次提交外观与档案，成功后进入横阳客栈临时房。Headwear 暂为 `null`。

`PlayerProfile` 独立于 `PlayerAppearance`，保存 `surname`、`givenName`、`nickname`、`personalityTag`；正式姓名由前两项拼接。真正玩家主键仍为 `playerId`。姓和名各 1～2 个汉字，外号 2～3 个汉字；服务端先进行 NFC 规范化和首尾去空白，再统一校验。九句创建文案仅在共享配置中映射，档案只保存四字性格标签，不提供数值增益。

数据库 `player_profiles` 对 `(surname, givenName, nickname)` 建复合唯一索引。不同玩家并发提交同一组合时，失败请求返回 `PLAYER_IDENTITY_TAKEN`，外观、初始资金与档案同事务回滚。重开保留同一玩家的数据库身份行供再次选择原组合，但未重新建角前对客户端隐藏；改选其他组合时更新该行。

客户端随机姓名从 [`packages/game-config/player-profile.ts`](../packages/game-config/player-profile.ts) 的配置池选择，并最多重试八次可用性预查。预查只用于友好提示，最终以数据库唯一约束为准。未来敏感词和官方身份冒用过滤应接入同一个 `validatePlayerIdentity` 入口。

管理员玩家档案列表仅通过已有 `ADMIN_TOKEN` 鉴权的 `/admin/players` 读取，不提供改名接口。老测试角色无需清库即可完成新增表迁移；旧角色若要填写 V2 档案，需在开发期通过“重新开始”走完整建角。
