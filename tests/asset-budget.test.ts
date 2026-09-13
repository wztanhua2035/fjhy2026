import test from 'node:test';
import assert from 'node:assert/strict';
import { assertAssetBudget, assetBudgets } from '../tools/asset-budget.js';
import { remoteAsset } from '../packages/client-runtime/remote-assets.js';

test('release budget warns above target and blocks unapproved hard-limit violations', () => {
  const entry = remoteAsset('BAISHI_INTERIOR_SALON_BG');
  const warnings: string[] = [];
  assertAssetBudget(entry, assetBudgets['scene-background'].target + 1, message => warnings.push(message));
  assert.equal(warnings.length, 1);
  assert.throws(() => assertAssetBudget(entry, assetBudgets['scene-background'].hard + 1, () => {}), /hard size limit/);
  assertAssetBudget({ ...entry, sizeBudgetOverride: { reason: 'Exceptional approved hero scene' } }, assetBudgets['scene-background'].hard + 1, () => {});
  assert.throws(() => assertAssetBudget({ ...entry, sizeBudgetOverride: { reason: ' ' } }, assetBudgets['scene-background'].hard + 1, () => {}), /hard size limit/);
});
