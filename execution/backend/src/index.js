'use strict';

require('dotenv').config({ path: '../../../.env' });

const express = require('express');
const { createClient } = require('@supabase/supabase-js');

// ────────────────────────────────────────────
// Validação de variáveis de ambiente
// ────────────────────────────────────────────
const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TELEGRAM_BOT_TOKEN',
  'WEBHOOK_SECRET',
];

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[ERRO] Variável de ambiente ausente: ${key}`);
    process.exit(1);
  }
}

// ────────────────────────────────────────────
// Clientes
// ────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const app = express();
app.use(express.json());

// ────────────────────────────────────────────
// Rota de saúde
// ────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ────────────────────────────────────────────
// Webhook do Telegram
// POST /webhook/<WEBHOOK_SECRET>
//
// O Telegram envia updates para esta rota.
// Nunca usar polling (getUpdates) — proibido pela diretiva.
// ────────────────────────────────────────────
app.post(`/webhook/${process.env.WEBHOOK_SECRET}`, async (req, res) => {
  // Responde imediatamente para o Telegram não retentar
  res.sendStatus(200);

  const update = req.body;

  try {
    await handleUpdate(update);
  } catch (err) {
    console.error('[Webhook] Erro ao processar update:', err.message);
  }
});

// ────────────────────────────────────────────
// Dispatcher de updates
// ────────────────────────────────────────────
async function handleUpdate(update) {
  if (update.message) {
    await handleMessage(update.message);
  } else if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
  }
  // Outros tipos de update (inline_query, etc.) podem ser adicionados aqui
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const text   = message.text || '';

  console.log(`[Mensagem] chat_id=${chatId} text="${text}"`);

  if (text.startsWith('/start')) {
    await sendMessage(chatId, 'Olá! Bem-vindo ao FrotaApp. 🚗\nEnvie uma mensagem para começar.');
    return;
  }

  // TODO: encaminhar texto para o núcleo de IA (Gemini)
  await sendMessage(chatId, `Recebi: "${text}"\n(Integração com Gemini em breve)`);
}

async function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data   = callbackQuery.data;
  console.log(`[Callback] chat_id=${chatId} data="${data}"`);
  // TODO: processar callbacks de inline keyboards
}

// ────────────────────────────────────────────
// Utilitário: enviar mensagem via Telegram API
// ────────────────────────────────────────────
async function sendMessage(chatId, text, extra = {}) {
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res  = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text, ...extra }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram sendMessage falhou: ${body}`);
  }
}

// ────────────────────────────────────────────
// Inicialização do servidor
// ────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[FrotaApp Backend] Servidor rodando na porta ${PORT}`);
  console.log(`[FrotaApp Backend] Webhook disponível em POST /webhook/<SECRET>`);
  console.log(`[FrotaApp Backend] Para registrar o webhook no Telegram, execute:`);
  console.log(`  node src/set_webhook.js`);
});

module.exports = { app, supabase };
