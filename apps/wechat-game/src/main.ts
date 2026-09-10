import Phaser from 'phaser';
import { GameController, drawAppearance, formatQuestTracker, ImageAssetStore, type Direction, type Painter } from '../../../packages/client-runtime/index.js';
import type { Appearance } from '../../../packages/shared-types/index.js';
import { createWeChatPlatform, safeInsets } from './wechat-platform';

declare const __WECHAT_API_BASE_URL__: string;
const WIDTH = 960, HEIGHT = 540, TILE = 32, groundKey = 'baishi-ground';
const platform = createWeChatPlatform(__WECHAT_API_BASE_URL__);
const controller = new GameController(platform.transport);
const imageAssets = new ImageAssetStore();
type Draft = { gender: 'MALE' | 'FEMALE'; base: number; skin: string; hair: string; top: string; bottom: string; direction: Direction };
const draft: Draft = { gender: 'FEMALE', base: 1, skin: 'SKIN_LIGHT', hair: 'INK', top: 'SAGE', bottom: 'CREAM', direction: 'down' };
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
function appearance(): Appearance { return { gender: draft.gender, baseAvatarId: `${draft.gender}_${String(draft.base).padStart(2, '0')}`, skinColorId: draft.skin, hairStyleId: `HAIR_${draft.gender}_01`, topStyleId: `TOP_${draft.gender}_01`, bottomStyleId: `BOTTOM_${draft.gender}_01`, shoesId: `SHOES_${draft.gender}_01`, hairColorId: draft.hair, topColorId: draft.top, bottomColorId: draft.bottom, accessoryIds: [] }; }
class BaishiWechatScene extends Phaser.Scene {
  private graphics!: Phaser.GameObjects.Graphics;
  private ground?: Phaser.GameObjects.Image;
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
  private move = { x: 0, y: 0 };
  private stickBase!: Phaser.GameObjects.Arc;
  private stick!: Phaser.GameObjects.Arc;
  private fps = 0;
  private fpsElapsed = 0;
  private fpsFrames = 0;
  constructor() { super('baishi-wechat'); }
  create() {
    this.graphics = this.add.graphics().setDepth(10);
    const insets = safeInsets(WIDTH, HEIGHT);
    this.hud = this.add.text(insets.left + 18, insets.top + 14, '', { fontFamily: 'Arial', fontSize: '17px', color: '#ffffff', stroke: '#26352d', strokeThickness: 3, lineSpacing: 5 }).setDepth(50);
    this.message = this.add.text(WIDTH / 2, HEIGHT - insets.bottom - 116, '', { fontFamily: 'Microsoft YaHei, Arial', fontSize: '18px', color: '#ffffff', align: 'center', stroke: '#26352d', strokeThickness: 3, wordWrap: { width: 560 }, lineSpacing: 4 }).setOrigin(.5, 1).setDepth(50);
    this.frame = this.add.text(WIDTH - insets.right - 12, insets.top + 12, '', { fontFamily: 'Arial', fontSize: '14px', color: '#edf3d7', stroke: '#26352d', strokeThickness: 3 }).setOrigin(1, 0).setDepth(50);
    this.questToggle = this.button(WIDTH - insets.right - 62, insets.top + 54, 100, '任务 ▲', () => { this.questCollapsed = !this.questCollapsed; this.syncQuestPanel(); });
    this.questPanel = this.add.text(WIDTH - insets.right - 12, insets.top + 82, '', { fontFamily: 'Microsoft YaHei, Arial', fontSize: '15px', color: '#385446', backgroundColor: '#fffef0', padding: { left: 14, right: 14, top: 12, bottom: 12 }, fixedWidth: 330, wordWrap: { width: 302 }, lineSpacing: 5 }).setOrigin(1, 0).setDepth(59);
    this.primary = this.button(WIDTH - insets.right - 92, HEIGHT - insets.bottom - 80, 72, '互动', () => void this.run(() => controller.interact()));
    this.shopBackdrop = this.add.rectangle(492, 224, 388, 70, 0xfff9e9, .96).setOrigin(0).setStrokeStyle(2, 0xa8794f).setDepth(57).setVisible(false);
    this.shopTitle = this.add.text(510, 238, '', { fontFamily: 'Microsoft YaHei, Arial', fontSize: '18px', color: '#fef9ec', backgroundColor: '#7a9a77', fixedWidth: 350, padding: { left: 12, right: 12, top: 8, bottom: 8 } }).setDepth(58).setVisible(false);
    this.shopBalance = this.add.text(855, 246, '', { fontFamily: 'Microsoft YaHei, Arial', fontSize: '13px', color: '#fffdf3' }).setOrigin(1, 0).setDepth(59).setVisible(false);
    this.shopFeedback = this.add.text(510, 0, '', { fontFamily: 'Microsoft YaHei, Arial', fontSize: '12px', color: '#7a6046', wordWrap: { width: 350 }, lineSpacing: 3 }).setDepth(59).setVisible(false);
    const baseX = insets.left + 86, baseY = HEIGHT - insets.bottom - 88;
    this.stickBase = this.add.circle(baseX, baseY, 50, 0x24342d, .38).setDepth(55).setInteractive();
    this.stick = this.add.circle(baseX, baseY, 21, 0xd7e7cf, .62).setDepth(56);
    this.stickBase.on('pointerdown', (p: Phaser.Input.Pointer) => this.setStick(p));
    this.stickBase.on('pointermove', (p: Phaser.Input.Pointer) => { if (p.isDown) this.setStick(p); });
    this.input.on('pointerup', () => this.clearStick());
    platform.onLifecycle(state => { if (state === 'hide') this.clearStick(); });
    controller.onChange = () => this.syncUi();
    void this.loginPreview();
  }
  private async loginPreview() {
    try {
      // The staging test environment intentionally uses the existing development account route.
      // Production WeChat login stays outside this acceptance task.
      let account = platform.readLocal('fjhy.wechatPreviewAccount');
      if (!account) { account = 'wechat-preview-' + Date.now().toString(36); platform.writeLocal('fjhy.wechatPreviewAccount', account); }
      await controller.loginDev(account);
      this.syncUi();
    } catch (error: any) { controller.message = `连接测试服务失败：${error.message ?? '未知错误'}`; this.syncUi(); }
  }
  private button(x: number, y: number, width: number, text: string, action: () => void) {
    const button = this.add.text(x, y, text, { fontFamily: 'Arial', fontSize: '19px', color: '#ffffff', backgroundColor: '#39775f', padding: { left: 12, right: 12, top: 10, bottom: 10 }, align: 'center', fixedWidth: width }).setOrigin(.5).setDepth(60).setInteractive({ useHandCursor: true });
    button.on('pointerdown', action); return button;
  }
  private setStick(pointer: Phaser.Input.Pointer) {
    const dx = pointer.x - this.stickBase.x, dy = pointer.y - this.stickBase.y, length = Math.hypot(dx, dy) || 1, scale = Math.min(32 / length, 1);
    this.stick.setPosition(this.stickBase.x + dx * scale, this.stickBase.y + dy * scale);
    this.move = { x: dx / length, y: dy / length };
  }
  private clearStick() { this.move = { x: 0, y: 0 }; if (this.stick) this.stick.setPosition(this.stickBase.x, this.stickBase.y); }
  private async run(action: () => Promise<unknown>) { try { await action(); } catch (error: any) { controller.message = error.message ?? '操作失败'; } this.syncUi(); }
  private createPreviewPlayer() {
    // The currently deployed staging API predates skinColorId; it defaults to SKIN_LIGHT.
    return controller.write('/v1/player/appearance/create', { gender: draft.gender, baseAvatarId: appearance().baseAvatarId, hairColorId: draft.hair, topColorId: draft.top, bottomColorId: draft.bottom });
  }
  private syncUi() {
    const player = controller.player; const hasPlayer = !!player?.appearance;
    const isShop = !!controller.shopPanel() && !!controller.view?.npcs.some(n => Math.hypot(n.x - controller.x, n.y - controller.y) < 6);
    if (controller.boot && !hasPlayer) { this.message.setText('选择一个初始形象，然后开始白石街测试。'); this.primary.setText('开始'); this.primary.setVisible(true); this.primary.removeAllListeners('pointerdown').on('pointerdown', () => void this.run(() => this.createPreviewPlayer())); }
    else { this.primary.removeAllListeners('pointerdown').on('pointerdown', () => void this.run(() => controller.interact())); this.primary.setText(controller.nearby()?.label?.replace(/^进入/, '进 ') ?? '互动'); this.primary.setVisible(hasPlayer && !isShop); }
    this.hud.setText(hasPlayer ? `${controller.view?.scene.name ?? '横阳'} · ${player!.cash} 文` : '富甲横阳 · 白石街真机体验');
    this.message.setText(controller.message || '');
    this.questToggle.setVisible(hasPlayer);
    this.syncQuestPanel();
    this.syncShopPanel();
  }
  private syncQuestPanel() { const task = controller.questTracker()[0]; this.questToggle?.setText(`任务 ${this.questCollapsed ? '▼' : '▲'}`); this.questPanel?.setText(task ? formatQuestTracker(task) : '暂无进行中的任务').setVisible(!!controller.player?.appearance && !this.questCollapsed); }
  private ensureShopRows(count: number) { while (this.shopRows.length < count) { const icon = this.add.text(512, 0, '', { fontFamily: 'Microsoft YaHei, Arial', fontSize: '18px', color: '#6a472c', backgroundColor: '#f1d58d', fixedWidth: 34, fixedHeight: 34, align: 'center', padding: { top: 6 } }).setDepth(59); const title = this.add.text(555, 0, '', { fontFamily: 'Microsoft YaHei, Arial', fontSize: '15px', color: '#4c392b' }).setDepth(59); const detail = this.add.text(555, 0, '', { fontFamily: 'Microsoft YaHei, Arial', fontSize: '11px', color: '#806f5c' }).setDepth(59); const buy = this.button(774, 0, 76, '买入', () => {}); const sell = this.button(850, 0, 76, '出售', () => {}); this.shopRows.push({ icon, title, detail, buy, sell }); } }
  private syncShopPanel() { const shop = controller.shopPanel(), nearClerk = !!controller.view?.npcs.some(n => Math.hypot(n.x - controller.x, n.y - controller.y) < 6), visible = !!shop && nearClerk; this.shopBackdrop.setVisible(visible); this.shopTitle.setVisible(visible); this.shopBalance.setVisible(visible); this.shopFeedback.setVisible(visible); for (const row of this.shopRows) Object.values(row).forEach(node => node.setVisible(false)); if (!shop || !visible) return; const height = 62 + shop.items.length * 64 + 34; this.shopBackdrop.setSize(388, height); this.shopTitle.setText(`  ${shop.title}`); this.shopBalance.setText(`铜钱 ${shop.balance} 文`); this.shopFeedback.setPosition(510, 224 + height - 28).setText(controller.message || ''); this.ensureShopRows(shop.items.length); shop.items.forEach((item, index) => { const row = this.shopRows[index], y = 286 + index * 64; row.icon.setPosition(512, y).setText(item.icon).setVisible(true); row.title.setPosition(555, y).setText(item.name).setVisible(true); row.detail.setPosition(555, y + 24).setText(`持有 ×${item.owned}　买入 ${item.buyPrice} 文　卖出 ${item.sellPrice} 文`).setVisible(true); row.buy.setPosition(774, y + 18).setText(`买入 ${item.buyPrice}`).setVisible(true).setInteractive(); row.sell.setPosition(850, y + 18).setText(`出售 ${item.sellPrice}`).setVisible(true).setInteractive(); row.buy.removeAllListeners('pointerdown').on('pointerdown', () => void this.run(() => controller.trade('buy', item.id))); row.sell.removeAllListeners('pointerdown').on('pointerdown', () => void this.run(() => controller.trade('sell', item.id))); }); }
  update(_: number, delta: number) {
    this.fpsElapsed += delta; this.fpsFrames++; if (this.fpsElapsed >= 500) { this.fps = Math.round(this.fpsFrames * 1000 / this.fpsElapsed); this.fpsElapsed = 0; this.fpsFrames = 0; }
    controller.tick(Math.min(delta / 1000, .05), this.move.x, this.move.y);
    this.frame.setText(`${this.fps} FPS`);
    this.render();
  }
  private render() {
    const view = controller.view; this.graphics.clear(); this.labelIndex = 0;
    const painter: Painter = {
      rect: (x, y, w, h, fill) => { const c = color(fill); this.graphics.fillStyle(c.value, c.alpha); this.graphics.fillRect(x, y, w, h); },
      circle: (x, y, r, fill) => { const c = color(fill); this.graphics.fillStyle(c.value, c.alpha); this.graphics.fillCircle(x, y, r); },
      text: (value, x, y, size, fill) => { let label = this.labels[this.labelIndex++]; if (!label) { label = this.add.text(0, 0, '', { fontFamily: 'Microsoft YaHei, Arial', fontSize: size, color: '#ffffff', stroke: '#23352b', strokeThickness: 1 }).setOrigin(.5).setDepth(20); this.labels.push(label); } label.setText(value).setPosition(x, y).setFontSize(size).setColor(fill).setVisible(true); },
    };
    if (controller.boot && !controller.player?.appearance) { this.ground?.setVisible(false); drawAppearance(painter, appearance(), controller.boot.colors, WIDTH / 2, HEIGHT / 2, 4, draft.direction, controller.walkTime); }
    else if (view) {
      if (this.ground) { const ox = WIDTH / 2 - controller.x * TILE, oy = HEIGHT / 2 - controller.y * TILE; this.ground.setVisible(view.scene.id === 'STREET_BAISHI_01').setPosition(ox, oy); }
      controller.render(painter, WIDTH, HEIGHT, !this.ground, !this.ground, true);
    } else this.ground?.setVisible(false);
    for (let i = this.labelIndex; i < this.labels.length; i++) this.labels[i].setVisible(false);
  }
}

declare const GameGlobal: { __fjhyWechatCanvas: HTMLCanvasElement };
const visibleCanvas = GameGlobal.__fjhyWechatCanvas;
installWeChatTouchMoveBridge();
new Phaser.Game({ type: Phaser.CANVAS, customEnvironment: true, canvas: visibleCanvas, width: WIDTH, height: HEIGHT, parent: null, expandParent: false, backgroundColor: '#b7cba5', scene: [BaishiWechatScene], scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.NO_CENTER } });
