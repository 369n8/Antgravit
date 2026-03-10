/**
 * AutomacaoIA — Motor IA + Gestão Semanal
 *
 * IMPORTANTE: O bot do Telegram é EXCLUSIVO para o DONO da frota.
 * Motoristas/locatários NÃO têm acesso ao bot. Toda comunicação com motoristas
 * ocorre pelo Portal do locatário (página Portal.jsx).
 * O campo `telegram_username` nos tenants serve apenas como dado de contato interno,
 * não como canal de comunicação automática.
 *
 * Design System: Lunara Elite
 *   Navy:   #102A57
 *   Violet: #5B58EC
 *   Cards:  white (#FFFFFF) / var(--surface)
 *   Font:   Helvetica Neue / system-ui
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { S, Sec, ptDate, fmt, weekRange, monthRange } from '../lib/shared';
import {
  Brain, Zap, Calendar, TrendingUp, Car, CheckCircle2, AlertCircle, Clock,
  Send, MessageCircle, Search, Plus, X, DollarSign, BarChart3, Play,
} from 'lucide-react';
import { api } from '../services/api';

// ── Constants ────────────────────────────────────────────────────────────────

const NAVY   = '#102A57';
const VIOLET = '#5B58EC';

const DAYS_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DAYS_KEY = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const PROVIDERS = [
  { id: 'mock',        label: 'Mock (Simulação)',  desc: 'Gera multas falsas para testar o fluxo.' },
  { id: 'infosimples', label: 'Infosimples',        desc: 'API nacional de consulta de infrações.' },
  { id: 'zapay',       label: 'Zapay',              desc: 'Plataforma de regularização veicular.' },
  { id: 'apibrasil',   label: 'API Brasil',         desc: 'Dados abertos + SINESP.' },
];

const AUTOMATIONS = [
  { time: '03:00',    icon: '🔍', title: 'Scanner de Multas',    desc: 'Varre todos os veículos da frota automaticamente',          color: '#7C3AED', bg: '#FAF5FF' },
  { time: '08:00',    icon: '🌅', title: 'Briefing Diário',      desc: 'Resumo completo: inadimplentes, multas, agenda do dia',     color: '#D97706', bg: '#FFFBEB' },
  { time: 'Contínuo', icon: '💰', title: 'Alertas de Fatura',    desc: 'Notifica faturas vencidas e próximas do vencimento',        color: '#DC2626', bg: '#FEF2F2' },
  { time: 'Contínuo', icon: '📋', title: 'Vistorias Pendentes',  desc: 'Avisa quando motorista envia vistoria para aprovar',        color: '#2563EB', bg: '#EFF6FF' },
  { time: 'Semanal',  icon: '🚗', title: 'Relatório Semanal',    desc: 'Consolida km, óleo e vídeos enviados pelos motoristas',     color: '#059669', bg: '#ECFDF5' },
];

// NOTA: Telegram é APENAS para o dono da frota, não para os motoristas.
const BOT_COMMANDS = [
  { cmd: '/resumo',        desc: 'Briefing completo: caixa, frota, pendências' },
  { cmd: '/inadimplentes', desc: 'Lista motoristas com fatura em atraso + valor' },
  { cmd: '/multas',        desc: 'Multas pendentes atribuídas a motoristas' },
  { cmd: '/vistorias',     desc: 'Vistorias enviadas aguardando sua aprovação' },
  { cmd: '/vencimentos',   desc: 'Seguros vencendo nos próximos 15 dias' },
  { cmd: '/semana',        desc: 'Agenda de pagamentos desta semana por dia' },
  { cmd: '/financeiro',    desc: 'Receita mensal e projeção anual da frota' },
  { cmd: '/checkins',      desc: 'Quem enviou o relatório semanal e quem não enviou' },
];

const OIL_LEVELS = [
  { value: 'ok',    label: 'OK — Nível normal',            color: '#16A34A', bg: '#DCFCE7' },
  { value: 'baixo', label: 'Baixo — Precisa completar',    color: '#D97706', bg: '#FEF9C3' },
  { value: 'trocar',label: 'Trocar — Urgente',             color: '#DC2626', bg: '#FEE2E2' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWeekStartISO() {
  const [mon] = weekRange();
  return mon.toISOString().slice(0, 10);
}

function getMonthISO() {
  const [start, end] = monthRange();
  return {
    start: start.toISOString().slice(0, 10),
    end:   end.toISOString().slice(0, 10),
  };
}

function oilBadge(level) {
  const found = OIL_LEVELS.find(o => o.value === level);
  if (!found) return null;
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
      background: found.bg, color: found.color, textTransform: 'uppercase',
    }}>
      {level === 'ok' ? 'ÓLEO OK' : level === 'baixo' ? 'ÓLEO BAIXO' : 'TROCAR ÓLEO'}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AutomacaoIA() {
  // ── Auth / base ──
  const [user,    setUser]    = useState(null);
  const [client,  setClient]  = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Fines scanner state ──
  const [settings,     setSettings]     = useState(null);
  const [form,         setForm]         = useState({ document: '', api_provider: 'mock', api_key: '', scan_enabled: true, notes: '' });
  const [recentFines,  setRecentFines]  = useState([]);
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [scanning,     setScanning]     = useState(false);
  const [scanResult,   setScanResult]   = useState(null);

  // ── Telegram state ──
  const [sending,            setSending]            = useState(false);
  const [sendResult,         setSendResult]         = useState(null);
  const [chatIdInput,        setChatIdInput]        = useState('');
  const [botTokenInput,      setBotTokenInput]      = useState('');
  const [savingChat,         setSavingChat]         = useState(false);
  const [registeringWebhook, setRegisteringWebhook] = useState(false);
  const [webhookResult,      setWebhookResult]      = useState(null);

  // ── AI log ──
  const [aiLogs, setAiLogs] = useState([]);

  // ── Gestão Semanal state ──
  const [weeklyChecks,  setWeeklyChecks]  = useState([]); // lista de checks da semana
  const [activeTenants, setActiveTenants] = useState([]); // todos os ativos para agenda
  // weeklyAgenda: { [dow: number]: [{id, name, rent_weekly, hasPaid}] }
  const [weeklyAgenda,  setWeeklyAgenda]  = useState({});
  const [financeiro,    setFinanceiro]    = useState({ weekRev: 0, monthRev: 0, yearProj: 0, overdue: 0 });

  // ── Check-in modal state ──
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [checkinForm,      setCheckinForm]      = useState({
    tenant_id: '',
    vehicle_id: '',
    current_km: '',
    oil_level: 'ok',
    notes: '',
    photo_url: '',
  });
  const [checkinSaving,  setCheckinSaving]  = useState(false);
  const [checkinError,   setCheckinError]   = useState('');
  const [tenantVehicles, setTenantVehicles] = useState([]);

  // ── Load ─────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) { setLoading(false); return; }
    setUser(u);

    const weekStart  = getWeekStartISO();
    const { start: monthStart, end: monthEnd } = getMonthISO();
    const today = new Date().toISOString().slice(0, 10);

    const [
      clientRes,
      settRes,
      finesRes,
      invRes,
      inspRes,
      tenantsRes,
      weeklyChecksRes,
      weekRevRes,
      monthRevRes,
      overdueRes,
      paidThisWeekRes,
    ] = await Promise.all([
      supabase.from('clients').select('id, company_name, telegram_username, telegram_chat_id, telegram_bot_token').eq('id', u.id).single(),
      supabase.from('fleet_settings').select('*').eq('client_id', u.id).maybeSingle(),
      supabase.from('fines')
        .select('id, amount, description, date, status, created_at, admin_fee, spread_profit, vehicles(plate, brand, model)')
        .eq('client_id', u.id).order('created_at', { ascending: false }).limit(8),
      supabase.from('invoices')
        .select('id, created_at, amount, week_label, tenants(name)')
        .eq('client_id', u.id).order('created_at', { ascending: false }).limit(5),
      supabase.from('weekly_inspections')
        .select('id, created_at, status, tenants(name)').order('created_at', { ascending: false }).limit(5),
      // Todos os locatários ativos com dia de pagamento e valor semanal
      supabase.from('tenants')
        .select('id, name, payment_day, rent_weekly, rent_amount, vehicles(id, plate)')
        .eq('client_id', u.id).eq('status', 'ativo').order('name'),
      // Checks semanais desta semana
      supabase.from('weekly_checks')
        .select('id, tenant_id, vehicle_id, current_km, oil_level, status, notes, submitted_at, photo_url, tenants(name), vehicles(plate)')
        .eq('client_id', u.id).gte('week_start', weekStart).order('submitted_at', { ascending: false }),
      // Receita desta semana
      supabase.from('invoices').select('amount').eq('client_id', u.id).eq('status', 'paid').gte('due_date', weekStart),
      // Receita deste mês
      supabase.from('invoices').select('amount').eq('client_id', u.id).eq('status', 'paid').gte('due_date', monthStart).lte('due_date', monthEnd),
      // Inadimplência: faturas em atraso não pagas
      supabase.from('invoices').select('amount').eq('client_id', u.id).in('status', ['pending', 'overdue']).lt('due_date', today),
      // Pagamentos feitos esta semana (para marcar "RECEBIDO" na agenda)
      supabase.from('invoices').select('tenant_id').eq('client_id', u.id).eq('status', 'paid').gte('due_date', weekStart),
    ]);

    // ── Client & settings ──
    if (clientRes.data) {
      setClient(clientRes.data);
      setChatIdInput(clientRes.data.telegram_chat_id ?? '');
      setBotTokenInput(clientRes.data.telegram_bot_token ?? '');
    }
    if (settRes.data) {
      setSettings(settRes.data);
      setForm({
        document:     settRes.data.document ?? '',
        api_provider: settRes.data.api_provider ?? 'mock',
        api_key:      settRes.data.api_key ?? '',
        scan_enabled: settRes.data.scan_enabled ?? true,
        notes:        settRes.data.notes ?? '',
      });
    }
    setRecentFines(finesRes.data ?? []);

    // ── AI Logs ──
    const logs = [
      ...(finesRes.data || []).map(f => ({
        date:   f.created_at || f.date,
        type:   'fine',
        icon:   '🚨',
        title:  'Multa Detectada',
        detail: `${f.vehicles?.plate}: R$ ${f.amount}${f.admin_fee ? ` (+ R$ ${f.admin_fee} taxa)` : ''}`,
        profit: (f.admin_fee || 0) + (f.spread_profit || 0),
      })),
      ...(invRes.data || []).map(i => ({
        date: i.created_at, type: 'invoice', icon: '💰', title: 'Fatura Gerada',
        detail: `${i.tenants?.name}: ${i.week_label}`,
      })),
      ...(inspRes.data || []).map(ins => ({
        date: ins.created_at, type: 'inspection', icon: '📋', title: 'Vistoria Recebida',
        detail: `${ins.tenants?.name} enviou vistoria`,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);
    setAiLogs(logs);

    // ── Gestão Semanal ──
    const tenants = tenantsRes.data ?? [];
    setActiveTenants(tenants);
    setWeeklyChecks(weeklyChecksRes.data ?? []);

    // Monta agenda semanal agrupada por dia da semana (0-6)
    const paidSet = new Set((paidThisWeekRes.data ?? []).map(p => p.tenant_id));
    const agenda = {};
    for (const t of tenants) {
      const dow = t.payment_day ?? 1; // 1=segunda por padrão
      if (!agenda[dow]) agenda[dow] = [];
      agenda[dow].push({
        id:          t.id,
        name:        t.name,
        rent_weekly: Number(t.rent_weekly ?? t.rent_amount ?? 0),
        hasPaid:     paidSet.has(t.id),
        vehicles:    t.vehicles ?? [],
      });
    }
    setWeeklyAgenda(agenda);

    // ── Financeiro ──
    const weekRev  = (weekRevRes.data  ?? []).reduce((s, i) => s + Number(i.amount ?? 0), 0);
    const monthRev = (monthRevRes.data ?? []).reduce((s, i) => s + Number(i.amount ?? 0), 0);
    const overdue  = (overdueRes.data  ?? []).reduce((s, i) => s + Number(i.amount ?? 0), 0);
    const totalWeeklyRent = tenants.reduce((s, t) => s + Number(t.rent_weekly ?? t.rent_amount ?? 0), 0);
    const monthlyProj = totalWeeklyRent * 4.33;
    const yearProj    = monthlyProj * 12;
    setFinanceiro({ weekRev, monthRev, yearProj, overdue });

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── When tenant changes in checkin modal, load its vehicle ──
  useEffect(() => {
    if (!checkinForm.tenant_id) { setTenantVehicles([]); setCheckinForm(p => ({ ...p, vehicle_id: '' })); return; }
    const tenant = activeTenants.find(t => t.id === checkinForm.tenant_id);
    const vehs = Array.isArray(tenant?.vehicles) ? tenant.vehicles : (tenant?.vehicles ? [tenant.vehicles] : []);
    setTenantVehicles(vehs);
    setCheckinForm(p => ({ ...p, vehicle_id: vehs[0]?.id ?? '' }));
  }, [checkinForm.tenant_id, activeTenants]);

  // ── Actions ───────────────────────────────────────────────────────────────────

  const ff = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function handleSave() {
    setSaving(true); setSaved(false);
    const { data: { user: u } } = await supabase.auth.getUser();
    const { error } = await supabase.from('fleet_settings').upsert({
      client_id:    u.id,
      document:     form.document.trim() || null,
      api_provider: form.api_provider,
      api_key:      form.api_key.trim() || null,
      scan_enabled: form.scan_enabled,
      notes:        form.notes.trim() || null,
    }, { onConflict: 'client_id' });
    setSaving(false);
    if (error) { alert('Erro: ' + error.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    load();
  }

  async function handleSaveChat() {
    setSavingChat(true);
    const { data: { user: u } } = await supabase.auth.getUser();
    const updates = {
      telegram_chat_id:  chatIdInput.trim() || null,
      telegram_bot_token: botTokenInput.trim() || null,
    };
    const { error } = await supabase.from('clients').update(updates).eq('id', u.id);
    setSavingChat(false);
    if (error) { alert('Erro: ' + error.message); return; }
    setClient(prev => ({ ...prev, ...updates }));
  }

  async function handleRegisterWebhook() {
    const token = botTokenInput.trim();
    if (!token) { alert('Cole o Token do bot primeiro.'); return; }
    setRegisteringWebhook(true);
    setWebhookResult(null);
    try {
      // Supabase project ref extraído da URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
      const ref = supabaseUrl.replace('https://', '').split('.')[0];
      const webhookUrl = `https://${ref}.supabase.co/functions/v1/ai-manager-bot`;
      const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl }),
      });
      const data = await res.json();
      if (data.ok) {
        // Salva o token no banco após registrar com sucesso
        await handleSaveChat();
        setWebhookResult({ ok: true, url: webhookUrl });
      } else {
        setWebhookResult({ ok: false, error: data.description || 'Erro ao registrar webhook' });
      }
    } catch (err) {
      setWebhookResult({ ok: false, error: err.message });
    } finally {
      setRegisteringWebhook(false);
    }
  }

  async function handleScanNow() {
    setScanning(true); setScanResult(null);
    try {
      const data = await api.scanFines();
      setScanResult({ ok: true, data });
      load();
    } catch (err) {
      setScanResult({ ok: false, error: err.message });
    } finally {
      setScanning(false);
    }
  }

  async function handleSendBriefing() {
    setSending(true); setSendResult(null);
    try {
      await api.sendBriefing(user?.id);
      setSendResult({ ok: true });
    } catch (err) {
      setSendResult({ ok: false, error: err.message });
    } finally {
      setSending(false);
    }
  }

  async function handleSaveCheckin() {
    setCheckinSaving(true); setCheckinError('');
    if (!checkinForm.tenant_id) { setCheckinError('Selecione o motorista.'); setCheckinSaving(false); return; }
    if (!checkinForm.current_km) { setCheckinError('Informe o KM atual.'); setCheckinSaving(false); return; }

    const weekStart = getWeekStartISO();
    const { error } = await supabase.from('weekly_checks').insert({
      client_id:    user.id,
      tenant_id:    checkinForm.tenant_id,
      vehicle_id:   checkinForm.vehicle_id || null,
      week_start:   weekStart,
      current_km:   parseInt(checkinForm.current_km, 10),
      oil_level:    checkinForm.oil_level,
      notes:        checkinForm.notes.trim() || null,
      photo_url:    checkinForm.photo_url.trim() || null,
      status:       'submitted',
      submitted_at: new Date().toISOString(),
    });

    setCheckinSaving(false);
    if (error) { setCheckinError('Erro ao salvar: ' + error.message); return; }

    setShowCheckinModal(false);
    setCheckinForm({ tenant_id: '', vehicle_id: '', current_km: '', oil_level: 'ok', notes: '', photo_url: '' });
    load();
  }

  // ── Render guards ─────────────────────────────────────────────────────────────

  if (loading) return <div className="loading"><div className="spinner" /> Carregando...</div>;

  const botConnected      = !!client?.telegram_chat_id && !!client?.telegram_bot_token;
  const selectedProvider  = PROVIDERS.find(p => p.id === form.api_provider);
  const todayDow          = new Date().getDay();
  const weekStartFmt      = ptDate(getWeekStartISO());

  // Builds sets for quick lookup
  const submittedSet = new Set(weeklyChecks.map(c => c.tenant_id));
  const pendingTenants = activeTenants.filter(t => !submittedSet.has(t.id));

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="page" style={{ maxWidth: 1100 }}>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 1 — Hero + Telegram Status
          ══════════════════════════════════════════════════════════════ */}
      <div style={{
        background: `linear-gradient(135deg, ${NAVY} 0%, #1B3A6B 100%)`,
        borderRadius: 'var(--radius-lg)',
        padding: '32px 40px',
        marginBottom: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 20,
            background: botConnected ? VIOLET : 'rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'background 0.3s',
            boxShadow: botConnected ? `0 0 24px ${VIOLET}55` : 'none',
          }}>
            <Brain size={30} color={botConnected ? '#fff' : 'rgba(255,255,255,0.4)'} />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
              Motor IA + Gestão Semanal
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4, fontWeight: 500 }}>
              {botConnected
                ? 'Gerente de IA ativo · Monitorando 24/7 · Alertas automáticos ligados'
                : 'Conecte seu Telegram para ativar o gerente autônomo de frota'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
            borderRadius: 999,
            background: botConnected ? 'rgba(91,88,236,0.2)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${botConnected ? `${VIOLET}55` : 'rgba(255,255,255,0.1)'}`,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: botConnected ? '#4AC878' : '#6B7280',
              boxShadow: botConnected ? '0 0 8px #4AC878' : 'none',
            }} />
            <span style={{
              fontSize: 12, fontWeight: 700,
              color: botConnected ? '#4AC878' : 'rgba(255,255,255,0.4)',
              letterSpacing: '.04em',
            }}>
              {botConnected ? 'BOT ATIVO' : 'INATIVO'}
            </span>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 2 — Gestão Semanal
          ══════════════════════════════════════════════════════════════ */}

      {/* KPIs financeiros */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { icon: <DollarSign size={18} color={VIOLET} />, label: 'Receita Semanal',  value: `R$ ${fmt(financeiro.weekRev)}`,  bg: `${VIOLET}12`, border: `${VIOLET}30` },
          { icon: <BarChart3  size={18} color={NAVY}   />, label: 'Receita Mensal',   value: `R$ ${fmt(financeiro.monthRev)}`, bg: `${NAVY}12`,   border: `${NAVY}30`   },
          { icon: <TrendingUp size={18} color='#059669'/>, label: 'Projeção Anual',   value: `R$ ${fmt(financeiro.yearProj)}`, bg: '#05966912',   border: '#05966930'   },
          { icon: <AlertCircle size={18} color='#DC2626'/>, label: 'Inadimplência',  value: `R$ ${fmt(financeiro.overdue)}`,  bg: '#DC262612',   border: '#DC262630'   },
        ].map((kpi, i) => (
          <div key={i} style={{
            ...S.card,
            background: kpi.bg, border: `1px solid ${kpi.border}`,
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {kpi.icon}
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                {kpi.label}
              </span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>

        {/* ── Agenda Semanal de Pagamentos ── */}
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${VIOLET}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={18} color={VIOLET} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Agenda da Semana</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>Semana de {weekStartFmt}</div>
              </div>
            </div>
          </div>

          {Object.keys(weeklyAgenda).length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>
              Nenhum locatário ativo com pagamento configurado.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3, 4, 5, 6, 0].map(dow => {
                const motoristas = weeklyAgenda[dow];
                if (!motoristas?.length) return null;
                const dayTotal   = motoristas.reduce((s, m) => s + m.rent_weekly, 0);
                const isToday    = dow === todayDow;
                const allPaid    = motoristas.every(m => m.hasPaid);
                const somePaid   = motoristas.some(m => m.hasPaid);

                return (
                  <div key={dow} style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: isToday ? `${VIOLET}12` : 'var(--bg)',
                    border: `2px solid ${isToday ? VIOLET : 'transparent'}`,
                    transition: 'all 0.2s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: 12, fontWeight: 800,
                          color: isToday ? VIOLET : 'var(--muted)',
                          letterSpacing: '.04em',
                        }}>
                          {DAYS_PT[dow].toUpperCase()}
                          {isToday && <span style={{ marginLeft: 6, fontSize: 9, background: VIOLET, color: '#fff', padding: '1px 6px', borderRadius: 999 }}>HOJE</span>}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>R$ {fmt(dayTotal)}</span>
                        {allPaid && (
                          <span style={{ fontSize: 9, fontWeight: 800, background: '#DCFCE7', color: '#16A34A', padding: '2px 8px', borderRadius: 999 }}>RECEBIDO</span>
                        )}
                        {somePaid && !allPaid && (
                          <span style={{ fontSize: 9, fontWeight: 800, background: '#FEF9C3', color: '#D97706', padding: '2px 8px', borderRadius: 999 }}>PARCIAL</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {motoristas.map((m, mi) => (
                        <div key={mi} style={{
                          fontSize: 11, fontWeight: 600, padding: '3px 10px',
                          borderRadius: 999,
                          background: m.hasPaid ? '#DCFCE7' : 'var(--surface)',
                          color: m.hasPaid ? '#16A34A' : 'var(--text)',
                          border: `1px solid ${m.hasPaid ? '#16A34A33' : 'var(--border)'}`,
                          display: 'flex', alignItems: 'center', gap: 5,
                        }}>
                          {m.hasPaid && <CheckCircle2 size={10} />}
                          {m.name?.split(' ')[0]} · R$ {fmt(m.rent_weekly)}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Weekly Checks ── */}
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#05966915', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Car size={18} color='#059669' />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Relatórios Semanais</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>
                  {weeklyChecks.length}/{activeTenants.length} enviados esta semana
                </div>
              </div>
            </div>
            <button
              onClick={() => { setShowCheckinModal(true); setCheckinError(''); }}
              style={{ ...S.btn(VIOLET), padding: '8px 14px', fontSize: 12, background: VIOLET, color: '#fff', borderRadius: 10 }}
            >
              <Plus size={14} /> Registrar
            </button>
          </div>

          {/* Barra de progresso */}
          {activeTenants.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 6, fontWeight: 600 }}>
                <span>Progresso semanal</span>
                <span>{Math.round((weeklyChecks.length / activeTenants.length) * 100)}%</span>
              </div>
              <div style={{ height: 6, background: 'var(--bg)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${activeTenants.length > 0 ? (weeklyChecks.length / activeTenants.length) * 100 : 0}%`,
                  background: weeklyChecks.length === activeTenants.length ? '#059669' : VIOLET,
                  borderRadius: 999,
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          )}

          {/* Enviados */}
          {weeklyChecks.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                Enviados ({weeklyChecks.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {weeklyChecks.map((c, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', borderRadius: 10, background: '#F0FDF4',
                    border: '1px solid #16A34A22',
                  }}>
                    <CheckCircle2 size={14} color='#16A34A' style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                        {c.tenants?.name?.split(' ')[0] ?? '—'}
                        {c.vehicles?.plate && <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 6 }}>· {c.vehicles.plate}</span>}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
                        {c.current_km ? `${Number(c.current_km).toLocaleString('pt-BR')} km` : 'km?'}
                        {c.oil_level && <span style={{ marginLeft: 8 }}>{oilBadge(c.oil_level)}</span>}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999,
                      background: c.status === 'approved' ? '#DCFCE7' : '#DBEAFE',
                      color: c.status === 'approved' ? '#16A34A' : '#1D4ED8',
                    }}>
                      {c.status === 'approved' ? 'APROVADO' : 'ENVIADO'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pendentes */}
          {pendingTenants.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                Pendentes ({pendingTenants.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pendingTenants.map((t, i) => {
                  const vehArr = Array.isArray(t.vehicles) ? t.vehicles : (t.vehicles ? [t.vehicles] : []);
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', borderRadius: 10, background: '#FEF2F2',
                      border: '1px solid #DC262622',
                    }}>
                      <AlertCircle size={14} color='#DC2626' style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                          {t.name?.split(' ')[0] ?? '—'}
                          {vehArr[0]?.plate && <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 6 }}>· {vehArr[0].plate}</span>}
                        </div>
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: '#FEE2E2', color: '#DC2626' }}>
                        PENDENTE
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTenants.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>
              Nenhum locatário ativo.
            </div>
          )}

          {activeTenants.length > 0 && pendingTenants.length === 0 && weeklyChecks.length > 0 && (
            <div style={{ marginTop: 10, padding: '12px 14px', background: '#F0FDF4', borderRadius: 10, border: '1px solid #16A34A22', display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={16} color='#16A34A' />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#16A34A' }}>Todos os motoristas enviaram o relatório semanal!</span>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 3 — Motor IA (Telegram, Automações, Fines Scanner)
          ══════════════════════════════════════════════════════════════ */}

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.1em', paddingBottom: 6, borderBottom: '2px solid var(--bg)', marginBottom: 20 }}>
          — Motor de IA
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* ── Coluna Esquerda ─────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Conexão Telegram — Bot Pessoal do Dono */}
          <div style={S.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: botConnected ? '#DCFCE7' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageCircle size={18} color={botConnected ? '#16A34A' : '#9CA3AF'} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Seu Gerente IA no Telegram</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>
                  {botConnected ? `✓ Bot configurado · Chat ID ${client?.telegram_chat_id}` : 'Configure seu bot pessoal abaixo'}
                </div>
              </div>
              {botConnected && (
                <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, color: '#16A34A', background: '#DCFCE7', padding: '3px 10px', borderRadius: 20 }}>
                  ATIVO
                </span>
              )}
            </div>

            {/* Instruções de setup */}
            <div style={{ background: '#F0F4FF', border: '1px solid #C7D2FE', borderRadius: 12, padding: '14px 16px', marginBottom: 16, fontSize: 12, color: '#3730A3', lineHeight: 1.8 }}>
              <strong>Cada cliente tem seu próprio bot exclusivo:</strong><br />
              1. Abra <code style={{ background: '#E0E7FF', padding: '1px 5px', borderRadius: 4 }}>@BotFather</code> no Telegram → <code style={{ background: '#E0E7FF', padding: '1px 5px', borderRadius: 4 }}>/newbot</code><br />
              2. Escolha um nome e username para o seu bot<br />
              3. Copie o <strong>Token</strong> que o BotFather enviar<br />
              4. Cole o token abaixo e clique em <strong>Ativar Bot</strong>
            </div>

            {/* Token do bot */}
            <div style={{ marginBottom: 12 }}>
              <label style={S.lbl}>Token do seu bot (do @BotFather)</label>
              <input
                style={{ ...S.inp, fontFamily: 'monospace', fontSize: 12 }}
                placeholder="Ex: 7123456789:AAFabc123..."
                value={botTokenInput}
                onChange={e => setBotTokenInput(e.target.value)}
              />
            </div>

            {/* Chat ID */}
            <div style={{ marginBottom: 14 }}>
              <label style={S.lbl}>Seu Telegram Chat ID</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ ...S.inp, flex: 1, border: chatIdInput.startsWith('@') ? '1px solid #EF4444' : S.inp.border }}
                  placeholder="Ex: 123456789 (envie /start para @userinfobot)"
                  value={chatIdInput}
                  onChange={e => setChatIdInput(e.target.value)}
                />
              </div>
              {chatIdInput.startsWith('@') && (
                <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4, fontWeight: 700 }}>
                  O Chat ID deve ser um número. Envie qualquer mensagem para @userinfobot.
                </div>
              )}
            </div>

            {/* Botão principal */}
            <button
              style={{ ...S.btn(VIOLET), width: '100%', justifyContent: 'center', marginBottom: 8, background: VIOLET, color: '#fff' }}
              onClick={handleRegisterWebhook}
              disabled={registeringWebhook || !botTokenInput.trim()}
            >
              {registeringWebhook
                ? <><div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Ativando...</>
                : <><Zap size={14} /> Ativar Bot</>}
            </button>

            {webhookResult && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: webhookResult.ok ? '#F0FDF4' : '#FEF2F2', color: webhookResult.ok ? '#166534' : '#991B1B', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {webhookResult.ok
                  ? <><CheckCircle2 size={14} /> Bot ativado! Acesse o Telegram e envie /resumo.</>
                  : <><AlertCircle size={14} /> {webhookResult.error}</>}
              </div>
            )}

            {/* Ações rápidas quando conectado */}
            {botConnected && (
              <button
                style={{ ...S.btn(), width: '100%', justifyContent: 'center', fontSize: 13 }}
                onClick={handleSendBriefing}
                disabled={sending}
              >
                {sending
                  ? <><div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Enviando...</>
                  : <><Send size={14} /> Enviar Briefing Agora</>}
              </button>
            )}

            {sendResult && (
              <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 10, background: sendResult.ok ? '#F0FDF4' : '#FEF2F2', color: sendResult.ok ? '#166534' : '#991B1B', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                {sendResult.ok
                  ? <><CheckCircle2 size={14} /> Briefing enviado!</>
                  : <><AlertCircle size={14} /> {sendResult.error}</>}
              </div>
            )}
          </div>

          {/* Log de Atividades da IA */}
          <div style={S.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <Zap size={18} color={VIOLET} />
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Log de Operações da IA</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {aiLogs.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '10px 0' }}>
                  Nenhuma atividade recente registrada pelo motor.
                </div>
              ) : aiLogs.map((l, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, position: 'relative' }}>
                  {i < aiLogs.length - 1 && (
                    <div style={{ position: 'absolute', left: 13, top: 22, bottom: -10, width: 2, background: 'var(--bg)' }} />
                  )}
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, zIndex: 1 }}>
                    {l.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{l.title}</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                        {new Date(l.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, lineHeight: 1.3 }}>{l.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Agenda de Automações */}
          <div style={S.card}>
            <Sec t="— Agenda de Automações" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {AUTOMATIONS.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: a.bg, borderRadius: 12, border: `1px solid ${a.color}22` }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    {a.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.4 }}>{a.desc}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: a.color }}>
                      <Clock size={10} /> {a.time}
                    </div>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: settings?.scan_enabled !== false ? '#4AC878' : '#9CA3AF' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Comandos do Bot — APENAS PARA O DONO */}
          <div style={S.card}>
            <Sec t="— Comandos do Gerente (Telegram do Dono)" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {BOT_COMMANDS.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg)', borderRadius: 10 }}>
                  <code style={{ fontSize: 12, fontWeight: 800, color: NAVY, background: `${NAVY}12`, padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {c.cmd}
                  </code>
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>{c.desc}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--muted)', padding: '10px 12px', background: 'var(--bg)', borderRadius: 10 }}>
              💡 Envie mensagem em linguagem natural para o bot e ele responderá com dados reais da sua frota. O Telegram é exclusivo para o gestor.
            </div>
          </div>
        </div>

        {/* ── Coluna Direita ───────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Motor de Captura de Multas */}
          <div style={S.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FAF5FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Search size={18} color='#7C3AED' />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Motor de Captura de Multas</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>
                  Última varredura: {settings?.last_scan_at
                    ? new Date(settings.last_scan_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                    : 'Nunca'}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Provedor', value: PROVIDERS.find(p => p.id === (settings?.api_provider ?? 'mock'))?.label ?? 'Mock' },
                { label: 'Varredura Auto', value: settings?.scan_enabled !== false ? '● Ativa' : '○ Inativa', color: settings?.scan_enabled !== false ? '#166534' : '#991B1B' },
                { label: 'CNPJ/CPF', value: settings?.document ? settings.document.slice(0, 14) + '…' : 'Não definido' },
                { label: 'Multas Capturadas', value: recentFines.length.toString() },
              ].map((s, i) => (
                <div key={i} style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: s.color ?? 'var(--text)' }}>{s.value}</div>
                </div>
              ))}
            </div>

            <button
              onClick={handleScanNow}
              disabled={scanning}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px', borderRadius: 'var(--radius-pill)', border: 'none', background: scanning ? 'var(--bg)' : NAVY, color: scanning ? 'var(--muted)' : '#FFF', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: scanning ? 'wait' : 'pointer', marginBottom: scanResult ? 10 : 0 }}
            >
              {scanning ? (
                <><div className="spinner" style={{ width: 13, height: 13, borderWidth: 2, borderTopColor: VIOLET }} /> Varrendo veículos...</>
              ) : (
                <><Play size={14} /> Varrer Agora (Manual)</>
              )}
            </button>

            {scanResult && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: scanResult.ok ? '#F0FDF4' : '#FEF2F2', color: scanResult.ok ? '#166534' : '#991B1B', fontSize: 12, fontWeight: 600 }}>
                {scanResult.ok ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircle2 size={14} />
                    {scanResult.data?.results?.length
                      ? `${scanResult.data.results[0]?.vehicles_scanned ?? 0} veículos · ${scanResult.data.results[0]?.fines_found ?? 0} multa(s)`
                      : 'Varredura concluída'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><AlertCircle size={14} /> {scanResult.error}</div>
                )}
              </div>
            )}
          </div>

          {/* Config Provedor */}
          <div style={S.card}>
            <Sec t="— Provedor de Consulta de Infrações" />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {PROVIDERS.map(p => (
                <label key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 14px', borderRadius: 12, border: `2px solid ${form.api_provider === p.id ? VIOLET : 'var(--border)'}`, background: form.api_provider === p.id ? `${VIOLET}08` : 'var(--bg)', cursor: 'pointer', transition: 'all 0.15s' }}>
                  <input type="radio" name="provider" value={p.id} checked={form.api_provider === p.id} onChange={() => ff('api_provider', p.id)} style={{ marginTop: 2, accentColor: VIOLET }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{p.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={S.lbl}>CNPJ ou CPF da Frota</label>
              <input style={S.inp} placeholder="00.000.000/0001-00" value={form.document} onChange={e => ff('document', e.target.value)} />
            </div>

            {form.api_provider !== 'mock' && (
              <div style={{ marginBottom: 14 }}>
                <label style={S.lbl}>Chave de API ({selectedProvider?.label})</label>
                <input style={S.inp} type="password" placeholder="sk-..." value={form.api_key} onChange={e => ff('api_key', e.target.value)} />
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Armazenada com segurança. Nunca exposta ao browser.</div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'var(--bg)', borderRadius: 12, marginBottom: 14 }}>
              <input type="checkbox" id="scan_enabled" checked={form.scan_enabled} onChange={e => ff('scan_enabled', e.target.checked)} style={{ width: 15, height: 15, accentColor: VIOLET, cursor: 'pointer' }} />
              <label htmlFor="scan_enabled" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>Varredura automática ativada (diária às 03h)</label>
            </div>

            <button style={{ ...S.btn(), width: '100%', justifyContent: 'center', background: VIOLET, color: '#fff' }} onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : saved ? '✓ Configurações Salvas' : 'Salvar Configurações'}
            </button>
          </div>

          {/* Multas Recentes */}
          {recentFines.length > 0 && (
            <div style={S.card}>
              <Sec t="— Multas Capturadas Recentemente" />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {recentFines.map((f, i) => {
                  const isLast = i === recentFines.length - 1;
                  const veh    = f.vehicles;
                  const sColor = f.status === 'pago' ? '#166534' : f.status === 'contestado' ? '#854D0E' : '#991B1B';
                  const sBg    = f.status === 'pago' ? '#F0FDF4' : f.status === 'contestado' ? '#FEFCE8' : '#FEF2F2';
                  return (
                    <div key={f.id} style={{ padding: '11px 0', borderBottom: isLast ? 'none' : '1px solid var(--bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                          {veh ? `${veh.brand} ${veh.model} · ${veh.plate}` : 'Veículo'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.description?.slice(0, 40)}{f.date ? ` · ${ptDate(f.date)}` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>R$ {Number(f.amount).toFixed(2)}</div>
                        <div style={{ background: sBg, color: sColor, padding: '2px 8px', borderRadius: 999, fontSize: 9, fontWeight: 800, textTransform: 'uppercase', marginTop: 3 }}>{f.status}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          MODAL — Registrar Check-in Semanal
          ══════════════════════════════════════════════════════════════ */}
      {showCheckinModal && (
        <div style={S.ovl} onClick={e => { if (e.target === e.currentTarget) setShowCheckinModal(false); }}>
          <div style={{ ...S.mbox, maxWidth: 520 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>
                  Registrar Check-in Semanal
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, fontWeight: 500 }}>
                  Semana de {weekStartFmt}
                </div>
              </div>
              <button
                onClick={() => setShowCheckinModal(false)}
                style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'var(--bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} color='var(--muted)' />
              </button>
            </div>

            {/* Motorista */}
            <div style={{ marginBottom: 16 }}>
              <label style={S.lbl}>Motorista *</label>
              <select
                style={{ ...S.inp, appearance: 'none' }}
                value={checkinForm.tenant_id}
                onChange={e => setCheckinForm(p => ({ ...p, tenant_id: e.target.value }))}
              >
                <option value=''>Selecione o motorista...</option>
                {activeTenants.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Veículo (carregado do tenant) */}
            {tenantVehicles.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label style={S.lbl}>Veículo</label>
                <select
                  style={{ ...S.inp, appearance: 'none' }}
                  value={checkinForm.vehicle_id}
                  onChange={e => setCheckinForm(p => ({ ...p, vehicle_id: e.target.value }))}
                >
                  <option value=''>Selecione o veículo...</option>
                  {tenantVehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.plate}</option>
                  ))}
                </select>
              </div>
            )}

            {/* KM Atual */}
            <div style={{ marginBottom: 16 }}>
              <label style={S.lbl}>KM Atual *</label>
              <input
                style={S.inp}
                type='number'
                min='0'
                placeholder='Ex: 48500'
                value={checkinForm.current_km}
                onChange={e => setCheckinForm(p => ({ ...p, current_km: e.target.value }))}
              />
            </div>

            {/* Nível de Óleo */}
            <div style={{ marginBottom: 16 }}>
              <label style={S.lbl}>Nível de Óleo *</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {OIL_LEVELS.map(o => (
                  <label key={o.value} style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    padding: '12px 8px', borderRadius: 12, cursor: 'pointer',
                    border: `2px solid ${checkinForm.oil_level === o.value ? o.color : 'var(--border)'}`,
                    background: checkinForm.oil_level === o.value ? o.bg : 'var(--bg)',
                    transition: 'all 0.15s',
                  }}>
                    <input type='radio' name='oil_level' value={o.value} checked={checkinForm.oil_level === o.value} onChange={() => setCheckinForm(p => ({ ...p, oil_level: o.value }))} style={{ display: 'none' }} />
                    <div style={{ fontSize: 18 }}>
                      {o.value === 'ok' ? '✅' : o.value === 'baixo' ? '⚠️' : '🔴'}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: o.color, textAlign: 'center', lineHeight: 1.3 }}>
                      {o.value === 'ok' ? 'OK' : o.value === 'baixo' ? 'BAIXO' : 'TROCAR'}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* URL de Foto/Vídeo */}
            <div style={{ marginBottom: 16 }}>
              <label style={S.lbl}>URL de Foto ou Vídeo (opcional)</label>
              <input
                style={S.inp}
                type='url'
                placeholder='https://...'
                value={checkinForm.photo_url}
                onChange={e => setCheckinForm(p => ({ ...p, photo_url: e.target.value }))}
              />
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                Cole o link de um vídeo ou foto do veículo (Google Drive, WhatsApp, etc.)
              </div>
            </div>

            {/* Observações */}
            <div style={{ marginBottom: 24 }}>
              <label style={S.lbl}>Observações (opcional)</label>
              <textarea
                style={{ ...S.inp, height: 80, resize: 'vertical' }}
                placeholder='Algum problema ou observação sobre o veículo...'
                value={checkinForm.notes}
                onChange={e => setCheckinForm(p => ({ ...p, notes: e.target.value }))}
              />
            </div>

            {checkinError && (
              <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: '#FEF2F2', color: '#991B1B', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={14} /> {checkinError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                style={{ ...S.btn('s'), flex: 1, justifyContent: 'center' }}
                onClick={() => setShowCheckinModal(false)}
                disabled={checkinSaving}
              >
                Cancelar
              </button>
              <button
                style={{ ...S.btn(), flex: 2, justifyContent: 'center', background: VIOLET, color: '#fff' }}
                onClick={handleSaveCheckin}
                disabled={checkinSaving}
              >
                {checkinSaving ? (
                  <><div className="spinner" style={{ width: 12, height: 12, borderWidth: 2, borderTopColor: '#fff' }} /> Salvando...</>
                ) : (
                  <><CheckCircle2 size={14} /> Registrar Check-in</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
