export type Gender = 'MALE' | 'FEMALE';
export interface Appearance {
  /** V1 formal look: each hair ID includes its color; each outfit is a full set. */
  skinToneId?: string; hairId?: string; outfitId?: string;
  /** Legacy persistence and old NPC configs; no longer player creation choices. */
  gender: Gender; baseAvatarId: string; skinColorId?: string; hairStyleId: string; hairColorId: string;
  topStyleId: string; topColorId: string; bottomStyleId: string; bottomColorId: string; shoesId: string; accessoryIds: string[];
}
/** Future NPC configs can use complete IDs without authoring deprecated pieces. */
export interface FormalNpcAppearance { gender: Gender; skinToneId: string; hairId: string; outfitId: string; accessoryIds: string[]; baseAvatarId?: string }
export interface Rect { x: number; y: number; width: number; height: number }
export type EntranceDirection = 'south' | 'west' | 'east' | 'north';
export interface EntranceConfig { id: string; position: { x: number; y: number }; direction: EntranceDirection; interactionArea: Rect; targetScene: string; targetSpawnPoint: { x: number; y: number } }
export interface PlotConfig extends Rect {
  id: string; townId: string; districtId: string; sceneId: string; plotType: string; facing: string;
  entranceX: number; entranceY: number; entrances?: EntranceConfig[]; status: string; allowedBuildingTypes: string[]; buildingId: string | null; version: number;
}
export interface BuildingConfig {
  id: string; name: string; buildingType: string; assetKey: string; interiorSceneId: string;
  openingHours: [string, string]; enabled: boolean; buyable: boolean; baseValue: number;
  /** Per-shop offers, keyed by stable item ID. Legacy buy/sell remain readable. */
  stock: Record<string, ShopListing>;
  /** Editable presentation only. Gameplay continues to use the stable building id. */
  clerkNpcId?: string; servicePointId?: string;
  displayName?: string;
  description?: string;
  signMode?: 'custom_image' | 'dynamic_template';
  signResourceId?: string;
  signTemplateId?: string;
  signMeta?: Record<string, string | number | boolean>;
}
export interface NPCConfig {
  id: string; name: string; nameLocked: boolean; enabled: boolean; sceneId: string;
  x: number; y: number; priority: number; hours: [string, string]; dialogue: string[]; route: {x: number; y: number}[]; questId?: string;
  /** NPC 的外观与主角解耦；未配置时由客户端使用兼容默认外观。 */
  appearance?: Appearance | FormalNpcAppearance; facing?: 'down'|'left'|'right'|'up'; formalArtKey?: string; portraitKey?: string;
}
export interface Portal { id: string; x: number; y: number; toSceneId: string; spawnX: number; spawnY: number; returnEntranceId?: string; interactionArea?: Rect }
export interface InteriorZone extends Rect { id: string; kind: 'wall'|'counter'|'shelf'|'storage'|'stairs'|'room'|'waitingArea'|'servicePoint'|'displayArea'|'chair'|'mirror'|'exit'|'entry'|'future'|'bed'|'wardrobe'|'desk'; solid: boolean; label?: string; interactionPoint?: {x:number;y:number} }
export interface SceneConfig {
  id: string; name: string; townId: string; width: number; height: number; tileSize: number;
  mapAsset: string; roads: Rect[]; collision: Rect[]; portals: Portal[]; buildingId?: string;
  spawnX: number; spawnY: number; interior?: { zones: InteriorZone[] };
}
export type ItemCategory = 'FOOD'|'DRINK'|'DAILY'|'MATERIAL'|'QUEST'|'KEY'|'GIFT'|'CLOTHING'|'SPECIAL';
export type StockMode = 'INFINITE'|'PLAYER_PRIVATE'|'GLOBAL_LIMITED'|'infinite';
export type PricingMode = 'FIXED'|'MARKET_DYNAMIC';
export interface ShopListing { enabled?:boolean; canBuy?:boolean; canSell?:boolean; baseBuyPrice?:number; baseSellPrice?:number; buy?:number; sell?:number; dailyLimit:number; stockMode?:StockMode; pricingMode?:PricingMode; sortOrder?:number; stockConfig?:Record<string,number>; pricingConfig?:Record<string,number> }
/** Reserved for a later market service; never persisted in ItemConfig or player inventory. */
export interface MarketState { marketId:string; supplyDemandIndex?:Record<string,number>; globalLimitedStock?:Record<string,number> }
export interface ItemConfig { id:string; name:string; icon?:string; giftable:boolean; stackMax:number; stackable?:boolean; questOnly?:boolean; questItem?:boolean; keyItem?:boolean; droppable?:boolean; sellableByNature?:boolean; category?:ItemCategory|'HOUSEHOLD'; description?:string; usable?:boolean; useActionLabel?:string; effectType?:'NONE'|'ENERGY'|'STATUS'|'QUEST'|'UNLOCK'|'CUSTOM'; effectValue?:number; effectMeta?:Record<string,string|number|boolean>; iconResourceId?:string; sortOrder?:number; enabled?:boolean; /** Legacy published worlds only; shop listings own all current prices. */ basePrice?:number }
export interface AppearanceDefinition { id: string; partType: string; name: string; genderScope: Gender | 'ALL'; assetKey: string; price: number; colors: string[]; enabled: boolean; starter: boolean }
export type QuestStepType = 'BUY'|'SELL'|'ACQUIRE'|'DELIVER'|'REPORT';
export interface QuestStepConfig { type: QuestStepType; target: string; count: number; shopId?:string; title?: string; objective?: string; npcId?: string; completionDialogue?: string }
export interface QuestConfig { id: string; name: string; steps: QuestStepConfig[]; reward: number; enabled: boolean }
export interface QuestRuntime extends QuestConfig { state: 'available'|'accepted'|'in_progress'|'completed'; progress: Record<string,number>; stepProgress: number[]; rewardClaimed: boolean }
export interface QuestTrackerItem { id: string; name: string; state: QuestRuntime['state']; stepIndex: number; stepCount: number; currentStep: string; currentObjective: string; rewardSummary: string; completed: boolean }
export interface WorldConfig {
  worldVersion: number; configVersion: number; assetVersion: number; scenes: SceneConfig[]; plots: PlotConfig[];
  buildings: BuildingConfig[]; npcs: NPCConfig[]; items: ItemConfig[]; appearances: AppearanceDefinition[];
  colors: Record<string, string>; quests: QuestConfig[]; roads: {id: string; name: string; connects: string[]}[];
}
export interface LedgerEntry { id: string; type: string; amount: number; before: number; after: number; referenceId: string; requestId: string; createdAt: string }
export interface PlayerState {
  id: string; nickname: string; cash: number; stamina: number; status: string;
  sceneId: string; x: number; y: number; appearance: Appearance | null; inventory: Record<string, number>;
  cosmetics: string[]; ledger: LedgerEntry[]; tradeCounts: Record<string, number>; metNpcs: string[]; storyFlags?: Record<string, boolean>;
}
export interface GhostProfile { playerId: string; nickname: string; appearance: Appearance; title: string; updatedAt: string }
export interface MailboxPayload { items: {itemId: string; quantity: number}[]; cash: number }
export interface SceneView { scene: SceneConfig; plots: PlotConfig[]; buildings: BuildingConfig[]; items: ItemConfig[]; npcs: NPCConfig[]; phase: string; playerPosition?: { sceneId: string; x: number; y: number } }
export interface ShopItemView { id: string; name: string; icon: string; owned: number; buyPrice: number; sellPrice: number; dailyLimit: number; description?: string; stackMax?: number }
export interface ShopTradeResult { transactionId:string; playerId:string; shopId:string; itemId:string; side:'BUY'|'SELL'; quantity:number; actualUnitPrice:number; total:number; timestamp:string }
export interface ShopPanelView { buildingId: string; title: string; balance: number; items: ShopItemView[] }
export interface Bootstrap { player: PlayerState; serverTime: string; worldVersion: number; configVersion: number; assetVersion: number; assetManifest: string; colors: Record<string,string>; appearances: AppearanceDefinition[]; features: Record<string,boolean> }
