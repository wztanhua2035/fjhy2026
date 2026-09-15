import Phaser from 'phaser';
import { paginateDialogue, mobileDialogueBounds, PORTRAIT_DEPTH } from '../../../packages/client-runtime/index.js';
import { mobileTypography } from './typography.js';
import { uiTokens, speakerKind, speakerName } from '../../../packages/client-runtime/ui-design-tokens.js';

export class MobileDialogueUi {
  private background: Phaser.GameObjects.Rectangle;
  private innerBorder: Phaser.GameObjects.Rectangle;
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
    this.background = scene.add.rectangle(left, top, boxWidth, boxHeight, Number.parseInt(uiTokens.colors.dialoguePanel.slice(1), 16), .97)
      .setOrigin(0).setStrokeStyle(3, Number.parseInt(uiTokens.colors.accentSoft.slice(1), 16)).setDepth(PORTRAIT_DEPTH + 5).setVisible(false).setInteractive();
    this.background.on('pointerdown', advance);
    this.innerBorder = scene.add.rectangle(left + 7, top + 7, boxWidth - 14, boxHeight - 14, 0x000000, 0)
      .setOrigin(0).setStrokeStyle(1, 0xdcebe1, .48).setDepth(PORTRAIT_DEPTH + 5.5).setVisible(false);
    this.nameplate = scene.add.text(left + 24, top - 26, '', {
      fontFamily: 'Microsoft YaHei, Arial', fontStyle: 'bold', fontSize: `${mobileTypography.speaker}px`, color: uiTokens.colors.dialogueBody,
      backgroundColor: uiTokens.colors.speakerNpc, stroke: '#fff8e855', strokeThickness: 1, padding: { left: 16, right: 16, top: 7, bottom: 7 }
    }).setDepth(PORTRAIT_DEPTH + 6).setVisible(false).setInteractive();
    this.nameplate.on('pointerdown', advance);
    this.body = scene.add.text(left + 28, top + 22, '', {
      fontFamily: 'Microsoft YaHei, Arial', fontSize: `${mobileTypography.dialogue}px`, color: uiTokens.colors.dialogueBody,
      wordWrap: { width: boxWidth - 58 }, lineSpacing: 7
    }).setDepth(PORTRAIT_DEPTH + 6).setVisible(false).setInteractive();
    this.body.on('pointerdown', advance);
    this.continueHint = scene.add.text(right - 20, bottom - 12, '▼', {
      fontFamily: 'Arial', fontSize: '18px', color: uiTokens.colors.dialogueKeyword
    }).setOrigin(1, 1).setDepth(PORTRAIT_DEPTH + 6).setVisible(false);
  }

  sync(speaker: string, text: string, visible: boolean, formalName?: string) {
    const source = `${speaker}\0${text}`;
    if (visible && source !== this.source) { this.source = source; this.pages = paginateDialogue(text, this.charsPerLine); this.page = 0; }
    if (!visible) { this.source = ''; this.page = 0; }
    const kind = speakerKind(speaker);
    this.nameplate.setText(speakerName(speaker, formalName)).setBackgroundColor(uiTokens.colors[kind === 'player' ? 'speakerPlayer' : kind === 'npc' ? 'speakerNpc' : 'speakerNarrator']);
    this.body.setText(this.pages[this.page] ?? '');
    this.continueHint.setText(this.page + 1 < this.pages.length ? '▼ 继续' : '▼');
    for (const node of [this.background, this.innerBorder, this.nameplate, this.body, this.continueHint]) node.setVisible(visible);
  }

  advance(): boolean {
    if (this.page + 1 >= this.pages.length) return false;
    this.page++;
    this.body.setText(this.pages[this.page]);
    this.continueHint.setText(this.page + 1 < this.pages.length ? '▼ 继续' : '▼');
    return true;
  }
}
