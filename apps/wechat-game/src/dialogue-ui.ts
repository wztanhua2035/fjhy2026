import Phaser from 'phaser';
import { paginateDialogue, mobileDialogueBounds, PORTRAIT_DEPTH } from '../../../packages/client-runtime/index.js';
import { mobileTypography } from './typography.js';

export class MobileDialogueUi {
  private background: Phaser.GameObjects.Rectangle;
  private nameplate: Phaser.GameObjects.Text;
  private body: Phaser.GameObjects.Text;
  private continueHint: Phaser.GameObjects.Text;
  private pages: string[] = [];
  private page = 0;
  private source = '';
  private charsPerLine: number;

  constructor(scene: Phaser.Scene, width: number, height: number, insets: { left: number; right: number; bottom: number }, advance: () => void) {
    const { left, right, top, bottom, width: boxWidth, height: boxHeight } = mobileDialogueBounds(width, height, insets);
    this.charsPerLine = Math.max(12, Math.floor((boxWidth - 56) / mobileTypography.dialogue));
    this.background = scene.add.rectangle(left, top, boxWidth, boxHeight, 0xfff5df, .96)
      .setOrigin(0).setStrokeStyle(2, 0x657a64).setDepth(PORTRAIT_DEPTH + 5).setVisible(false).setInteractive();
    this.background.on('pointerdown', advance);
    this.nameplate = scene.add.text(left + 24, top - 26, '', {
      fontFamily: 'Microsoft YaHei, Arial', fontSize: `${mobileTypography.speaker}px`, color: '#fff9e8',
      backgroundColor: '#476753', padding: { left: 15, right: 15, top: 6, bottom: 6 }
    }).setDepth(PORTRAIT_DEPTH + 6).setVisible(false).setInteractive();
    this.nameplate.on('pointerdown', advance);
    this.body = scene.add.text(left + 28, top + 30, '', {
      fontFamily: 'Microsoft YaHei, Arial', fontSize: `${mobileTypography.dialogue}px`, color: '#3e4439',
      wordWrap: { width: boxWidth - 56 }, lineSpacing: 11
    }).setDepth(PORTRAIT_DEPTH + 6).setVisible(false).setInteractive();
    this.body.on('pointerdown', advance);
    this.continueHint = scene.add.text(right - 20, bottom - 12, '▼', {
      fontFamily: 'Arial', fontSize: '18px', color: '#55715b'
    }).setOrigin(1, 1).setDepth(PORTRAIT_DEPTH + 6).setVisible(false);
  }

  sync(speaker: string, text: string, visible: boolean) {
    const source = `${speaker}\0${text}`;
    if (visible && source !== this.source) { this.source = source; this.pages = paginateDialogue(text, this.charsPerLine); this.page = 0; }
    if (!visible) { this.source = ''; this.page = 0; }
    this.nameplate.setText(speaker);
    this.body.setText(this.pages[this.page] ?? '');
    for (const node of [this.background, this.nameplate, this.body, this.continueHint]) node.setVisible(visible);
  }

  advance(): boolean {
    if (this.page + 1 >= this.pages.length) return false;
    this.page++;
    this.body.setText(this.pages[this.page]);
    return true;
  }
}
