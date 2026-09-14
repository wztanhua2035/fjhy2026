import Phaser from 'phaser';
import {installHairService} from '../../../packages/client-runtime/hair-phaser.js';
import {installOutfitShop} from '../../../packages/client-runtime/outfit-phaser.js';
import { GameController, formatQuestTracker, formatCyclingQuestTracker, baishiFormalArtRegistry, baishiInteriorArtRegistry, baishiV2ArtAssets, GROUND_DEPTH, WORLD_BASE, PORTRAIT_DIM_DEPTH, PORTRAIT_DEPTH, UI_DEPTH_BASE, DEBUG_DEPTH, worldActorDepth, worldBuildingDepth, buildingImagePosition, foregroundImagePosition, OUTDOOR_CAMERA_ZOOM, actorVisualScale, playerNameTopY, PLAYER_NAME_STYLE, PIXEL_ART_RENDER_CONFIG, DIALOGUE_PORTRAIT_SCALE, DIALOGUE_ACTIVE_PORTRAIT_SCALE, DIALOGUE_INACTIVE_ALPHA, JOYSTICK_VISUAL_SCALE, JOYSTICK_HIT_SCALE, baishiShopSignPlacements, buildingDisplayName, shouldUseCustomSign, signTemplateTextStyle, INTERACTION_TARGETING_BUILD_MARKER, type Direction, type Painter } from '../../../packages/client-runtime/index.js';
import { availableStarterLookOptions } from '../../../packages/game-config/appearance-v1.js';
import { createWeChatPlatform, safeInsets, allowWechatDebug } from './wechat-platform';
import { loadWechatAssets, loadWechatImage } from './assets';
import { WechatInteriorAssetLoader, WechatRemoteAssetCache } from './remote-interior-assets';
import { mobileLayout } from './layout';
import { baishiCompatibility } from './compatibility';
import { mobileTypography } from './typography';
import { MobileDialogueUi } from './dialogue-ui';
import { uiTokens, UiNotificationQueue, compactQuestText } from '../../../packages/client-runtime/ui-design-tokens.js';
import {itemCategoryNames} from '../../../packages/game-rules/inventory.js';
import {personalityChoices,randomIdentity,validatePlayerIdentity,type PersonalityTag} from '../../../packages/game-config/player-profile.js';
declare const wx: any;

declare const __WECHAT_API_BASE_URL__: string;
declare const __WECHAT_DEV_OPEN_ALL__: boolean;
declare const __WECHAT_DEV_COLLISION__: boolean;
declare const __WECHAT_DEV_SAFE_RESET__: boolean;
declare const __WECHAT_DEV_LOGIN__: boolean;
declare const __WECHAT_ASSET_BASE_URL__: string;
const windowInfo = wx.getWindowInfo?.() ?? wx.getSystemInfoSync();
const layout = mobileLayout(windowInfo, wx.getMenuButtonBoundingClientRect?.());
const WIDTH = layout.width, HEIGHT = layout.height, TILE = 32, groundKey = 'baishi-ground-image';
const platform = createWeChatPlatform(__WECHAT_API_BASE_URL__, { debugOpenAll: __WECHAT_DEV_OPEN_ALL__ });
const controller = new GameController(platform.transport);
// Allows DEV diagnostics and the build script to distinguish the targeting V2 bundle.
(globalThis as { __fjhyInteractionTargetingBuild?: string }).__fjhyInteractionTargetingBuild = INTERACTION_TARGETING_BUILD_MARKER;
const debugCollision = allowWechatDebug(__WECHAT_DEV_COLLISION__, wx.getAccountInfoSync?.().miniProgram?.envVersion);
type Draft = { gender: 'MALE' | 'FEMALE'; faceId: string; hairId: string; outfitId: string; direction: Direction; surname:string;givenName:string;nickname:string;personalityTag:PersonalityTag|null };
const draft: Draft = { gender: 'FEMALE', faceId: 'F_FACE_01', hairId: 'F_HAIR_01', outfitId: 'F_OUTFIT_01', direction: 'down',surname:'',givenName:'',nickname:'',personalityTag:null };
// WeChat sends touch coordinates directly to the game canvas. Phaser's web-only
// document.elementFromPoint check is not available in the Mini Game runtime.
function installWeChatTouchMoveBridge() {
  const inputManager = (Phaser.Input.InputManager as any).prototype;
  inputManager.onTouchMove = function (event: any) {
    const changed: any[] = [];
    for (const touch of event.changedTouches ?? []) {
      for (let index = 1; index < this.pointers.length; index++) {
        const pointer = this.pointers[index];
        if (pointer.active && pointer.identifier === touch.identifier) {
          if (!this.isOver) this.setCanvasOver(event);
          pointer.touchmove(touch, event);
          this.activePointer = pointer;
          changed.push(pointer);
          break;
        }
      }
    }
    this.updateInputPlugins(Phaser.Input.TOUCH_MOVE, changed);
  };
}

