/**
 * test_fine_monetization.mjs
 * Simula o webhook de multas para verificar se o chargeback (financeiro) é criado.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
    console.log("🚀 Iniciando teste de faturamento de multas...");

    // 1. Pegar um veículo locado para o teste
    const { data: vehicle, error: vErr } = await supabase
        .from('vehicles')
        .select('id, plate')
        .eq('status', 'locado')
        .limit(1)
        .single();

    if (vErr || !vehicle) {
        console.error("❌ Erro: Nenhum veículo locado encontrado para o teste.");
        return;
    }

    console.log(`🚗 Usando veículo: ${vehicle.plate} (${vehicle.id})`);

    // 2. Chamar a Edge Function fines-webhook
    const payload = {
        vehicle_id: vehicle.id,
        infraction_date: new Date().toISOString(),
        amount: 150.00,
        description: "TESTE DE MONETIZAÇÃO BENNY",
        due_date: "2026-04-10"
    };

    console.log("📡 Chamando fines-webhook via fetch...");

    const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/fines-webhook`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'x-webhook-secret': process.env.FINES_WEBHOOK_SECRET
        },
        body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
        console.error("❌ Erro no webhook:", data);
        return;
    }

    console.log("✅ Resposta do Webhook:", data);

    if (data.chargeback_created) {
        console.log(`💰 SUCESSO! Chargeback criado: ID ${data.chargeback_id} no valor de R$ ${data.total_charged}`);
    } else {
        console.warn("⚠️ Webhook respondeu OK, mas o chargeback não foi criado. Verifique se o veículo tem um locatário vinculado.");
    }
}

test();
