import Phaser from 'phaser';
import { GameController, formatQuestTracker, formatCyclingQuestTracker, baishiFormalArtRegistry, baishiV2ArtAssets, GROUND_DEPTH, WORLD_BASE, PORTRAIT_DIM_DEPTH, PORTRAIT_DEPTH, UI_DEPTH_BASE, DEBUG_DEPTH, worldActorDepth, worldBuildingDepth, buildingImagePosition, foregroundImagePosition, OUTDOOR_CAMERA_ZOOM, actorVisualScale, DIALOGUE_PORTRAIT_SCALE, DIALOGUE_ACTIVE_PORTRAIT_SCALE, DIALOGUE_INACTIVE_ALPHA, JOYSTICK_VISUAL_SCALE, JOYSTICK_HIT_SCALE, type Direction, type Painter } from '../../../packages/client-runtime/index.js';
import { availableStarterLookOptions } from '../../../packages/game-config/appearance-v1.js';
import { createWeChatPlatform, safeInsets, allowWechatDebug } from './wechat-platform';
import { loadWechatAssets } from './assets';
import { mobileLayout } from './layout';
import { baishiCompatibility } from './compatibility';
import { mobileTypography } from './typography';
import { MobileDialogueUi } from './dialogue-ui';
declare const wx: any;

