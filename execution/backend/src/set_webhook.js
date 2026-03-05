'use strict';

/**
 * Registra o webhook do bot no Telegram.
 * Execute uma única vez após deploy:
 *   node src/set_webhook.js
 *
 * Pré-requisitos no .env:
 *   TELEGRAM_BOT_TOKEN  – token do bot (@BotFather)
 *   WEBHOOK_SECRET      – string aleatória que compõe a URL secreta
 *   PUBLIC_URL          – URL pública HTTPS do servidor (ex: https://seudominio.com)
 */

require('dotenv').config({ path: '../../../.env' });

const REQUIRED = ['TELEGRAM_BOT_TOKEN', 'WEBHOOK_SECRET', 'PUBLIC_URL'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`[ERRO] Variável de ambiente ausente: ${key}`);
    process.exit(1);
  }
}

const webhookUrl = `${process.env.PUBLIC_URL}/webhook/${process.env.WEBHOOK_SECRET}`;

async function setWebhook() {
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`;
  const res  = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      url:              webhookUrl,
      allowed_updates:  ['message', 'callback_query'],
      drop_pending_updates: true,
    }),
  });

  const data = await res.json();

  if (data.ok) {
    console.log(`[OK] Webhook registrado em: ${webhookUrl}`);
  } else {
    console.error('[ERRO] Falha ao registrar webhook:', data);
    process.exit(1);
  }
}

setWebhook();
