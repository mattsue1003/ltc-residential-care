/* 預算自動斷電：費用超過預算時，自動把這個專案從付費帳戶解除連結，停止扣款。
   依 Google 官方做法「以預算通知停用帳單」。資料不會被刪除；主任查明原因後可在主控台重新連結。 */
const { onMessagePublished } = require('firebase-functions/v2/pubsub');
const logger = require('firebase-functions/logger');

function shouldCap(msg) {
  if (!msg || typeof msg.costAmount !== 'number' || typeof msg.budgetAmount !== 'number') return false;
  return msg.costAmount >= msg.budgetAmount;
}

exports.capBilling = onMessagePublished({ topic: 'billing-alerts', region: 'asia-east1', retry: false, maxInstances: 1 }, async (event) => {
  const msg = event.data.message.json;
  logger.info('預算通知', { cost: msg && msg.costAmount, budget: msg && msg.budgetAmount, currency: msg && msg.currencyCode });
  if (!shouldCap(msg)) return;
  const { CloudBillingClient } = require('@google-cloud/billing');
  const billing = new CloudBillingClient();
  const projectId = process.env.GCLOUD_PROJECT || JSON.parse(process.env.FIREBASE_CONFIG || '{}').projectId;
  const name = `projects/${projectId}`;
  const [info] = await billing.getProjectBillingInfo({ name });
  if (!info.billingEnabled) { logger.info('付費功能已是關閉狀態'); return; }
  if (process.env.DRY_RUN === '1') { logger.warn('DRY_RUN：達到預算，但測試模式不關閉'); return; }
  await billing.updateProjectBillingInfo({ name, projectBillingInfo: { billingAccountName: '' } });
  logger.error(`費用 ${msg.costAmount} ${msg.currencyCode} 已達預算 ${msg.budgetAmount}，已自動關閉付費功能`);
});

exports._shouldCap = shouldCap;