declare const __WECHAT_API_BASE_URL__: string;
declare const __WECHAT_DEV_OPEN_ALL__: boolean;
declare const __WECHAT_DEV_COLLISION__: boolean;
declare const __WECHAT_DEV_SAFE_RESET__: boolean;
declare const __WECHAT_DEV_LOGIN__: boolean;
const windowInfo = wx.getWindowInfo?.() ?? wx.getSystemInfoSync();
const layout = mobileLayout(windowInfo, wx.getMenuButtonBoundingClientRect?.());
const WIDTH = layout.width, HEIGHT = layout.height, TILE = 32, groundKey = 'baishi-ground-image';
const platform = createWeChatPlatform(__WECHAT_API_BASE_URL__, { debugOpenAll: __WECHAT_DEV_OPEN_ALL__ });
const controller = new GameController(platform.transport);
const debugCollision = allowWechatDebug(__WECHAT_DEV_COLLISION__, wx.getAccountInfoSync?.().miniProgram?.envVersion);
type Draft = { gender: 'MALE' | 'FEMALE'; skinToneId: string; hairId: string; outfitId: string; direction: Direction };
const draft: Draft = { gender: 'FEMALE', skinToneId: 'SKIN_LIGHT', hairId: 'F_HAIR_01', outfitId: 'F_OUTFIT_01', direction: 'down' };
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
  private primary!: Phaser.GameObjects.Text;
  private shopBackdrop!: Phaser.GameObjects.Rectangle;
  private shopTitle!: Phaser.GameObjects.Text;
  private shopBalance!: Phaser.GameObjects.Text;
  private shopFeedback!: Phaser.GameObjects.Text;
  private shopRows: { icon: Phaser.GameObjects.Text; title: Phaser.GameObjects.Text; detail: Phaser.GameObjects.Text; buy: Phaser.GameObjects.Text; sell: Phaser.GameObjects.Text }[] = [];
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
  constructor() { super('baishi-wechat'); }
  private ready = false;
  private contentError = '';
  private shopOpen = false;
  private shopToggle!: Phaser.GameObjects.Text;
  private safeResetButton!: Phaser.GameObjects.Text;
  private genderToggle!: Phaser.GameObjects.Text;
  private creationChoices: Phaser.GameObjects.Text[] = [];
  private creationStep = 0;
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
    for (const asset of baishiFormalArtRegistry.npcs) {
      this.actors.set(asset.npcId, this.add.sprite(0, 0, asset.assetKey, 0).setOrigin(asset.footAnchorX / asset.frameWidth, asset.footAnchorY / asset.frameHeight).setDisplaySize(asset.frameWidth * asset.renderScale, asset.frameHeight * asset.renderScale).setVisible(false));
      this.actorNames.set(asset.npcId, this.add.text(0, 0, '', { fontFamily: 'Microsoft YaHei, Arial', fontSize: '16px', color: '#445749', stroke: '#f8f3df', strokeThickness: 3 }).setOrigin(.5, 1).setVisible(false));
    }
    this.playerSprite = this.add.sprite(0, 0, 'formal-player-female', 0).setOrigin(.5, 59 / 64).setDisplaySize(60, 60).setVisible(false);
    this.playerName = this.add.text(0, 0, '你', { fontFamily: 'Microsoft YaHei, Arial', fontSize: '17px', color: '#445749', stroke: '#f8f3df', strokeThickness: 3 }).setOrigin(.5, 1).setVisible(false);
    this.nightOverlay = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x233052, 0).setDepth(UI_DEPTH_BASE - 10).setVisible(false);
    this.portraitDim = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x18251c, .38).setDepth(PORTRAIT_DIM_DEPTH).setVisible(false);
    this.portraitDim.setInteractive().on('pointerdown', () => this.advanceDialogue());
    for (const asset of baishiFormalArtRegistry.portraits) this.portraits.set(asset.speaker, this.add.image(WIDTH - insets.right - 145, HEIGHT - insets.bottom - 12, asset.assetKey).setOrigin(asset.originX, asset.originY).setDisplaySize(asset.preferredWidth * DIALOGUE_PORTRAIT_SCALE * DIALOGUE_ACTIVE_PORTRAIT_SCALE, asset.preferredHeight * DIALOGUE_PORTRAIT_SCALE * DIALOGUE_ACTIVE_PORTRAIT_SCALE).setDepth(PORTRAIT_DEPTH).setVisible(false));
    this.playerPortraits.set('MALE', this.add.image(insets.left + 145, HEIGHT - insets.bottom - 12, 'portrait-player-male').setOrigin(.5, 1).setDisplaySize(264 * DIALOGUE_PORTRAIT_SCALE, 264 * DIALOGUE_PORTRAIT_SCALE).setDepth(PORTRAIT_DEPTH).setVisible(false));
    this.playerPortraits.set('FEMALE', this.add.image(insets.left + 145, HEIGHT - insets.bottom - 12, 'portrait-player-female').setOrigin(.5, 1).setDisplaySize(264 * DIALOGUE_PORTRAIT_SCALE, 264 * DIALOGUE_PORTRAIT_SCALE).setDepth(PORTRAIT_DEPTH).setVisible(false));
    this.dialogueUi = new MobileDialogueUi(this, WIDTH, HEIGHT, insets, () => this.advanceDialogue());
    this.hud = this.add.text(insets.left + 18, insets.top + 14, '', { fontFamily: 'Arial', fontSize: '17px', color: '#ffffff', stroke: '#26352d', strokeThickness: 3, lineSpacing: 5 }).setDepth(UI_DEPTH_BASE + 20);
    this.message = this.add.text(WIDTH / 2, HEIGHT - insets.bottom - 108, '', { fontFamily: 'Microsoft YaHei, Arial', fontSize: `${mobileTypography.notice}px`, color: '#ffffff', align: 'center', stroke: '#26352d', strokeThickness: 3, wordWrap: { width: Math.min(WIDTH - insets.left - insets.right - 60, 620) }, lineSpacing: 6 }).setOrigin(.5, 1).setDepth(UI_DEPTH_BASE + 30);
    this.frame = this.add.text(WIDTH - insets.right - 12, insets.top + 12, '', { fontFamily: 'Arial', fontSize: '14px', color: '#edf3d7', stroke: '#26352d', strokeThickness: 3 }).setOrigin(1, 0).setDepth(UI_DEPTH_BASE + 20);
    this.questToggle = this.button(WIDTH - insets.right - 62, insets.top + 54, 100, '任务 ▲', () => { this.questCollapsed = !this.questCollapsed; this.syncQuestPanel(); });
    this.questPanel = this.add.text(WIDTH - insets.right - 12, insets.top + 82, '', { fontFamily: 'Microsoft YaHei, Arial', fontSize: `${mobileTypography.quest}px`, color: '#385446', backgroundColor: '#fffef0', padding: { left: 14, right: 14, top: 12, bottom: 12 }, fixedWidth: 330, wordWrap: { width: 302 }, lineSpacing: 6 }).setOrigin(1, 0).setDepth(UI_DEPTH_BASE + 39);
    this.questPanel.setInteractive().on('pointerdown', () => { this.questIndex++; this.syncQuestPanel(); });
    this.primary = this.button(WIDTH - insets.right - 92, HEIGHT - insets.bottom - 80, 104, '互动', () => void this.run(() => controller.interact()));
    this.shopBackdrop = this.add.rectangle(WIDTH - 468, 224, 388, 70, 0xfff9e9, .96).setOrigin(0).setStrokeStyle(2, 0xa8794f).setDepth(UI_DEPTH_BASE + 37).setVisible(false);
    this.shopTitle = this.add.text(WIDTH - 450, 238, '', { fontFamily: 'Microsoft YaHei, Arial', fontSize: '18px', color: '#fef9ec', backgroundColor: '#7a9a77', fixedWidth: 350, padding: { left: 12, right: 12, top: 8, bottom: 8 } }).setDepth(UI_DEPTH_BASE + 38).setVisible(false);
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
    this.shopToggle = this.button(WIDTH - insets.right - 92, HEIGHT - insets.bottom - 150, 112, '交易', () => { this.shopOpen = !this.shopOpen; this.clearStick(); this.syncUi(); });
    this.safeResetButton = this.button(insets.left + 100, insets.top + 108, 176, '恢复到安全点', () => void this.run(() => controller.write('/v1/player/debug-safe-reset', {})));
    this.safeResetButton.setVisible(false);
    this.genderToggle = this.button(insets.left + 105, HEIGHT - insets.bottom - 75, 150, '上一步', () => { this.creationStep = Math.max(0, this.creationStep - 1); this.syncUi(); });
    this.creationChoices = [0, 1, 2].map(index => this.button(WIDTH - insets.right - 175, HEIGHT / 2 - 70 + index * 68, 280, '', () => this.chooseCreation(index)));
    this.homeBackdrop = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x223c30, .85).setDepth(UI_DEPTH_BASE + 39).setInteractive().setVisible(false);
    this.homeTitle = this.add.text(WIDTH / 2, HEIGHT / 2 - 120, '富甲横阳', {fontFamily:'Microsoft YaHei, Arial',fontSize:'27px',color:'#ffffff',align:'center',wordWrap:{width:Math.min(640,WIDTH-insets.left-insets.right-40)}}).setOrigin(.5).setDepth(UI_DEPTH_BASE + 41).setVisible(false);
    this.homeStart = this.button(WIDTH / 2, HEIGHT / 2, 220, '开始游戏', () => { this.homeMode = false; this.syncUi(); });
    this.homeContinue = this.button(WIDTH / 2, HEIGHT / 2 - 18, 220, '继续游戏', () => { this.homeMode = false; this.syncUi(); });
    this.homeRestart = this.button(WIDTH / 2, HEIGHT / 2 + 70, 220, '重新开始', () => { this.confirmingRestart = true; this.syncUi(); });
    this.restartCancel = this.button(WIDTH / 2 - 135, HEIGHT / 2 + 75, 190, '取消', () => { this.confirmingRestart = false; this.syncUi(); });
    this.restartAccept = this.button(WIDTH / 2 + 135, HEIGHT / 2 + 75, 220, '确定重新开始', () => void this.run(async () => { await controller.restart(); this.confirmingRestart = false; this.homeMode = false; this.creationStep = 0; }));
    for (const button of [this.homeStart,this.homeContinue,this.homeRestart,this.restartCancel,this.restartAccept]) button.setVisible(false);
    const capsule = wx.getMenuButtonBoundingClientRect?.();
    const rightTop = Math.max(insets.top + 12, (capsule?.bottom ?? 0) / windowInfo.windowHeight * HEIGHT + 12);
    this.frame.setY(rightTop);
    this.questToggle.setY(rightTop + 42);
    this.questPanel.setY(rightTop + 72);
    controller.onChange = () => this.syncUi();
    const world = [this.graphics, this.debugGraphics, this.ground, this.playerSprite, this.playerName, ...this.buildings.values(), ...this.foregrounds.values(), ...this.actors.values(), ...this.actorNames.values()];
    const ui = this.children.list.filter(child => !world.includes(child as typeof world[number]));
    this.cameras.main.ignore(ui);
    this.worldOverlayCamera = this.cameras.add(0, 0, WIDTH, HEIGHT);
    this.worldOverlayCamera.ignore(world);
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
    const button = this.add.text(x, y, text, { fontFamily: 'Arial', fontSize: `${mobileTypography.option}px`, color: '#ffffff', backgroundColor: '#39775f', padding: { left: 12, right: 12, top: 20, bottom: 20 }, align: 'center', fixedWidth: width }).setOrigin(.5).setDepth(UI_DEPTH_BASE + 40).setInteractive({ useHandCursor: true });
    button.on('pointerdown', action); return button;
  }
  private setStick(pointer: Phaser.Input.Pointer) {
    const dx = pointer.x - this.stickBase.x, dy = pointer.y - this.stickBase.y, length = Math.hypot(dx, dy) || 1, scale = Math.min(32 * JOYSTICK_VISUAL_SCALE / length, 1);
    this.stick.setPosition(this.stickBase.x + dx * scale, this.stickBase.y + dy * scale);
    this.move = { x: dx / length, y: dy / length };
  }
  private clearStick() { this.stickPointer = null; this.move = { x: 0, y: 0 }; if (this.stick) this.stick.setPosition(this.stickBase.x, this.stickBase.y); }
  private advanceDialogue() {
    if (!controller.dialogue || this.dialogueUi.advance()) return;
    controller.dialogue = null; controller.dialogueSpeaker = null; controller.message = '';
    this.syncUi();
  }
  private async run(action: () => Promise<unknown>) { try { await action(); } catch (error: any) { controller.message = error.message ?? '操作失败'; } this.syncUi(); }
  private async createPreviewPlayer() {
    await controller.create(draft.gender, { skinToneId: draft.skinToneId, hairId: draft.hairId, outfitId: draft.outfitId });
    await this.checkContent();
  }
  private creationOptions() {
    const boot = controller.boot;
    if (!boot) return { skins: [], hairs: [], outfits: [] };
    const { skins, hairs, outfits, selection } = availableStarterLookOptions(boot, draft.gender, draft);
    Object.assign(draft, selection);
    return { skins, hairs, outfits };
  }
  private chooseCreation(index: number) {
    const options = this.creationOptions();
    if (this.creationStep === 0) draft.gender = (['MALE', 'FEMALE'] as const)[index] ?? draft.gender;
    if (this.creationStep === 1) draft.skinToneId = options.skins[index]?.id ?? draft.skinToneId;
    if (this.creationStep === 2) draft.hairId = options.hairs[index]?.id ?? draft.hairId;
    if (this.creationStep === 3) draft.outfitId = options.outfits[index]?.id ?? draft.outfitId;
    controller.message = '欢迎来到横阳';
    this.syncUi();
  }
  private syncCreationUi() {
    const options = this.creationOptions();
    const groups = [
      [{ id: 'MALE', name: '男' }, { id: 'FEMALE', name: '女' }],
      options.skins, options.hairs, options.outfits, []
    ];
    const selected = [draft.gender, draft.skinToneId, draft.hairId, draft.outfitId, ''][this.creationStep];
    for (const [index, button] of this.creationChoices.entries()) {
      const item = groups[this.creationStep]?.[index];
      button.setVisible(!!item).setText(item ? `${item.id === selected ? '✓ ' : ''}${item.name}` : '');
    }
    this.genderToggle.setVisible(this.creationStep > 0);
    const labels = ['选择性别', '选择肤色', '选择完整发型', '选择整套服装', '确认形象'];
    this.message.setText(`${labels[this.creationStep]} · ${this.creationStep + 1}/5\n当前使用已穿衣的正式基础贴片预览`);
    this.primary.setText(this.creationStep === 4 ? '确认创建' : '下一步').setVisible(!!draft.skinToneId && !!draft.hairId && !!draft.outfitId)
      .removeAllListeners('pointerdown').on('pointerdown', () => this.creationStep === 4 ? void this.run(() => this.createPreviewPlayer()) : (this.creationStep++, this.syncUi()));
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
    if (home) {
      this.stickBase.setVisible(false); this.stick.setVisible(false); this.stickHit.setVisible(false); this.primary.setVisible(false); this.shopToggle.setVisible(false); this.safeResetButton.setVisible(false); this.genderToggle.setVisible(false);
      for (const choice of this.creationChoices) choice.setVisible(false);
      this.questToggle.setVisible(false); this.questPanel.setVisible(false); this.shopBackdrop.setVisible(false); this.shopTitle.setVisible(false); this.shopBalance.setVisible(false); this.shopFeedback.setVisible(false);
      for (const row of this.shopRows) Object.values(row).forEach(node => node.setVisible(false));
      this.portraitDim.setVisible(false); this.dialogueUi.sync('', '', false); this.message.setVisible(false); this.hud.setVisible(false); this.clearStick(); return;
    }
    this.message.setVisible(true); this.hud.setVisible(true);
    this.stickBase.setVisible(hasPlayer); this.stick.setVisible(hasPlayer); this.stickHit.setVisible(hasPlayer);
    const dialogue = !!controller.dialogue && !!controller.dialogueSpeaker;
    const canShop = !dialogue && !!controller.shopPanel() && !!controller.view?.npcs.some(n => Math.hypot(n.x - controller.x, n.y - controller.y) < 6);
    this.genderToggle.setVisible(false);
    for (const button of this.creationChoices) button.setVisible(false);
    if (!canShop || controller.offline || controller.pending) this.shopOpen = false;
    const isShop = canShop && this.shopOpen;
    this.shopToggle.setVisible(canShop).setText(this.shopOpen ? '收起交易' : '交易');
    this.safeResetButton.setVisible(hasPlayer && allowWechatDebug(__WECHAT_DEV_SAFE_RESET__, wx.getAccountInfoSync?.().miniProgram?.envVersion));
    if (this.shopOpen) this.shopToggle.setPosition(WIDTH - 530, 248); else this.shopToggle.setPosition(WIDTH - safeInsets(WIDTH, HEIGHT).right - 92, HEIGHT - safeInsets(WIDTH, HEIGHT).bottom - 150);
    if (dialogue || isShop) this.clearStick();
    this.stickBase.setVisible(hasPlayer && !dialogue); this.stick.setVisible(hasPlayer && !dialogue); this.stickHit.setVisible(hasPlayer && !dialogue);
    if (controller.boot && !hasPlayer) this.syncCreationUi();
    else { this.primary.removeAllListeners('pointerdown').on('pointerdown', () => void this.run(() => controller.interact())); this.primary.setText(controller.nearby()?.label?.replace(/^进入/, '进 ') ?? '互动'); this.primary.setVisible(hasPlayer && !isShop && !dialogue); }
    this.hud.setText(hasPlayer ? `${controller.view?.scene.name ?? '横阳'} · ${player!.cash} 文` : '富甲横阳 · 白石街真机体验');
    if (hasPlayer || !controller.boot || this.contentError || (controller.message && controller.message !== '欢迎来到横阳')) this.message.setText(this.contentError || controller.message || '').setDepth(dialogue ? PORTRAIT_DEPTH + 10 : UI_DEPTH_BASE + 30);
    if (controller.offline || controller.pending || this.loginFailed) this.primary.setVisible(true).setText('重新连接').removeAllListeners('pointerdown').on('pointerdown', () => void this.run(() => this.loginFailed ? this.loginPreview() : controller.retry()));
    if (this.contentError) this.primary.setVisible(false);
    this.portraitDim.setVisible(dialogue);
    this.dialogueUi.sync(controller.dialogueSpeaker ?? '', controller.message, dialogue);
    this.message.setVisible(!dialogue);
    for (const [speaker, portrait] of this.portraits) portrait.setVisible(dialogue && speaker === controller.dialogueSpeaker && this.textures.exists(portrait.texture.key)).setAlpha(1);
    for (const [gender, portrait] of this.playerPortraits) portrait.setVisible(dialogue && gender === player?.appearance?.gender && this.textures.exists(portrait.texture.key)).setAlpha(DIALOGUE_INACTIVE_ALPHA);
    this.questToggle.setVisible(hasPlayer);
    this.syncQuestPanel();
    this.syncShopPanel();
  }
  private syncQuestPanel() {
    const tasks = controller.questTracker().sort((a, b) => Number(a.completed) - Number(b.completed));
    this.questIndex %= Math.max(tasks.length, 1);
    const task = tasks[this.questIndex];
    this.questToggle?.setText(`任务 ${this.questCollapsed ? '▼' : '▲'}`);
    this.questPanel?.setText(task ? formatCyclingQuestTracker(formatQuestTracker(task), this.questIndex, tasks.length) : '暂无进行中的任务').setVisible(!!controller.player?.appearance && !this.questCollapsed && !this.shopOpen && !controller.dialogue);
  }
  private ensureShopRows(count: number) { while (this.shopRows.length < count) { const icon = this.add.text(WIDTH - 448, 0, '', { fontFamily: 'Microsoft YaHei, Arial', fontSize: '18px', color: '#6a472c', backgroundColor: '#f1d58d', fixedWidth: 34, fixedHeight: 34, align: 'center', padding: { top: 6 } }).setDepth(UI_DEPTH_BASE + 39); const title = this.add.text(WIDTH - 405, 0, '', { fontFamily: 'Microsoft YaHei, Arial', fontSize: '15px', color: '#4c392b' }).setDepth(UI_DEPTH_BASE + 39); const detail = this.add.text(WIDTH - 405, 0, '', { fontFamily: 'Microsoft YaHei, Arial', fontSize: '14px', color: '#806f5c' }).setDepth(UI_DEPTH_BASE + 39); const buy = this.button(WIDTH - 186, 0, 76, '买入', () => {}); const sell = this.button(WIDTH - 110, 0, 76, '出售', () => {}); this.cameras.main.ignore([icon, title, detail, buy, sell]); this.shopRows.push({ icon, title, detail, buy, sell }); } }
  private syncShopPanel() { const shop = controller.shopPanel(), nearClerk = !!controller.view?.npcs.some(n => Math.hypot(n.x - controller.x, n.y - controller.y) < 6), visible = this.shopOpen && !controller.dialogue && !!shop && nearClerk; this.shopBackdrop.setVisible(visible); this.shopTitle.setVisible(visible); this.shopBalance.setVisible(visible); this.shopFeedback.setVisible(visible); for (const row of this.shopRows) Object.values(row).forEach(node => node.setVisible(false)); if (!shop || !visible) return; const height = 62 + shop.items.length * 64 + 34; this.shopBackdrop.setSize(388, height); this.shopTitle.setText(`  ${shop.title}`); this.shopBalance.setText(`铜钱 ${shop.balance} 文`); this.shopFeedback.setPosition(WIDTH - 450, 224 + height - 28).setText(controller.message || ''); this.ensureShopRows(shop.items.length); shop.items.forEach((item, index) => { const row = this.shopRows[index], y = 286 + index * 64; row.icon.setPosition(WIDTH - 448, y).setText(item.icon).setVisible(true); row.title.setPosition(WIDTH - 405, y).setText(item.name).setVisible(true); row.detail.setPosition(WIDTH - 405, y + 24).setText(`背包持有 ×${item.owned}`).setVisible(true); row.buy.setPosition(WIDTH - 186, y + 18).setText(`买入 ${item.buyPrice}`).setVisible(true).setInteractive(); row.sell.setPosition(WIDTH - 110, y + 18).setText(`出售 ${item.sellPrice}`).setVisible(true).setInteractive(); row.buy.removeAllListeners('pointerdown').on('pointerdown', () => void this.run(() => controller.trade('buy', item.id))); row.sell.removeAllListeners('pointerdown').on('pointerdown', () => void this.run(() => controller.trade('sell', item.id))); }); }
  update(_: number, delta: number) {
    if (!this.ready) return;
    this.fpsElapsed += delta; this.fpsFrames++; if (this.fpsElapsed >= 500) { this.fps = Math.round(this.fpsFrames * 1000 / this.fpsElapsed); this.fpsElapsed = 0; this.fpsFrames = 0; }
    controller.tick(Math.min(delta / 1000, .05), this.homeMode || this.contentError || controller.dialogue || this.shopOpen ? 0 : this.move.x, this.homeMode || this.contentError || controller.dialogue || this.shopOpen ? 0 : this.move.y);
    this.frame.setText(`${this.fps} FPS`);
    this.render();
  }
  private renderFormalWorld(ox: number, oy: number) {
    const view = controller.view, street = view?.scene.id === 'STREET_BAISHI_01', actorScale = actorVisualScale(view?.scene.id ?? 'STREET_BAISHI_01');
    for (const [buildingId, image] of this.buildings) {
      const asset = baishiFormalArtRegistry.buildings.find(candidate => candidate.buildingId === buildingId)!;
      const position = buildingImagePosition(asset, TILE);
      image.setVisible(!!street && this.textures.exists(asset.assetKey)).setPosition(ox + position.x, oy + position.y).setDepth(worldBuildingDepth(asset.occlusionFrontY!));
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
    this.playerName.setPosition(ox + controller.x * TILE, oy + controller.y * TILE - playerAsset.frameHeight * playerAsset.renderScale * actorScale + 8).setDepth(playerDepth + 2).setVisible(!!appearance && playerReady);
  }
  private render() {
    const view = controller.view; this.cameras.main.setZoom(view?.scene.id === 'STREET_BAISHI_01' ? OUTDOOR_CAMERA_ZOOM : 1); this.graphics.clear(); this.debugGraphics.clear(); this.labelIndex = 0;
    const painter: Painter = {
      rect: (x, y, w, h, fill) => { const c = color(fill); this.graphics.fillStyle(c.value, c.alpha); this.graphics.fillRect(x, y, w, h); },
      circle: (x, y, r, fill) => { const c = color(fill); this.graphics.fillStyle(c.value, c.alpha); this.graphics.fillCircle(x, y, r); },
      text: (value, x, y, size, fill) => { let label = this.labels[this.labelIndex++]; if (!label) { label = this.add.text(0, 0, '', { fontFamily: 'Microsoft YaHei, Arial', fontSize: size, color: '#ffffff', stroke: '#23352b', strokeThickness: 1 }).setOrigin(.5).setDepth(WORLD_BASE - 1); this.worldOverlayCamera.ignore(label); this.labels.push(label); } label.setText(value).setPosition(x, y).setFontSize(size).setColor(fill).setVisible(true); },
    };
    if (controller.boot && !controller.player?.appearance) { this.ground?.setVisible(false); this.nightOverlay.setVisible(false); for (const image of [...this.buildings.values(), ...this.foregrounds.values(), ...this.actors.values(), ...this.actorNames.values()]) image.setVisible(false); this.playerSprite.setVisible(false); this.playerName.setVisible(false); const asset = draft.gender === 'MALE' ? baishiV2ArtAssets.playerMale : baishiV2ArtAssets.playerFemale; this.playerSprite.setTexture(asset.assetKey, asset.directionRows.down * asset.columns).setPosition(WIDTH * .35, HEIGHT / 2 + 35).setDisplaySize(128, 128).setDepth(WORLD_BASE).setVisible(true); }
    else if (view) {
      const ox = WIDTH / 2 - controller.x * TILE, oy = HEIGHT / 2 - controller.y * TILE, street = view.scene.id === 'STREET_BAISHI_01';
      const groundReady = this.textures.exists(groundKey);
      this.ground?.setVisible(street && groundReady).setPosition(ox, oy);
      const formalNpcIds = baishiFormalArtRegistry.npcs.filter(asset => this.textures.exists(asset.assetKey)).map(asset => asset.npcId), playerKey = controller.player?.appearance?.gender === 'MALE' ? 'formal-player-male' : 'formal-player-female', playerReady = this.textures.exists(playerKey);
      controller.render(painter, WIDTH, HEIGHT, !street || !groundReady, !street, true, formalNpcIds, playerReady, false);
      this.renderFormalWorld(ox, oy);
      if (debugCollision) {
        this.debugGraphics.fillStyle(0xff334f, .2); this.debugGraphics.lineStyle(2, 0xff5d73, .9);
        for (const rect of view.scene.collision) { this.debugGraphics.fillRect(ox + rect.x * TILE, oy + rect.y * TILE, rect.width * TILE, rect.height * TILE); this.debugGraphics.strokeRect(ox + rect.x * TILE, oy + rect.y * TILE, rect.width * TILE, rect.height * TILE); }
        this.debugGraphics.fillStyle(0xffd54f, .18); this.debugGraphics.lineStyle(2, 0xffe680, .9);
        for (const plot of view.plots.filter(plot => plot.buildingId)) { this.debugGraphics.fillRect(ox + plot.x * TILE, oy + plot.y * TILE, plot.width * TILE, plot.height * TILE); this.debugGraphics.strokeRect(ox + plot.x * TILE, oy + plot.y * TILE, plot.width * TILE, plot.height * TILE); }
        this.debugGraphics.lineStyle(2, 0x38d9ff, .95);
        for (const plot of view.plots) for (const entrance of plot.entrances ?? []) { const area = entrance.interactionArea; this.debugGraphics.strokeRect(ox + area.x * TILE, oy + area.y * TILE, area.width * TILE, area.height * TILE); }
        this.debugGraphics.fillStyle(0xffffff, 1); this.debugGraphics.fillCircle(ox + controller.x * TILE, oy + controller.y * TILE, 7);
      }
      const night = view.phase === '深夜' || view.phase === '夜晚'; this.nightOverlay.setVisible(night).setFillStyle(0x233052, view.phase === '深夜' ? .32 : .2);
    } else { this.ground?.setVisible(false); this.nightOverlay.setVisible(false); for (const image of [...this.buildings.values(), ...this.foregrounds.values(), ...this.actors.values(), ...this.actorNames.values()]) image.setVisible(false); this.playerSprite.setVisible(false); this.playerName.setVisible(false); }
    for (let i = this.labelIndex; i < this.labels.length; i++) this.labels[i].setVisible(false);
  }
}

declare const GameGlobal: { __fjhyWechatCanvas: HTMLCanvasElement };
const visibleCanvas = GameGlobal.__fjhyWechatCanvas;
installWeChatTouchMoveBridge();
new Phaser.Game({ type: Phaser.CANVAS, customEnvironment: true, canvas: visibleCanvas, width: WIDTH, height: HEIGHT, parent: null, expandParent: false, backgroundColor: '#b7cba5', scene: [BaishiWechatScene], scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.NO_CENTER } });
