'use strict';

/**
 * Seed de dados de teste para o FrotaApp.
 * Cria um usuário de teste no Supabase Auth e popula todas as tabelas.
 *
 * Uso: node execution/seed_test_data.js
 * Login no painel: teste@frotaapp.com / Frota@2026
 */

require('dotenv').config({ path: '.env' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const TEST_EMAIL    = 'teste@frotaapp.com';
const TEST_PASSWORD = 'Frota@2026';

async function run() {
  // ── 1. Usuário de teste ─────────────────────────────────────────────────
  console.log('[ 1/6 ] Criando usuário de teste...');

  let userId;
  const { data: existing } = await supabase.auth.admin.listUsers();
  const found = existing?.users?.find(u => u.email === TEST_EMAIL);

  if (found) {
    userId = found.id;
    console.log(`       Usuário já existe: ${userId}`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: TEST_EMAIL, password: TEST_PASSWORD, email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`       Usuário criado: ${userId}`);
  }

  // ── 2. Client ───────────────────────────────────────────────────────────
  console.log('[ 2/6 ] Inserindo client...');
  await supabase.from('clients').upsert(
    { id: userId, name: 'João Frota', email: TEST_EMAIL },
    { onConflict: 'id' }
  );

  // ── 3. Veículos ─────────────────────────────────────────────────────────
  console.log('[ 3/6 ] Inserindo veículos...');

  // Idempotência: limpa dados anteriores deste client de teste
  await supabase.from('maintenance').delete().eq('client_id', userId);
  await supabase.from('payments').delete().eq('client_id', userId);
  await supabase.from('tenants').delete().eq('client_id', userId);
  await supabase.from('vehicles').delete().eq('client_id', userId);

  const { data: vehicles, error: vErr } = await supabase
    .from('vehicles')
    .insert([
      {
        client_id: userId, type: 'car', brand: 'Toyota', model: 'Corolla',
        year: 2022, plate: 'ABC-1234', color: 'Prata', km: 42300,
        fuel_level: 75, tire_condition: 'Bom', status: 'locado',
        rent_weekly: 700, docs_ipva: '2027-01-31', docs_seguro: '2026-06-15',
        docs_revisao: '2026-09-01', fines: null, dents: 'Pequeno amassado traseiro',
      },
      {
        client_id: userId, type: 'car', brand: 'Honda', model: 'Civic',
        year: 2021, plate: 'DEF-5678', color: 'Preto', km: 61000,
        fuel_level: 40, tire_condition: 'Regular', status: 'locado',
        rent_weekly: 650, docs_ipva: '2027-01-31', docs_seguro: '2026-03-10',
        docs_revisao: '2026-04-20',
      },
      {
        client_id: userId, type: 'moto', brand: 'Honda', model: 'CG 160',
        year: 2023, plate: 'GHI-9012', color: 'Vermelho', km: 18200,
        fuel_level: 90, tire_condition: 'Ótimo', status: 'disponivel',
        rent_weekly: 350, docs_ipva: '2027-01-31', docs_seguro: '2026-12-01',
        docs_revisao: '2026-11-15',
      },
      {
        client_id: userId, type: 'car', brand: 'Volkswagen', model: 'Polo',
        year: 2020, plate: 'JKL-3456', color: 'Branco', km: 88500,
        fuel_level: 20, tire_condition: 'Desgastado', status: 'manutencao',
        rent_weekly: 500, docs_ipva: '2027-01-31', docs_seguro: '2025-11-30',
        docs_revisao: '2025-12-01', notes: 'Troca de pneus agendada',
      },
    ])
    .select('id, plate');

  if (vErr) throw vErr;
  const [v1, v2, v3, v4] = vehicles;

  // ── 4. Locatários ───────────────────────────────────────────────────────
  console.log('[ 4/6 ] Inserindo locatários...');
  const { data: tenants, error: tErr } = await supabase
    .from('tenants')
    .upsert([
      {
        client_id: userId, vehicle_id: v1.id,
        name: 'Carlos Silva', cpf: '123.456.789-00', rg: '12.345.678-9',
        birth_date: '1990-05-15', phone: '(11) 99999-1111',
        email: 'carlos@email.com', cnh: '01234567890',
        cnh_expiry: '2027-08-20', cnh_category: 'B',
        app_used: 'Uber', address: 'Rua das Flores, 123 - SP',
        emergency_contact: 'Maria Silva (11) 98888-0000',
        rent_weekly: 700, deposits: 1400, status: 'ativo', blacklisted: false,
      },
      {
        client_id: userId, vehicle_id: v2.id,
        name: 'Fernanda Oliveira', cpf: '987.654.321-00', rg: '98.765.432-1',
        birth_date: '1988-11-02', phone: '(11) 99999-2222',
        email: 'fernanda@email.com', cnh: '09876543210',
        cnh_expiry: '2026-02-28', cnh_category: 'B',
        app_used: '99', address: 'Av. Paulista, 456 - SP',
        emergency_contact: 'Roberto Oliveira (11) 97777-0000',
        rent_weekly: 650, deposits: 1300, status: 'ativo', blacklisted: false,
      },
      {
        client_id: userId, vehicle_id: null,
        name: 'Roberto Santos', cpf: '111.222.333-44', rg: '11.222.333-4',
        birth_date: '1995-03-22', phone: '(11) 99999-3333',
        email: 'roberto@email.com', cnh: '11122233344',
        cnh_expiry: '2028-03-22', cnh_category: 'A',
        app_used: 'iFood Entregador', address: 'Rua do Comércio, 789 - SP',
        rent_weekly: 350, deposits: 700, status: 'ativo', blacklisted: false,
      },
      {
        client_id: userId, vehicle_id: null,
        name: 'Marcos Ferreira', cpf: '555.666.777-88', rg: '55.666.777-8',
        birth_date: '1985-07-10', phone: '(11) 99999-4444',
        email: 'marcos@email.com', cnh: '55566677788',
        cnh_expiry: '2025-01-15', cnh_category: 'B',
        app_used: 'Uber', status: 'encerrado', blacklisted: true,
        rent_weekly: 600, deposits: 0,
        emergency_contact: 'Ana Ferreira (11) 96666-0000',
      },
    ])
    .select('id, name');

  if (tErr) throw tErr;
  const [t1, t2, t3, t4] = tenants;

  // ── 5. Pagamentos ───────────────────────────────────────────────────────
  console.log('[ 5/6 ] Inserindo pagamentos...');
  const { error: pErr } = await supabase.from('payments').insert([
    // Carlos - 3 semanas
    { client_id: userId, tenant_id: t1.id, week_label: 'Sem 1 - Fev/26', due_date: '2026-02-03', paid_date: '2026-02-03', value_amount: 700, paid_status: true,  payment_method: 'Pix' },
    { client_id: userId, tenant_id: t1.id, week_label: 'Sem 2 - Fev/26', due_date: '2026-02-10', paid_date: '2026-02-11', value_amount: 700, paid_status: true,  payment_method: 'Pix' },
    { client_id: userId, tenant_id: t1.id, week_label: 'Sem 3 - Fev/26', due_date: '2026-02-17', paid_date: null,           value_amount: 700, paid_status: false, payment_method: null },
    { client_id: userId, tenant_id: t1.id, week_label: 'Sem 4 - Fev/26', due_date: '2026-02-24', paid_date: null,           value_amount: 700, paid_status: false, payment_method: null },
    // Fernanda - 2 semanas
    { client_id: userId, tenant_id: t2.id, week_label: 'Sem 1 - Fev/26', due_date: '2026-02-03', paid_date: '2026-02-04', value_amount: 650, paid_status: true,  payment_method: 'Transferência' },
    { client_id: userId, tenant_id: t2.id, week_label: 'Sem 2 - Fev/26', due_date: '2026-02-10', paid_date: null,           value_amount: 650, paid_status: false, payment_method: null },
    // Roberto - moto
    { client_id: userId, tenant_id: t3.id, week_label: 'Sem 1 - Mar/26', due_date: '2026-03-03', paid_date: null,           value_amount: 350, paid_status: false, payment_method: null },
  ]);
  if (pErr) throw pErr;

  // ── 6. Manutenção ────────────────────────────────────────────────────────
  console.log('[ 6/6 ] Inserindo manutenções...');
  const { error: mErr } = await supabase.from('maintenance').insert([
    { client_id: userId, vehicle_id: v4.id, event_type: 'schedule', category: 'Pneu',      date: '2026-03-10', description: 'Troca dos 4 pneus desgastados', value_amount: 1200, done: false },
    { client_id: userId, vehicle_id: v2.id, event_type: 'schedule', category: 'Revisão',   date: '2026-04-20', description: 'Revisão 60.000 km', value_amount: 450, done: false },
    { client_id: userId, vehicle_id: v1.id, event_type: 'expense',  category: 'Manutenção',date: '2026-01-15', description: 'Troca de óleo e filtros', value_amount: 280, done: true },
    { client_id: userId, vehicle_id: v3.id, event_type: 'expense',  category: 'Manutenção',date: '2026-02-20', description: 'Limpeza de carburador', value_amount: 150, done: true },
    { client_id: userId, vehicle_id: v2.id, event_type: 'expense',  category: 'Seguro',    date: '2025-11-30', description: 'Renovação do seguro - Honda Civic', value_amount: 2800, done: true },
    { client_id: userId, vehicle_id: v4.id, event_type: 'expense',  category: 'Multa',     date: '2026-01-08', description: 'Multa velocidade - Rod. Anhanguera', value_amount: 293.47, done: true },
  ]);
  if (mErr) throw mErr;

  console.log('\n✓ Seed concluído!');
  console.log(`\n  Login no painel:`);
  console.log(`  E-mail : ${TEST_EMAIL}`);
  console.log(`  Senha  : ${TEST_PASSWORD}`);
  console.log(`\n  URL    : http://localhost:5173\n`);
}

run().catch(err => { console.error('\n✗ Erro:', err.message); process.exit(1); });