function color(value: string) { const hex = value.replace('#', ''); const rgb = hex.slice(0, 6).padEnd(6, '0'); return { value: parseInt(rgb, 16), alpha: hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1 }; }
class BaishiWechatScene extends Phaser.Scene {
  private worldOverlayCamera!: Phaser.Cameras.Scene2D.Camera;
  private graphics!: Phaser.GameObjects.Graphics;
  private debugGraphics!: Phaser.GameObjects.Graphics;
  private ground?: Phaser.GameObjects.Image;
  private buildings = new Map<string, Phaser.GameObjects.Image>();
  private foregrounds = new Map<string, Phaser.GameObjects.Image>();
  private interiorBackgrounds = new Map<string, Phaser.GameObjects.Image>();
  private interiorForegrounds = new Map<string, Phaser.GameObjects.Image>();
  private shopSigns = new Map<string, Phaser.GameObjects.Image>();
  private shopSignTemplates = new Map<string, Phaser.GameObjects.Text>();
  private pendingInteriorArt = new Set<string>();
  private readonly interiorAssetLoader = new WechatInteriorAssetLoader(wx, __WECHAT_ASSET_BASE_URL__);
  private readonly remoteAssetCache = new WechatRemoteAssetCache(wx, __WECHAT_ASSET_BASE_URL__);
  private actors = new Map<string, Phaser.GameObjects.Sprite>();
  private actorNames = new Map<string, Phaser.GameObjects.Text>();
  private playerSprite!: Phaser.GameObjects.Sprite;
  private playerName!: Phaser.GameObjects.Text;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private dialogueUi!: MobileDialogueUi;
  private portraitDim!: Phaser.GameObjects.Rectangle;
  private portraits = new Map<string, Phaser.GameObjects.Image>();
  private playerPortraits = new Map<'MALE'|'FEMALE', Phaser.GameObjects.Image>();
  private labels: Phaser.GameObjects.Text[] = [];
  private labelIndex = 0;
  private hud!: Phaser.GameObjects.Text;
  private message!: Phaser.GameObjects.Text;
  private notices = new UiNotificationQueue();
  private lastNoticeSource = '';
  private shownNoticeId = 0;
  private primary!: Phaser.GameObjects.Text;
  private shopBackdrop!: Phaser.GameObjects.Rectangle;
  private shopTitle!: Phaser.GameObjects.Text;
  private shopBalance!: Phaser.GameObjects.Text;
  private shopFeedback!: Phaser.GameObjects.Text;
  private shopRows: { icon: Phaser.GameObjects.Text; title: Phaser.GameObjects.Text; detail: Phaser.GameObjects.Text; buy: Phaser.GameObjects.Text; sell: Phaser.GameObjects.Text; minus: Phaser.GameObjects.Text; plus: Phaser.GameObjects.Text; count: Phaser.GameObjects.Text }[] = [];
  private frame!: Phaser.GameObjects.Text;
  private questPanel!: Phaser.GameObjects.Text;
  private questToggle!: Phaser.GameObjects.Text;
  private questCollapsed = false;
  private questIndex = 0;
  private loginFailed = false;
  private move = { x: 0, y: 0 };
  private stickBase!: Phaser.GameObjects.Arc;
  private stickHit!: Phaser.GameObjects.Arc;
  private stick!: Phaser.GameObjects.Arc;
  private fps = 0;
  private fpsElapsed = 0;
  private fpsFrames = 0;
  private debugInteractionKey = '';
  constructor() { super('baishi-wechat'); }
  private ready = false;
  private contentError = '';
  private get shopOpen(){return controller.shopOpen;}
  private set shopOpen(value:boolean){controller.shopOpen=value;}
  private shopPage=0;
  private bagOpen=false;
  private bagSelected=0;
  private bagToggle!:Phaser.GameObjects.Text;
  private bagText!:Phaser.GameObjects.Text;
  private bagPrev!:Phaser.GameObjects.Text;
  private bagNext!:Phaser.GameObjects.Text;
  private bagUse!:Phaser.GameObjects.Text;
  private profileToggle!:Phaser.GameObjects.Text;
  private profileText!:Phaser.GameObjects.Text;
  private profilePreview!:Phaser.GameObjects.Sprite;
  private profileOpen=false;
  private shopPrev!:Phaser.GameObjects.Text;
  private shopNext!:Phaser.GameObjects.Text;
  private shopBuyTab!:Phaser.GameObjects.Text;
  private shopSellTab!:Phaser.GameObjects.Text;
  private shopToggle!: Phaser.GameObjects.Text;
  private safeResetButton!: Phaser.GameObjects.Text;
  private genderToggle!: Phaser.GameObjects.Text;
  private creationChoices: Phaser.GameObjects.Text[] = [];
  private personalityRows: Phaser.GameObjects.Text[] = [];
  private personalityViewport!: Phaser.GameObjects.Rectangle;
  private personalityScroll = 0;
  private personalityDrag: { id: number; y: number; moved: boolean } | null = null;
  private creationStep = 0;
  private personalityPage = 0;
  private creationPagePrev!:Phaser.GameObjects.Text;
  private creationPageNext!:Phaser.GameObjects.Text;
  private creationRandom!:Phaser.GameObjects.Text;
  private homeMode = true;
  private confirmingRestart = false;
  private homeBackdrop!: Phaser.GameObjects.Rectangle;
  private homeTitle!: Phaser.GameObjects.Text;
  private homeStart!: Phaser.GameObjects.Text;
  private homeContinue!: Phaser.GameObjects.Text;
  private homeRestart!: Phaser.GameObjects.Text;
  private restartCancel!: Phaser.GameObjects.Text;
  private restartAccept!: Phaser.GameObjects.Text;
  private stickPointer: number | null = null;
  /* Native package images bypass the browser XHR/Blob loader. */
  async create() {
    const loading = this.add.text(WIDTH / 2, HEIGHT / 2, '正在加载正式资源…', { fontSize: '20px', color: '#203a2c', wordWrap: { width: 800 } }).setOrigin(.5);
    const failures = await loadWechatAssets(this.textures, () => wx.createImage(), (done, total) => loading.setText(`正在加载正式资源 ${done}/${total}`));
    if (failures.length) {
      loading.setText(`正式资源加载失败，点击重试：\n${failures.join('\n')}`);
      console.error('[FJHY assets]', failures);
      loading.setInteractive().on('pointerdown', () => this.scene.restart());
      return;
    }
    // Keep the existing texture aliases compatible with the formal player renderer.
    for (const [key, asset] of [['formal-player-male', baishiV2ArtAssets.playerMale], ['formal-player-female', baishiV2ArtAssets.playerFemale]] as const) {
      if (!this.textures.exists(key)) this.textures.addSpriteSheet(key, this.textures.get(asset.assetKey).getSourceImage() as HTMLImageElement, { frameWidth: asset.frameWidth, frameHeight: asset.frameHeight });
    }
    loading.destroy();
    this.createWorld();
    void this.loadShopSigns();
    this.ready = true;
  }
  private createWorld() {
    this.graphics = this.add.graphics().setDepth(GROUND_DEPTH + 1);
    this.debugGraphics = this.add.graphics().setDepth(DEBUG_DEPTH).setVisible(debugCollision);
    const insets = safeInsets(WIDTH, HEIGHT);
    this.ground = this.add.image(0, 0, groundKey).setOrigin(0).setDisplaySize(48 * TILE, 48 * TILE).setDepth(GROUND_DEPTH).setVisible(false);
    for (const asset of baishiFormalArtRegistry.buildings) {
      this.buildings.set(asset.buildingId, this.add.image(0, 0, asset.assetKey).setOrigin(0).setDisplaySize(asset.renderWidth, asset.renderHeight).setDepth(WORLD_BASE).setVisible(false));
      if (asset.foreground && asset.foregroundOcclusionFrontY !== undefined) this.foregrounds.set(asset.buildingId, this.add.image(0, 0, asset.foreground.assetKey).setOrigin(0).setDisplaySize(asset.renderWidth, asset.renderHeight).setDepth(WORLD_BASE).setVisible(false));
    }
    for (const sign of baishiShopSignPlacements) this.shopSignTemplates.set(sign.buildingId, this.add.text(0, 0, '', signTemplateTextStyle('', sign.templateId)).setOrigin(.5).setDepth(WORLD_BASE).setVisible(false));
    for (const asset of baishiFormalArtRegistry.npcs) {
      this.actors.set(asset.npcId, this.add.sprite(0, 0, asset.assetKey, 0).setOrigin(asset.footAnchorX / asset.frameWidth, asset.footAnchorY / asset.frameHeight).setDisplaySize(asset.frameWidth * asset.renderScale, asset.frameHeight * asset.renderScale).setVisible(false));
      this.actorNames.set(asset.npcId, this.add.text(0, 0, '', { fontFamily: 'Microsoft YaHei, Arial', fontSize: '16px', color: '#445749', stroke: '#f8f3df', strokeThickness: 3 }).setOrigin(.5, 1).setVisible(false));
    }
    this.playerSprite = this.add.sprite(0, 0, 'formal-player-female', 0).setOrigin(.5, 59 / 64).setDisplaySize(60, 60).setVisible(false);
    this.playerName = this.add.text(0, 0, '你', PLAYER_NAME_STYLE).setOrigin(.5, 1).setVisible(false);
    this.nightOverlay = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x233052, 0).setDepth(UI_DEPTH_BASE - 10).setVisible(false);
    this.portraitDim = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x18251c, .38).setDepth(PORTRAIT_DIM_DEPTH).setVisible(false);
    this.portraitDim.setInteractive().on('pointerdown', () => this.advanceDialogue());
    for (const asset of baishiFormalArtRegistry.portraits) this.portraits.set(asset.speaker, this.add.image(WIDTH - insets.right - 145, HEIGHT - insets.bottom - 56, asset.assetKey).setOrigin(asset.originX, asset.originY).setDisplaySize(asset.preferredWidth * DIALOGUE_PORTRAIT_SCALE * DIALOGUE_ACTIVE_PORTRAIT_SCALE, asset.preferredHeight * DIALOGUE_PORTRAIT_SCALE * DIALOGUE_ACTIVE_PORTRAIT_SCALE).setDepth(PORTRAIT_DEPTH).setVisible(false));
    this.playerPortraits.set('MALE', this.add.image(insets.left + 145, HEIGHT - insets.bottom - 56, 'portrait-player-male').setOrigin(.5, 1).setDisplaySize(264 * DIALOGUE_PORTRAIT_SCALE, 264 * DIALOGUE_PORTRAIT_SCALE).setDepth(PORTRAIT_DEPTH).setVisible(false));
    this.playerPortraits.set('FEMALE', this.add.image(insets.left + 145, HEIGHT - insets.bottom - 56, 'portrait-player-female').setOrigin(.5, 1).setDisplaySize(264 * DIALOGUE_PORTRAIT_SCALE, 264 * DIALOGUE_PORTRAIT_SCALE).setDepth(PORTRAIT_DEPTH).setVisible(false));
    this.dialogueUi = new MobileDialogueUi(this, WIDTH, HEIGHT, insets, () => this.advanceDialogue());
    this.hud = this.add.text(insets.left + uiTokens.safeArea.edge, insets.top + 14, '', { fontFamily: 'Microsoft YaHei, Arial', fontSize: `${uiTokens.typography.bodyM}px`, color: uiTokens.colors.dialogueBody, stroke: uiTokens.colors.textPrimary, strokeThickness: 3, lineSpacing: 5 }).setDepth(UI_DEPTH_BASE + 20);
    this.message = this.add.text(WIDTH / 2, HEIGHT - insets.bottom - 108, '', { fontFamily: 'Microsoft YaHei, Arial', fontSize: `${mobileTypography.notice}px`, color: '#ffffff', align: 'center', stroke: '#26352d', strokeThickness: 3, wordWrap: { width: Math.min(WIDTH - insets.left - insets.right - 60, 620) }, lineSpacing: 6 }).setOrigin(.5, 1).setDepth(UI_DEPTH_BASE + 30);
    this.frame = this.add.text(WIDTH - insets.right - 12, insets.top + 12, '', { fontFamily: 'Arial', fontSize: '14px', color: '#edf3d7', stroke: '#26352d', strokeThickness: 3 }).setOrigin(1, 0).setDepth(UI_DEPTH_BASE + 20);
    this.questToggle = this.button(WIDTH - insets.right - 62, insets.top + 54, 100, '任务 ▲', () => { this.questCollapsed = !this.questCollapsed; this.syncQuestPanel(); });
    this.questPanel = this.add.text(WIDTH - insets.right - 12, insets.top + 82, '', { fontFamily: 'Microsoft YaHei, Arial', fontSize: `${mobileTypography.quest}px`, color: uiTokens.colors.textPrimary, backgroundColor: uiTokens.colors.panel, padding: { left: 14, right: 14, top: 12, bottom: 12 }, fixedWidth: 290, wordWrap: { width: 262 }, lineSpacing: 6 }).setOrigin(1, 0).setDepth(UI_DEPTH_BASE + 39);
    this.questPanel.setInteractive().on('pointerdown', () => { this.questIndex++; this.syncQuestPanel(); });
    this.primary = this.button(WIDTH - insets.right - 92, HEIGHT - insets.bottom - 80, 104, '互动', () => void this.run(() => controller.interact()));
    this.shopBackdrop = this.add.rectangle(WIDTH - 468, 224, 388, 70, 0xfff9e9, .96).setOrigin(0).setStrokeStyle(2, 0xa8794f).setDepth(UI_DEPTH_BASE + 37).setVisible(false);
    this.shopTitle = this.add.text(WIDTH - 450, 238, '', { fontFamily: 'Microsoft YaHei, Arial', fontSize: `${uiTokens.typography.titleM}px`, color: uiTokens.colors.dialogueBody, backgroundColor: uiTokens.colors.accent, fixedWidth: 350, padding: { left: 12, right: 12, top: 8, bottom: 8 } }).setDepth(UI_DEPTH_BASE + 38).setVisible(false);
    this.shopBalance = this.add.text(WIDTH - 105, 246, '', { fontFamily: 'Microsoft YaHei, Arial', fontSize: '13px', color: '#fffdf3' }).setOrigin(1, 0).setDepth(UI_DEPTH_BASE + 39).setVisible(false);
    this.shopFeedback = this.add.text(WIDTH - 450, 0, '', { fontFamily: 'Microsoft YaHei, Arial', fontSize: '12px', color: '#7a6046', wordWrap: { width: 350 }, lineSpacing: 3 }).setDepth(UI_DEPTH_BASE + 39).setVisible(false);
    const baseX = insets.left + 86, baseY = HEIGHT - insets.bottom - 88;
    this.stickBase = this.add.circle(baseX, baseY, 50 * JOYSTICK_VISUAL_SCALE, 0x24342d, .38).setDepth(UI_DEPTH_BASE + 35);
    this.stick = this.add.circle(baseX, baseY, 21 * JOYSTICK_VISUAL_SCALE, 0xd7e7cf, .62).setDepth(UI_DEPTH_BASE + 36);
    this.stickHit = this.add.circle(baseX, baseY, 50 * JOYSTICK_HIT_SCALE, 0x24342d, .001).setDepth(UI_DEPTH_BASE + 37).setInteractive();
    this.input.addPointer(2);
    this.stickHit.on('pointerdown', (p: Phaser.Input.Pointer) => { if (controller.dialogue || this.shopOpen) return; this.stickPointer = p.id; this.setStick(p); });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (p.isDown && p.id === this.stickPointer) this.setStick(p); });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => { if (p.id === this.stickPointer) this.clearStick(); });
    platform.onLifecycle(state => { if (state === 'hide') this.clearStick(); });
    this.shopToggle = this.button(WIDTH - insets.right - 92, HEIGHT - insets.bottom - 150, 112, '交易', () => void this.run(async()=>{this.clearStick();if(this.shopOpen)controller.closeShop();else {await controller.openShop();this.shopPage=0;}}));
    this.shopPrev=this.button(WIDTH-510,HEIGHT-90,100,'上一页',()=>{this.shopPage=Math.max(0,this.shopPage-1);this.syncUi();}).setVisible(false);
    this.shopNext=this.button(WIDTH-180,HEIGHT-90,100,'下一页',()=>{this.shopPage++;this.syncUi();}).setVisible(false);
    this.shopBuyTab=this.button(WIDTH-440,132,100,'买入',()=>{controller.setShopTab('buy');this.shopPage=0;this.syncUi();}).setVisible(false);
    this.shopSellTab=this.button(WIDTH-325,132,100,'卖出',()=>{controller.setShopTab('sell');this.shopPage=0;this.syncUi();}).setVisible(false);
    this.cameras.main.ignore([this.shopPrev,this.shopNext,this.shopBuyTab,this.shopSellTab]);
    this.bagToggle=this.button(insets.left+80,insets.top+80,110,'背包',()=>{this.bagOpen=!this.bagOpen;if(this.bagOpen){this.profileOpen=false;this.shopOpen=false;this.clearStick();}this.syncUi();}).setVisible(false);
    this.bagText=this.add.text(insets.left+20,insets.top+115,'',{fontFamily:'Microsoft YaHei, Arial',fontSize:`${uiTokens.typography.bodyM}px`,color:uiTokens.colors.textPrimary,backgroundColor:uiTokens.colors.panel,padding:{x:16,y:12},lineSpacing:6,wordWrap:{width:380},fixedWidth:410}).setDepth(UI_DEPTH_BASE+39).setVisible(false);
    this.bagPrev=this.button(insets.left+80,HEIGHT-insets.bottom-94,95,'上一件',()=>{this.bagSelected=Math.max(0,this.bagSelected-1);this.syncUi();}).setVisible(false);
    this.bagNext=this.button(insets.left+190,HEIGHT-insets.bottom-94,95,'下一件',()=>{this.bagSelected++;this.syncUi();}).setVisible(false);
    this.bagUse=this.button(insets.left+300,HEIGHT-insets.bottom-94,95,'使用',()=>{const item=controller.inventoryItems()[this.bagSelected];if(item?.usable)void this.run(()=>controller.useItem(item.id));}).setVisible(false);
    this.cameras.main.ignore([this.bagToggle,this.bagText,this.bagPrev,this.bagNext,this.bagUse]);
    this.profileToggle=this.button(insets.left+205,insets.top+80,126,'个人档案',()=>{this.profileOpen=!this.profileOpen;this.bagOpen=false;this.syncUi();}).setVisible(false);
    this.profileText=this.add.text(insets.left+20,insets.top+120,'',{fontFamily:'Microsoft YaHei, Arial',fontSize:`${uiTokens.typography.bodyL}px`,color:uiTokens.colors.textPrimary,backgroundColor:uiTokens.colors.panel,padding:{x:18,y:15},lineSpacing:10}).setDepth(UI_DEPTH_BASE+40).setVisible(false);
    this.profilePreview=this.add.sprite(insets.left+300,insets.top+205,'formal-player-female',0).setOrigin(.5,59/64).setDisplaySize(112,112).setDepth(UI_DEPTH_BASE+41).setVisible(false);
    this.cameras.main.ignore([this.profileToggle,this.profileText,this.profilePreview]);
    this.safeResetButton = this.button(insets.left + 100, insets.top + 108, 176, '恢复到安全点', () => void this.run(() => controller.write('/v1/player/debug-safe-reset', {})));
    this.safeResetButton.setVisible(false);
    this.genderToggle = this.button(insets.left + 105, HEIGHT - insets.bottom - 75, 150, '上一步', () => { this.creationStep = Math.max(0, this.creationStep - 1); this.syncUi(); });
    this.creationChoices = [0, 1, 2].map(index => this.button(WIDTH - insets.right - 175, HEIGHT / 2 - 95 + index * 92, 280, '', () => this.chooseCreation(index)));
    const listLeft = WIDTH - insets.right - 510, listTop = 92, listWidth = 474, listHeight = 314;
    const listMask = this.add.graphics().fillStyle(0xffffff).fillRect(listLeft, listTop, listWidth, listHeight).setVisible(false);
    const geometryMask = listMask.createGeometryMask();
    this.personalityRows = personalityChoices.map(choice => this.add.text(listLeft + 8, listTop, choice.quote, {
      fontFamily: 'Microsoft YaHei, Arial', fontSize: '18px', color: uiTokens.colors.textPrimary,
      backgroundColor: uiTokens.colors.panelElevated, fixedWidth: listWidth - 16,
      padding: { left: 14, right: 12, top: 16, bottom: 16 }, wordWrap: { width: listWidth - 46 }
    }).setDepth(UI_DEPTH_BASE + 40).setMask(geometryMask).setVisible(false));
    this.personalityViewport = this.add.rectangle(listLeft, listTop, listWidth, listHeight, 0xffffff, .001).setOrigin(0).setDepth(UI_DEPTH_BASE + 41).setInteractive().setVisible(false);
    this.personalityViewport.on('pointerdown', (pointer: Phaser.Input.Pointer) => { this.personalityDrag = { id: pointer.id, y: pointer.y, moved: false }; });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const drag = this.personalityDrag;
      if (!drag || pointer.id !== drag.id || !pointer.isDown) return;
      const delta = pointer.y - drag.y;
      if (Math.abs(delta) > 2) drag.moved = true;
      this.personalityScroll = Phaser.Math.Clamp(this.personalityScroll - delta, 0, personalityChoices.length * 72 - listHeight + 16);
      drag.y = pointer.y;
      this.syncPersonalityRows();
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const drag = this.personalityDrag;
      if (!drag || pointer.id !== drag.id) return;
      if (!drag.moved && this.creationStep === 5) {
        const index = Math.floor((pointer.y - listTop + this.personalityScroll) / 72);
        if (personalityChoices[index]) draft.personalityTag = personalityChoices[index].tag;
        this.syncUi();
      }
      this.personalityDrag = null;
    });
    this.creationPagePrev=this.button(WIDTH-insets.right-480,HEIGHT-insets.bottom-78,120,'上一组',()=>{this.personalityPage=Math.max(0,this.personalityPage-1);this.syncUi();}).setVisible(false);
    this.creationPageNext=this.button(WIDTH-insets.right-340,HEIGHT-insets.bottom-78,120,'下一组',()=>{this.personalityPage=Math.min(2,this.personalityPage+1);this.syncUi();}).setVisible(false);
    this.creationRandom=this.button(WIDTH-insets.right-430,HEIGHT/2+135,180,'🎲 随机生成',()=>void this.generateIdentity()).setVisible(false);
    this.homeBackdrop = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x223c30, .85).setDepth(UI_DEPTH_BASE + 39).setInteractive().setVisible(false);
    this.homeTitle = this.add.text(WIDTH / 2, HEIGHT / 2 - 120, '富甲横阳', {fontFamily:'Microsoft YaHei, Arial',fontSize:'27px',color:'#ffffff',align:'center',wordWrap:{width:Math.min(640,WIDTH-insets.left-insets.right-40)}}).setOrigin(.5).setDepth(UI_DEPTH_BASE + 41).setVisible(false);
    this.homeStart = this.button(WIDTH / 2, HEIGHT / 2, 220, '开始游戏', () => { this.homeMode = false; this.syncUi(); });
    this.homeContinue = this.button(WIDTH / 2, HEIGHT / 2 - 18, 220, '继续游戏', () => { this.homeMode = false; this.syncUi(); });
    this.homeRestart = this.button(WIDTH / 2, HEIGHT / 2 + 70, 220, '重新开始', () => { this.confirmingRestart = true; this.syncUi(); });
    this.restartCancel = this.button(WIDTH / 2 - 135, HEIGHT / 2 + 75, 190, '取消', () => { this.confirmingRestart = false; this.syncUi(); });
    this.restartAccept = this.button(WIDTH / 2 + 135, HEIGHT / 2 + 75, 220, '确定重新开始', () => void this.run(async () => { await controller.restart(); this.notices.clear();this.lastNoticeSource='';this.shownNoticeId=0; Object.assign(draft,{gender:'FEMALE',faceId:'F_FACE_01',hairId:'F_HAIR_01',outfitId:'F_OUTFIT_01',direction:'down',surname:'',givenName:'',nickname:'',personalityTag:null}); this.confirmingRestart = false; this.homeMode = false; this.creationStep = 0;this.personalityPage=0;this.personalityScroll=0;this.profileOpen=false; }));
    for (const button of [this.homeStart,this.homeContinue,this.homeRestart,this.restartCancel,this.restartAccept]) button.setVisible(false);
    const capsule = wx.getMenuButtonBoundingClientRect?.();
    const rightTop = Math.max(insets.top + 12, (capsule?.bottom ?? 0) / windowInfo.windowHeight * HEIGHT + 12);
    this.frame.setY(rightTop);
    this.questToggle.setY(rightTop + 42);
    this.questPanel.setY(rightTop + 72);
    controller.onChange = () => this.syncUi();
    const world = [this.graphics, this.debugGraphics, this.ground, this.playerSprite, this.playerName, ...this.buildings.values(), ...this.foregrounds.values(), ...this.shopSigns.values(), ...this.shopSignTemplates.values(), ...this.interiorBackgrounds.values(), ...this.interiorForegrounds.values(), ...this.actors.values(), ...this.actorNames.values()];
    const ui = this.children.list.filter(child => !world.includes(child as typeof world[number]));
    this.cameras.main.ignore(ui);
    this.worldOverlayCamera = this.cameras.add(0, 0, WIDTH, HEIGHT);
    this.worldOverlayCamera.ignore(world);
    installHairService(this,controller,this.playerSprite,WIDTH,HEIGHT,()=>draft);
    installOutfitShop(this,controller,WIDTH,HEIGHT);
    void this.loginPreview();
  }
  private async loginPreview() {
    this.loginFailed = false;
    try {
      if (allowWechatDebug(__WECHAT_DEV_LOGIN__, wx.getAccountInfoSync?.().miniProgram?.envVersion)) {
        let account = platform.readLocal('fjhy.wechatPreviewAccount');
        if (!account) { account = 'wechat-preview-' + Date.now().toString(36); platform.writeLocal('fjhy.wechatPreviewAccount', account); }
        await controller.loginDev(account);
      } else await controller.loginWechat(await platform.getLoginCode());
      this.homeMode = true; this.confirmingRestart = false;
      if (controller.player?.appearance) await this.checkContent();
      this.syncUi();
    } catch (error: any) { this.loginFailed = true; controller.message = `连接测试服务失败：${error.message ?? '未知错误'}`; this.syncUi(); }
  }
  private async checkContent() {
    const street = await platform.transport('/v1/world/scenes/STREET_BAISHI_01', undefined, controller.token);
    const missing = baishiCompatibility(street, controller.quests);
    if (missing.length) {
      this.contentError = `服务端白石街配置尚未同步（版本 ${controller.boot?.configVersion}）：${missing.join('、')}。请发布当前白石街配置后重新编译进入。`;
      console.error('[FJHY content mismatch]', this.contentError);
    }
  }
  private button(x: number, y: number, width: number, text: string, action: () => void) {
    const button = this.add.text(x, y, text, { fontFamily: 'Microsoft YaHei, Arial', fontSize: `${mobileTypography.option}px`, color: uiTokens.colors.dialogueBody, backgroundColor: uiTokens.colors.accent, padding: { left: 12, right: 12, top: 17, bottom: 17 }, align: 'center', fixedWidth: width }).setOrigin(.5).setDepth(UI_DEPTH_BASE + 40).setInteractive({ useHandCursor: true });
    button.on('pointerdown', () => { if (!controller.busy) action(); }); return button;
  }
  private setStick(pointer: Phaser.Input.Pointer) {
    const dx = pointer.x - this.stickBase.x, dy = pointer.y - this.stickBase.y, length = Math.hypot(dx, dy) || 1, scale = Math.min(32 * JOYSTICK_VISUAL_SCALE / length, 1);
    this.stick.setPosition(this.stickBase.x + dx * scale, this.stickBase.y + dy * scale);
    this.move = { x: dx / length, y: dy / length };
  }
  private clearStick() { this.stickPointer = null; this.move = { x: 0, y: 0 }; if (this.stick) this.stick.setPosition(this.stickBase.x, this.stickBase.y); }
  private advanceDialogue() {
    if (!controller.dialogue || this.dialogueUi.advance()) return;
    void this.run(() => controller.advanceDialogue());
  }
  private async run(action: () => Promise<unknown>) { try { await action(); } catch (error: any) { controller.message = error.message ?? '操作失败'; } this.syncUi(); }
    private syncNotice(dialogue: boolean, hasPlayer: boolean) {
      if(controller.guide){this.notices.enqueue('toast',controller.guide);controller.guide=null;}
    if (dialogue) { this.lastNoticeSource = controller.message; this.message.setVisible(false); return; }
    if (!hasPlayer) return;
    if (controller.message && controller.message !== this.lastNoticeSource) {
      this.lastNoticeSource = controller.message;
      this.notices.enqueue(/成功|完成|获得|支出|售出|购买/.test(controller.message) ? 'result' : 'toast', controller.message.split('\n').slice(0, 3).join('\n'));
    }
    const notice = this.notices.current();
    this.message.setVisible(!!notice).setText(notice?.text ?? '');
    if (!notice || this.shownNoticeId === notice.id) return;
    this.shownNoticeId = notice.id;
    this.time.delayedCall(notice.kind === 'result' ? 2800 : 2100, () => {
      this.notices.dismiss(notice.id);
      if (this.ready) this.syncNotice(!!controller.dialogue, !!controller.player?.appearance);
    });
  }
  private async createPreviewPlayer() {
    const profile=validatePlayerIdentity(draft);
    await controller.create(draft.gender, { faceId: draft.faceId, hairId: draft.hairId, outfitId: draft.outfitId },profile);
    await this.checkContent();
  }
  private async generateIdentity(){for(let attempt=0;attempt<8;attempt++){const candidate=randomIdentity(draft.gender);Object.assign(draft,candidate);try{const query=new URLSearchParams(candidate);const result=await platform.transport(`/v1/player/identity/check?${query}`,undefined,controller.token);if(result.available)break;}catch{break;}}this.syncUi();}
  private editIdentity(key:'surname'|'givenName'|'nickname'){
    const labels={surname:'姓（1～2个汉字）',givenName:'名（1～2个汉字）',nickname:'外号（2～3个汉字）'};
    const complete=(value:string)=>{draft[key]=value;wx.hideKeyboard?.();this.syncUi();wx.offKeyboardConfirm?.(onConfirm);};
    const onConfirm=(event:{value:string})=>complete(event.value);
    wx.onKeyboardConfirm?.(onConfirm);
    wx.showKeyboard?.({defaultValue:draft[key],maxLength:key==='nickname'?3:2,multiple:false,confirmHold:false,confirmType:'done',success:()=>{this.message.setText(`输入${labels[key]}后点击完成`);},fail:()=>wx.offKeyboardConfirm?.(onConfirm)});
  }
  private creationOptions() {
    const boot = controller.boot;
    if (!boot) return { faces: [], hairs: [], outfits: [] };
    const { faces, hairs, outfits, selection } = availableStarterLookOptions(boot, draft.gender, draft,boot.faces);
    Object.assign(draft, selection);
    return { faces, hairs, outfits };
  }
  private chooseCreation(index: number) {
    const options = this.creationOptions();
    if (this.creationStep === 0) draft.gender = (['MALE', 'FEMALE'] as const)[index] ?? draft.gender;
    if (this.creationStep === 1) draft.faceId = options.faces[index]?.faceId ?? draft.faceId;
    if (this.creationStep === 2) draft.hairId = options.hairs[index]?.id ?? draft.hairId;
    if (this.creationStep === 3) draft.outfitId = options.outfits[index]?.id ?? draft.outfitId;
    if (this.creationStep === 4){if(index===0)this.editIdentity('surname');if(index===1)this.editIdentity('givenName');if(index===2)this.editIdentity('nickname');}
    if (this.creationStep === 5)draft.personalityTag=personalityChoices[this.personalityPage*3+index]?.tag??draft.personalityTag;
    controller.message = '欢迎来到横阳';
    this.syncUi();
  }
  private syncCreationUi() {
    const options = this.creationOptions();
    const groups = [
      [{ id: 'MALE', name: '男' }, { id: 'FEMALE', name: '女' }],
      options.faces.map(face=>({id:face.faceId,name:face.displayName})), options.hairs, options.outfits,
      [{id:'surname',name:`姓：${draft.surname||'点击输入'}`},{id:'givenName',name:`名：${draft.givenName||'点击输入'}`},{id:'nickname',name:`外号：${draft.nickname||'点击输入'}`}],
      personalityChoices.slice(this.personalityPage*3,this.personalityPage*3+3).map(choice=>({id:choice.tag,name:choice.quote})),[]
    ];
    const selected = [draft.gender, draft.faceId, draft.hairId, draft.outfitId, '',draft.personalityTag,''][this.creationStep];
    for (const [index, button] of this.creationChoices.entries()) {
      const item = groups[this.creationStep]?.[index];
      button.setVisible(this.creationStep!==5&&!!item).setText(item ? `${item.id === selected ? '✓ ' : ''}${item.name}` : '').setWordWrapWidth(260).setFontSize(`${mobileTypography.option}px`);
    }
    this.creationPagePrev.setVisible(false);
    this.creationPageNext.setVisible(false);
    this.syncPersonalityRows();
    this.creationRandom.setVisible(this.creationStep===4);
    this.genderToggle.setVisible(this.creationStep > 0);
    const labels = ['选择性别', '选择长相', '选择完整发型', '选择整套服装', '填写姓名与外号', '你最常说的是哪句话？', '最终确认'];
    const chosen=personalityChoices.find(choice=>choice.tag===draft.personalityTag);
    this.message.setText(this.creationStep===6?`姓名：${draft.surname}${draft.givenName} · 外号：${draft.nickname}\n性格选择：${chosen?.quote??'尚未选择'}`:`${labels[this.creationStep]} · ${this.creationStep + 1}/7${this.creationStep===4?'\n姓、名各1～2个汉字，外号2～3个汉字':''}`);
    this.primary.setText(this.creationStep === 6 ? '开始游戏' : '下一步').setVisible(!!draft.faceId && !!draft.hairId && !!draft.outfitId).setAlpha(this.creationStep===5&&!draft.personalityTag?uiTokens.disabledOpacity:1)
      .removeAllListeners('pointerdown').on('pointerdown', () => {if(this.creationStep===5&&!draft.personalityTag)return;if(this.creationStep===6){void this.run(() => this.createPreviewPlayer());return;}if(this.creationStep===4){try{validatePlayerIdentity({...draft,personalityTag:personalityChoices[0].tag});}catch(error:any){this.message.setText(error.message);return;}}this.creationStep++;this.syncUi();});
  }
  private syncPersonalityRows() {
    if (!this.personalityViewport) return;
    const visible = this.creationStep === 5 && !!controller.boot && !controller.player?.appearance && !this.homeMode;
    this.personalityViewport.setVisible(visible);
    for (const [index, row] of this.personalityRows.entries()) {
      row.setY(92 + index * 72 - this.personalityScroll).setVisible(visible);
      row.setText(`${personalityChoices[index].tag === draft.personalityTag ? '✓ ' : ''}${personalityChoices[index].quote}`);
      row.setBackgroundColor(personalityChoices[index].tag === draft.personalityTag ? uiTokens.colors.accentSoft : uiTokens.colors.panelElevated);
    }
  }
  private syncUi() {
    const player = controller.player; const hasPlayer = !!player?.appearance;
    const home = !!controller.boot && this.homeMode;
    this.homeBackdrop.setVisible(home);
    this.homeTitle.setVisible(home).setText(this.confirmingRestart ? '重新开始将清除当前角色的游戏进度，并重新创建角色。确定继续吗？' : '富甲横阳');
    this.homeStart.setVisible(home && !hasPlayer && !this.confirmingRestart);
    this.homeContinue.setVisible(home && hasPlayer && !this.confirmingRestart);
    this.homeRestart.setVisible(home && hasPlayer && !this.confirmingRestart);
    this.restartCancel.setVisible(home && this.confirmingRestart);
    this.restartAccept.setVisible(home && this.confirmingRestart);
    this.bagToggle.setVisible(!home&&hasPlayer&&!controller.dialogue&&!this.shopOpen);
    this.profileToggle.setVisible(!home&&hasPlayer&&!controller.dialogue&&!this.shopOpen);
    this.profileText.setVisible(!home&&hasPlayer&&this.profileOpen&&!controller.dialogue).setText(player?.profile?`姓名：${player.profile.surname}${player.profile.givenName}\n外号：${player.profile.nickname}\n性格：${player.profile.personalityTag}`:'暂无角色档案');
    this.profilePreview.setVisible(!home&&hasPlayer&&this.profileOpen&&!controller.dialogue);
    if(this.profilePreview.visible)this.profilePreview.setTexture(this.playerSprite.texture.key,this.playerSprite.frame.name);
    const bagItems=controller.inventoryItems(),showBag=!home&&hasPlayer&&!controller.dialogue&&!this.shopOpen&&this.bagOpen;
    this.bagSelected=Math.min(this.bagSelected,Math.max(0,bagItems.length-1));
    const selected=bagItems[this.bagSelected];
    const bagPage=Math.floor(this.bagSelected/8)*8;
    this.bagText.setVisible(showBag).setText(bagItems.length?`背包 ${bagItems.length} 种\n${bagItems.slice(bagPage,bagPage+8).map((item,index)=>`${index+bagPage===this.bagSelected?'▶':'　'}${item.icon} ${item.name} ×${item.quantity}`).join('\n')}${bagItems.length>8?`\n第 ${Math.floor(bagPage/8)+1} 页`:''}\n\n${selected?.name??''} · ${selected?itemCategoryNames[selected.category]:''}\n${selected?.description??''}\n${selected?.usable?'可使用':'暂不可使用'}`:'行囊里暂时没有东西。');
    this.bagPrev.setVisible(showBag&&bagItems.length>1);this.bagNext.setVisible(showBag&&bagItems.length>1);this.bagUse.setVisible(showBag&&!!selected?.usable&&!controller.busy&&!controller.pending);
    if (home) {
      this.personalityViewport.setVisible(false);for(const row of this.personalityRows)row.setVisible(false);
      this.stickBase.setVisible(false); this.stick.setVisible(false); this.stickHit.setVisible(false); this.primary.setVisible(false); this.shopToggle.setVisible(false); this.safeResetButton.setVisible(false); this.genderToggle.setVisible(false);
      this.profileToggle.setVisible(false);this.profileText.setVisible(false);this.profilePreview.setVisible(false);
      for (const choice of this.creationChoices) choice.setVisible(false);
      this.creationPagePrev.setVisible(false);this.creationPageNext.setVisible(false);this.creationRandom.setVisible(false);
      this.shopPrev.setVisible(false);this.shopNext.setVisible(false);this.shopBuyTab.setVisible(false);this.shopSellTab.setVisible(false);this.questToggle.setVisible(false); this.questPanel.setVisible(false); this.shopBackdrop.setVisible(false); this.shopTitle.setVisible(false); this.shopBalance.setVisible(false); this.shopFeedback.setVisible(false);
      for (const row of this.shopRows) Object.values(row).forEach(node => node.setVisible(false));
      this.portraitDim.setVisible(false); this.dialogueUi.sync('', '', false); this.message.setVisible(false); this.hud.setVisible(false); this.clearStick(); return;
    }
    this.message.setVisible(true); this.hud.setVisible(true);
    this.stickBase.setVisible(hasPlayer); this.stick.setVisible(hasPlayer); this.stickHit.setVisible(hasPlayer);
    const dialogue = !!controller.dialogue && !!controller.dialogueSpeaker;
    const canShop = !dialogue && !!controller.shopPanel() && controller.canUseShop();
    this.genderToggle.setVisible(false);
    for (const button of this.creationChoices) button.setVisible(false);
    this.creationPagePrev.setVisible(false);this.creationPageNext.setVisible(false);this.creationRandom.setVisible(false);
    if (!canShop || controller.offline) this.shopOpen = false;
    const isShop = canShop && this.shopOpen;
    this.shopToggle.setVisible(canShop).setText(this.shopOpen ? '收起商品' : '看看商品');
    this.safeResetButton.setVisible(hasPlayer && allowWechatDebug(__WECHAT_DEV_SAFE_RESET__, wx.getAccountInfoSync?.().miniProgram?.envVersion));
    if (this.shopOpen) this.shopToggle.setPosition(WIDTH - 80, 125); else this.shopToggle.setPosition(WIDTH - safeInsets(WIDTH, HEIGHT).right - 92, HEIGHT - safeInsets(WIDTH, HEIGHT).bottom - 150);
    if (dialogue || isShop) this.clearStick();
    this.stickBase.setVisible(hasPlayer && !dialogue && !showBag); this.stick.setVisible(hasPlayer && !dialogue && !showBag); this.stickHit.setVisible(hasPlayer && !dialogue && !showBag);
    if (controller.boot && !hasPlayer) this.syncCreationUi();
    else { this.syncPersonalityRows(); this.primary.removeAllListeners('pointerdown').on('pointerdown', () => {if(!controller.busy&&!controller.pending)void this.run(() => controller.interact());}); this.primary.setText(controller.nearby()?.label?.replace(/^进入/, '进 ') ?? '互动').setAlpha(controller.busy||!!controller.pending?uiTokens.disabledOpacity:1); this.primary.setVisible(hasPlayer && !isShop && !dialogue); }
    this.hud.setText(hasPlayer ? `${controller.view?.scene.name ?? '横阳'} · ${player!.cash} 文` : '富甲横阳 · 白石街真机体验');
    if (hasPlayer || !controller.boot || this.contentError || (controller.message && controller.message !== '欢迎来到横阳')) this.message.setText(this.contentError || controller.message || '').setDepth(dialogue ? PORTRAIT_DEPTH + 10 : UI_DEPTH_BASE + 30);
    if (controller.offline || controller.pending || this.loginFailed) this.primary.setVisible(true).setText('重新连接').removeAllListeners('pointerdown').on('pointerdown', () => void this.run(() => this.loginFailed ? this.loginPreview() : controller.retry()));
    if (this.contentError) this.primary.setVisible(false);
    this.portraitDim.setVisible(dialogue);
    this.dialogueUi.sync(controller.dialogueSpeaker ?? '', controller.message, dialogue, player?.profile ? player.profile.surname + player.profile.givenName : undefined);
    this.syncNotice(dialogue,hasPlayer);
    for (const [speaker, portrait] of this.portraits) portrait.setVisible(dialogue && (speaker === controller.dialogueSpeaker || controller.introPending && speaker === '陈掌柜') && this.textures.exists(portrait.texture.key)).setAlpha(speaker === controller.dialogueSpeaker ? 1 : DIALOGUE_INACTIVE_ALPHA);
    for (const [gender, portrait] of this.playerPortraits) portrait.setVisible(dialogue && gender === player?.appearance?.gender && this.textures.exists(portrait.texture.key)).setAlpha(controller.dialogueSpeaker === '主角' ? 1 : DIALOGUE_INACTIVE_ALPHA);
    this.questToggle.setVisible(hasPlayer);
    this.syncQuestPanel();
    this.syncShopPanel();
  }
  private syncQuestPanel() {
    const tasks = controller.questTracker().sort((a, b) => Number(a.completed) - Number(b.completed));
    this.questIndex %= Math.max(tasks.length, 1);
    const task = tasks[this.questIndex];
    this.questToggle?.setText(`任务 ${this.questCollapsed ? '▼' : '▲'}`);
    this.questPanel?.setText(task ? formatCyclingQuestTracker(compactQuestText(task), this.questIndex, tasks.length) : '暂无进行中的任务').setVisible(!!controller.player?.appearance && !this.questCollapsed && !this.shopOpen && !controller.dialogue);
  }
  private ensureShopRows(count: number) { while (this.shopRows.length < count) { const icon = this.add.text(WIDTH - 448, 0, '', { fontFamily: 'Microsoft YaHei, Arial', fontSize: '18px', color: '#6a472c', backgroundColor: '#f1d58d', fixedWidth: 34, fixedHeight: 34, align: 'center', padding: { top: 6 } }).setDepth(UI_DEPTH_BASE + 39); const title = this.add.text(WIDTH - 405, 0, '', { fontFamily: 'Microsoft YaHei, Arial', fontSize: '15px', color: '#4c392b' }).setDepth(UI_DEPTH_BASE + 39); const detail = this.add.text(WIDTH - 405, 0, '', { fontFamily: 'Microsoft YaHei, Arial', fontSize: '14px', color: '#806f5c' }).setDepth(UI_DEPTH_BASE + 39); const buy = this.button(WIDTH - 186, 0, 76, '买入', () => {}); const sell = this.button(WIDTH - 110, 0, 76, '出售', () => {}); const minus=this.button(0,0,42,'−',()=>{}),plus=this.button(0,0,42,'+',()=>{}),count=this.add.text(0,0,'1',{fontSize:'18px',color:'#4c392b'}).setDepth(UI_DEPTH_BASE+40);this.cameras.main.ignore([icon,title,detail,buy,sell,minus,plus,count]);this.shopRows.push({icon,title,detail,buy,sell,minus,plus,count}); } }
  private syncShopPanel() {
    const shop=controller.shopPanel(),visible=this.shopOpen&&!controller.dialogue&&!!shop&&controller.canUseShop();
    for(const node of [this.shopBackdrop,this.shopTitle,this.shopBalance,this.shopFeedback,this.shopPrev,this.shopNext])node.setVisible(visible);
    this.shopBuyTab.setVisible(visible&&shop?.buildingId==='B_TRADE');this.shopSellTab.setVisible(visible&&shop?.buildingId==='B_TRADE');
    for(const row of this.shopRows)Object.values(row).forEach(node=>node.setVisible(false));
    if(!shop||!visible)return;
    const items=shop.buildingId==='B_TRADE'?shop.items.filter(item=>controller.shopTab==='buy'?item.buyPrice>0:item.sellPrice>0&&item.owned>0):shop.items;
    const pageSize=2,pages=Math.max(1,Math.ceil(items.length/pageSize));this.shopPage=Math.min(this.shopPage,pages-1);
    const left=WIDTH-590,top=90;
    this.shopBackdrop.setPosition(left,top).setSize(510,HEIGHT-130);
    this.shopTitle.setPosition(left+12,top+12).setText(shop.title);
    this.shopBuyTab.setPosition(left+80,top+45).setAlpha(controller.shopTab==='buy'?1:.6);
    this.shopSellTab.setPosition(left+190,top+45).setAlpha(controller.shopTab==='sell'?1:.6);
    this.shopBalance.setPosition(left+490,top+20).setColor('#4c392b').setText(`铜钱 ${shop.balance} 文`);
    this.shopFeedback.setPosition(left+15,HEIGHT-190).setText(!items.length&&controller.shopTab==='sell'?'目前没有商行收购的物品。':controller.message).setWordWrapWidth(470);
    this.shopPrev.setText(`上一页 ${this.shopPage+1}/${pages}`);this.shopNext.setText('下一页');
    this.ensureShopRows(pageSize);
    items.slice(this.shopPage*pageSize,(this.shopPage+1)*pageSize).forEach((item,index)=>{
      const row=this.shopRows[index],y=top+90+index*108,q=controller.shopQuantities[item.id]??1;
      row.icon.setPosition(left+15,y).setText(item.icon).setVisible(true);
      row.title.setPosition(left+60,y).setText(`${item.name} · 收购 ${item.sellPrice}文 · 持有 ${item.owned}`).setVisible(true);
      row.detail.setPosition(left+60,y+23).setText(item.description??'').setVisible(true);
      row.minus.setPosition(left+85,y+67);row.count.setPosition(left+120,y+57).setText(String(q)).setVisible(true);row.plus.setPosition(left+165,y+67);
      row.buy.setPosition(left+285,y+67).setText('购买');row.sell.setPosition(left+405,y+67).setText(`卖 ${item.sellPrice}`);
      const handlers:[Phaser.GameObjects.Text,()=>void][]=[[row.minus,()=>controller.setShopQuantity(item.id,-1)],[row.plus,()=>controller.setShopQuantity(item.id,1)],[row.buy,()=>void this.run(()=>controller.trade('buy',item.id,q))],[row.sell,()=>void this.run(()=>controller.trade('sell',item.id,q))]];
      for(const [button,handler] of handlers){button.setVisible(true).removeAllListeners('pointerdown');const unavailable=(button===row.buy&&item.buyPrice===0)||(button===row.sell&&(item.sellPrice===0||item.owned<q));if(controller.busy||controller.pending||unavailable)button.disableInteractive().setAlpha(.5);else button.setInteractive().setAlpha(1).on('pointerdown',handler);}
    });
  }
  update(_: number, delta: number) {
    if (!this.ready) return;
    this.fpsElapsed += delta; this.fpsFrames++; if (this.fpsElapsed >= 500) { this.fps = Math.round(this.fpsFrames * 1000 / this.fpsElapsed); this.fpsElapsed = 0; this.fpsFrames = 0; }
    controller.tick(Math.min(delta / 1000, .05), this.homeMode || this.contentError || controller.dialogue || this.shopOpen || this.bagOpen ? 0 : this.move.x, this.homeMode || this.contentError || controller.dialogue || this.shopOpen || this.bagOpen ? 0 : this.move.y);
    this.frame.setText(`${this.fps} FPS`);
    this.render();
  }
  private async loadShopSigns() {
    for (const sign of baishiShopSignPlacements) {
      const resourceId = ({ B_INN: 'SIGN_BAISHI_INN_V1', B_GROCERY: 'SIGN_BAISHI_GROCERY_V1', B_TRADE: 'SIGN_BAISHI_TRADE_V1', B_SALON: 'SIGN_BAISHI_SALON_V1', B_CLOTH: 'SIGN_BAISHI_CLOTH_V1' } as Record<string, string>)[sign.buildingId];
      try {
        await loadWechatImage(this.textures, { key: sign.assetKey, source: '', path: '' }, () => wx.createImage(), await this.remoteAssetCache.localPath(resourceId));
        const image = this.add.image(0, 0, sign.assetKey).setOrigin(.5).setDepth(WORLD_BASE).setVisible(false);
        this.shopSigns.set(sign.buildingId, image); this.worldOverlayCamera.ignore(image);
      } catch (error: any) { console.warn('[FJHY remote asset] shop-sign dynamic-template fallback', { resourceId, errMsg: error?.message }); }
    }
  }
  private renderFormalWorld(ox: number, oy: number) {
    const view = controller.view, street = view?.scene.id === 'STREET_BAISHI_01', actorScale = actorVisualScale(view?.scene.id ?? 'STREET_BAISHI_01');
    for (const [buildingId, image] of this.buildings) {
      const asset = baishiFormalArtRegistry.buildings.find(candidate => candidate.buildingId === buildingId)!;
      const position = buildingImagePosition(asset, TILE);
      image.setVisible(!!street && this.textures.exists(asset.assetKey)).setPosition(ox + position.x, oy + position.y).setDepth(worldBuildingDepth(asset.occlusionFrontY!));
    }
    for (const sign of baishiShopSignPlacements) {
      const building = view?.buildings.find(candidate => candidate.id === sign.buildingId);
      const resourceId = ({ B_INN: 'SIGN_BAISHI_INN_V1', B_GROCERY: 'SIGN_BAISHI_GROCERY_V1', B_TRADE: 'SIGN_BAISHI_TRADE_V1', B_SALON: 'SIGN_BAISHI_SALON_V1', B_CLOTH: 'SIGN_BAISHI_CLOTH_V1' } as Record<string, string>)[sign.buildingId];
      const image = this.shopSigns.get(sign.buildingId), template = this.shopSignTemplates.get(sign.buildingId);
      const custom = !!building && shouldUseCustomSign(building, resourceId) && this.textures.exists(sign.assetKey);
      image?.setVisible(!!street && custom).setPosition(ox + sign.worldX * TILE, oy + sign.worldY * TILE).setDisplaySize(sign.width, sign.height).setDepth(worldBuildingDepth(sign.frontY) + 1);
      if (template) { const name = building ? buildingDisplayName(building) : ''; template.setText(name).setStyle(signTemplateTextStyle(name, sign.templateId)).setPosition(ox + sign.worldX * TILE, oy + sign.worldY * TILE).setDepth(worldBuildingDepth(sign.frontY) + 1).setVisible(!!street && !!building && !custom); }
    }
    for (const [buildingId, image] of this.foregrounds) {
      const asset = baishiFormalArtRegistry.buildings.find(candidate => candidate.buildingId === buildingId)!;
      const position = foregroundImagePosition(asset, TILE);
      image.setVisible(!!street && this.textures.exists(asset.foreground!.assetKey)).setPosition(ox + position.x, oy + position.y).setDepth(worldBuildingDepth(asset.foregroundOcclusionFrontY!));
    }
    for (const [npcId, sprite] of this.actors) {
      const npc = view?.npcs.find(candidate => candidate.id === npcId), asset = baishiFormalArtRegistry.npcs.find(candidate => candidate.npcId === npcId)!;
      const visible = !!npc && this.textures.exists(asset.assetKey);
      sprite.setVisible(visible);
      const name = this.actorNames.get(npcId)!; name.setVisible(visible);
      if (npc) {
        const offset = asset.frameOffsets?.down?.[0] ?? { x: 0, y: 0 }, depth = worldActorDepth(npc.y);
        sprite.setFrame(asset.directionRows.down * asset.columns).setDisplaySize(asset.frameWidth * asset.renderScale * actorScale, asset.frameHeight * asset.renderScale * actorScale).setPosition(ox + npc.x * TILE + offset.x, oy + npc.y * TILE + offset.y).setDepth(depth);
        name.setText(npc.name).setPosition(ox + npc.x * TILE, oy + npc.y * TILE - asset.frameHeight * asset.renderScale * actorScale + 8).setDepth(depth + 2);
      }
    }
    const appearance = controller.player?.appearance, playerAsset = appearance?.gender === 'MALE' ? baishiV2ArtAssets.playerMale : baishiV2ArtAssets.playerFemale;
    const playerKey = appearance?.gender === 'MALE' ? 'formal-player-male' : 'formal-player-female', row = playerAsset.directionRows[controller.direction], frame = controller.moving ? Math.floor((controller.walkTime * 8) % playerAsset.framesPerDirection) : 0;
    const offset = playerAsset.frameOffsets?.[controller.direction]?.[frame] ?? { x: 0, y: 0 }, playerDepth = worldActorDepth(controller.y);
    const playerReady = this.textures.exists(playerKey);
    this.playerSprite.setTexture(playerKey).setOrigin(playerAsset.footAnchorX / playerAsset.frameWidth, playerAsset.footAnchorY / playerAsset.frameHeight).setDisplaySize(playerAsset.frameWidth * playerAsset.renderScale * actorScale, playerAsset.frameHeight * playerAsset.renderScale * actorScale).setFrame(row * playerAsset.columns + frame).setPosition(ox + controller.x * TILE + offset.x, oy + controller.y * TILE + offset.y).setDepth(playerDepth).setVisible(!!appearance && playerReady);
    this.playerName.setText(controller.player?.profile ? controller.player.profile.surname + controller.player.profile.givenName : '你').setPosition(ox + controller.x * TILE + offset.x, playerNameTopY(oy + controller.y * TILE, playerAsset.footAnchorY, playerAsset.renderScale, view!.scene.id, offset.y)).setDepth(playerDepth + 2).setVisible(!!appearance && playerReady);
  }
  private async ensureInteriorArt(sceneId: string) {
    const art = baishiInteriorArtRegistry.find(asset => asset.sceneId === sceneId);
    if (!art || this.pendingInteriorArt.has(sceneId) || this.textures.exists(art.assetKey) && this.textures.exists(art.foreground.assetKey)) return;
    this.pendingInteriorArt.add(sceneId);
    try {
      await this.interiorAssetLoader.load(art, this.textures, () => wx.createImage());
      this.interiorBackgrounds.set(sceneId, this.add.image(0, 0, art.assetKey).setOrigin(0).setDisplaySize(art.width, art.height).setDepth(GROUND_DEPTH).setVisible(false));
      this.interiorForegrounds.set(sceneId, this.add.image(0, 0, art.foreground.assetKey).setOrigin(0).setDisplaySize(art.width, art.height).setDepth(WORLD_BASE).setVisible(false));
      this.worldOverlayCamera.ignore([this.interiorBackgrounds.get(sceneId)!, this.interiorForegrounds.get(sceneId)!]);
    } catch (error: any) {
      console.warn('[FJHY remote asset] interior unavailable; scene fallback remains active', { sceneId, errMsg: error?.message });
    } finally { this.pendingInteriorArt.delete(sceneId); }
  }
  private render() {
    const view = controller.view; this.cameras.main.setZoom(view?.scene.id === 'STREET_BAISHI_01' ? OUTDOOR_CAMERA_ZOOM : 1); this.graphics.clear(); this.debugGraphics.clear(); this.labelIndex = 0;
    const painter: Painter = {
      rect: (x, y, w, h, fill) => { const c = color(fill); this.graphics.fillStyle(c.value, c.alpha); this.graphics.fillRect(x, y, w, h); },
      circle: (x, y, r, fill) => { const c = color(fill); this.graphics.fillStyle(c.value, c.alpha); this.graphics.fillCircle(x, y, r); },
      text: (value, x, y, size, fill) => { let label = this.labels[this.labelIndex++]; if (!label) { label = this.add.text(0, 0, '', { fontFamily: 'Microsoft YaHei, Arial', fontSize: size, color: '#ffffff', stroke: '#23352b', strokeThickness: 1 }).setOrigin(.5).setDepth(WORLD_BASE - 1); this.worldOverlayCamera.ignore(label); this.labels.push(label); } label.setText(value).setPosition(x, y).setFontSize(size).setColor(fill).setVisible(true); },
    };
    if (controller.boot && !controller.player?.appearance) { this.ground?.setVisible(false); this.nightOverlay.setVisible(false); for (const image of [...this.buildings.values(), ...this.foregrounds.values(), ...this.shopSigns.values(), ...this.shopSignTemplates.values(), ...this.interiorBackgrounds.values(), ...this.interiorForegrounds.values(), ...this.actors.values(), ...this.actorNames.values()]) image.setVisible(false); this.playerSprite.setVisible(false); this.playerName.setVisible(false); const asset = draft.gender === 'MALE' ? baishiV2ArtAssets.playerMale : baishiV2ArtAssets.playerFemale; this.playerSprite.setTexture(asset.assetKey, asset.directionRows.down * asset.columns).setPosition(WIDTH * .35, HEIGHT / 2 + 35).setDisplaySize(128, 128).setDepth(WORLD_BASE).setVisible(true); }
    else if (view) {
      const ox = WIDTH / 2 - controller.x * TILE, oy = HEIGHT / 2 - controller.y * TILE, street = view.scene.id === 'STREET_BAISHI_01';
      const groundReady = this.textures.exists(groundKey);
      this.ground?.setVisible(street && groundReady).setPosition(ox, oy);
      const interiorArt = baishiInteriorArtRegistry.find(asset => asset.sceneId === view.scene.id);
      if (interiorArt && !this.textures.exists(interiorArt.assetKey)) void this.ensureInteriorArt(interiorArt.sceneId);
      const interiorReady = !!interiorArt && this.textures.exists(interiorArt.assetKey) && this.textures.exists(interiorArt.foreground.assetKey);
      for (const asset of baishiInteriorArtRegistry) {
        this.interiorBackgrounds.get(asset.sceneId)?.setVisible(!street && interiorReady && asset.sceneId === view.scene.id).setPosition(ox, oy);
        this.interiorForegrounds.get(asset.sceneId)?.setVisible(!street && interiorReady && asset.sceneId === view.scene.id).setPosition(ox, oy).setDepth(worldBuildingDepth(asset.foreground.occlusionFrontY));
      }
      const formalNpcIds = baishiFormalArtRegistry.npcs.filter(asset => this.textures.exists(asset.assetKey)).map(asset => asset.npcId), playerKey = controller.player?.appearance?.gender === 'MALE' ? 'formal-player-male' : 'formal-player-female', playerReady = this.textures.exists(playerKey);
      const drawInteriorFallback = !street && !interiorReady;
      controller.render(painter, WIDTH, HEIGHT, !street ? drawInteriorFallback : !groundReady, !street ? drawInteriorFallback : false, true, formalNpcIds, playerReady, drawInteriorFallback);
      this.renderFormalWorld(ox, oy);
      if (debugCollision) {
        this.debugGraphics.fillStyle(0xff334f, .2); this.debugGraphics.lineStyle(2, 0xff5d73, .9);
        for (const rect of view.scene.collision) { this.debugGraphics.fillRect(ox + rect.x * TILE, oy + rect.y * TILE, rect.width * TILE, rect.height * TILE); this.debugGraphics.strokeRect(ox + rect.x * TILE, oy + rect.y * TILE, rect.width * TILE, rect.height * TILE); }
        this.debugGraphics.fillStyle(0xffd54f, .18); this.debugGraphics.lineStyle(2, 0xffe680, .9);
        for (const plot of view.plots.filter(plot => plot.buildingId)) { this.debugGraphics.fillRect(ox + plot.x * TILE, oy + plot.y * TILE, plot.width * TILE, plot.height * TILE); this.debugGraphics.strokeRect(ox + plot.x * TILE, oy + plot.y * TILE, plot.width * TILE, plot.height * TILE); }
        this.debugGraphics.lineStyle(2, 0x38d9ff, .95);
        for (const plot of view.plots) for (const entrance of plot.entrances ?? []) { const area = entrance.interactionArea; this.debugGraphics.strokeRect(ox + area.x * TILE, oy + area.y * TILE, area.width * TILE, area.height * TILE); }
        const targeting = controller.interactionDebug(), colors: Record<string, number> = { portal: 0x38d9ff, entrance: 0x38d9ff, npc: 0x8cdb75, service: 0xffd54f, furniture: 0xff9f43, scripted: 0xff5b8a };
        for (const zone of targeting.zones) { const color = colors[zone.type] ?? 0xffffff, active = zone.id === targeting.active?.id; this.debugGraphics.lineStyle(active ? 3 : 1, color, active ? 1 : .72); if (zone.zone && zone.type === 'npc') this.debugGraphics.strokeRoundedRect(ox + zone.zone.x * TILE, oy + zone.zone.y * TILE, zone.zone.width * TILE, zone.zone.height * TILE, (zone.radius ?? 0) * TILE); else if (zone.zone) this.debugGraphics.strokeRect(ox + zone.zone.x * TILE, oy + zone.zone.y * TILE, zone.zone.width * TILE, zone.zone.height * TILE); else this.debugGraphics.strokeCircle(ox + zone.anchor.x * TILE, oy + zone.anchor.y * TILE, (zone.radius ?? .25) * TILE); }
        const detail = targeting.active ? `${targeting.active.id} ${targeting.active.type} d=${targeting.active.distance.toFixed(2)} s=${targeting.active.score.toFixed(0)}` : 'interaction none';
        this.frame.setText(`${this.fps} FPS\n${detail}`);
        if (detail !== this.debugInteractionKey) { this.debugInteractionKey = detail; console.info('[FJHY interaction debug]', { targetId: targeting.active?.id, type: targeting.active?.type, distance: targeting.active?.distance, score: targeting.active?.score, foot: targeting.foot, npcChecks: targeting.npcChecks }); }
        this.debugGraphics.fillStyle(0xffffff, 1); this.debugGraphics.fillCircle(ox + controller.x * TILE, oy + controller.y * TILE, 7);
      }
      const night = view.phase === '深夜' || view.phase === '夜晚'; this.nightOverlay.setVisible(night).setFillStyle(0x233052, view.phase === '深夜' ? .32 : .2);
    } else { this.ground?.setVisible(false); this.nightOverlay.setVisible(false); for (const image of [...this.buildings.values(), ...this.foregrounds.values(), ...this.shopSigns.values(), ...this.shopSignTemplates.values(), ...this.interiorBackgrounds.values(), ...this.interiorForegrounds.values(), ...this.actors.values(), ...this.actorNames.values()]) image.setVisible(false); this.playerSprite.setVisible(false); this.playerName.setVisible(false); }
    for (let i = this.labelIndex; i < this.labels.length; i++) this.labels[i].setVisible(false);
  }
}

declare const GameGlobal: { __fjhyWechatCanvas: HTMLCanvasElement };
const visibleCanvas = GameGlobal.__fjhyWechatCanvas;
installWeChatTouchMoveBridge();
new Phaser.Game({ type: Phaser.CANVAS, customEnvironment: true, canvas: visibleCanvas, width: WIDTH, height: HEIGHT, parent: null, expandParent: false, backgroundColor: '#b7cba5', scene: [BaishiWechatScene], scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.NO_CENTER }, ...PIXEL_ART_RENDER_CONFIG });
