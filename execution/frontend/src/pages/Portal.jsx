import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Car, Fuel, Gauge, CheckCircle2, AlertCircle, FileText, CalendarDays, Receipt, X, Video, Upload, QrCode, Copy, Clock } from 'lucide-react';
import { generateContractPDF } from '../components/ContractGenerator';
import SignatureCanvas from 'react-signature-canvas';
import { api } from '../services/api';

function ptDate(dateStr) {
    if (!dateStr) return '—';
    // Lidar com datas ISO completas ou YYYY-MM-DD
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export default function Portal({ token }) {
    const [tenant, setTenant] = useState(null);
    const [vehicle, setVehicle] = useState(null);
    const [allPayments, setAllPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [checkoutId, setCheckoutId] = useState(null);

    // Invoice state
    const [invoices, setInvoices] = useState([]);
    const [invoiceLoading, setInvoiceLoading] = useState(false);

    // Estados do Canvas Sign
    const [showSignModal, setShowSignModal] = useState(false);
    const [isSavingSign, setIsSavingSign] = useState(false);
    const sigCanvas = useRef({});

    // PIX state
    const [pixCopied, setPixCopied] = useState(false);

    // Estados da Vistoria Semanal
    const [inspections, setInspections] = useState([]);
    const [inspKm, setInspKm] = useState('');
    const [inspVideo, setInspVideo] = useState(null);
    const [inspUploading, setInspUploading] = useState(false);
    const [inspOilLevel, setInspOilLevel] = useState('');
    const [inspNotes, setInspNotes] = useState('');

    // Estados de Pneus e Bateria
    const [tireComparison, setTireComparison] = useState([]);
    const [batteryInfo, setBatteryInfo] = useState(null);

    // Fotos de entrega obrigatórias
    const [entregaPhotos, setEntregaPhotos] = useState([]);

    const handleClearSignature = () => sigCanvas.current.clear();

    const handleSaveSignature = async () => {
        if (sigCanvas.current.isEmpty()) {
            alert('Por favor, assine o campo antes de confirmar.');
            return;
        }

        setIsSavingSign(true);
        try {
            // Pega o frame
            const dataURL = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
            // Remove o prefixo metadata do html
            const base64Data = dataURL.replace(/^data:image\/png;base64,/, "");

            // Nome hash único
            const fileName = `contracts/${tenant.id}_signature_${Date.now()}.png`;

            // Envia para Storage 'contracts' (public ou private dependendo da config Supabase)
            // Se o bucket não existir, vai dar falha (será resolvido na config de edge/bucket cloud)
            const { data: uploadData, error: uploadErr } = await supabase.storage
                .from('contracts')
                .upload(fileName, decodeBase64(base64Data), {
                    contentType: 'image/png',
                    upsert: true
                });

            if (uploadErr) {
                console.error(uploadErr);
                throw new Error("Erro no upload do storage. O Bucket 'contracts' foi criado no Supabase?");
            }

            const { data: psData } = supabase.storage.from('contracts').getPublicUrl(fileName);
            const publicUrl = psData.publicUrl;

            // Update da tabela
            const { error: dbErr } = await supabase
                .from('tenants')
                .update({
                    contract_signature_url: publicUrl,
                    contract_signed_at: new Date().toISOString(),
                    portal_access_status: 'active'
                })
                .eq('id', tenant.id);

            if (dbErr) throw dbErr;

            alert('Contrato Assinado com Sucesso!');
            setShowSignModal(false);
            window.location.reload();

        } catch (err) {
            console.error(err);
            alert('Falha na assinatura: ' + err.message);
        } finally {
            setIsSavingSign(false);
        }
    };

    // Helper p/ conversão sem atob na window
    function decodeBase64(base64) {
        const binString = window.atob(base64);
        const bytes = new Uint8Array(binString.length);
        for (let i = 0; i < binString.length; i++) {
            bytes[i] = binString.charCodeAt(i);
        }
        return bytes;
    }

    useEffect(() => {
        async function loadData() {
            if (!token) {
                setError("Token não fornecido");
                setLoading(false);
                return;
            }

            try {
                const { data: tData, error: tErr } = await supabase
                    .from('tenants')
                    .select('*')
                    .eq('id', token)
                    .single();

                if (tErr || !tData) throw new Error("Motorista não encontrado (Token Inválido)");
                setTenant(tData);

                if (tData.vehicle_id) {
                    const { data: vData } = await supabase
                        .from('vehicles')
                        .select('*')
                        .eq('id', tData.vehicle_id)
                        .single();
                    if (vData) {
                        setVehicle(vData);
                        // Carregar pneus e bateria do veículo
                        const { data: tires } = await supabase.from('vehicle_tires').select('*').eq('vehicle_id', vData.id);
                        setTireComparison(tires || []);
                        if (vData.battery_serial || vData.battery_brand) {
                            setBatteryInfo({
                                serial: vData.battery_serial,
                                brand: vData.battery_brand,
                                ah: vData.battery_ah,
                                warrantyUntil: vData.battery_warranty_until,
                            });
                        }
                        // Carregar fotos obrigatórias do check-in de entrega
                        const { data: photos } = await supabase.from('inspection_photos')
                            .select('*')
                            .eq('vehicle_id', vData.id)
                            .eq('is_required', true)
                            .order('taken_at', { ascending: false })
                            .limit(8);
                        setEntregaPhotos(photos || []);
                    }
                }

                const { data: pData } = await supabase
                    .from('payments')
                    .select('*')
                    .eq('tenant_id', token)
                    .order('due_date', { ascending: false, nullsFirst: false });

                setAllPayments(pData || []);

                const { data: inspData } = await supabase
                    .from('weekly_inspections')
                    .select('*')
                    .eq('tenant_id', token)
                    .order('created_at', { ascending: false })
                    .limit(5);
                setInspections(inspData || []);

                const { data: invData } = await supabase
                    .from('invoices')
                    .select('*')
                    .eq('tenant_id', token)
                    .order('created_at', { ascending: false })
                    .limit(10);
                setInvoices(invData || []);

            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [token]);

    const handleInspectionSubmit = async () => {
        if (!inspKm || Number(inspKm) <= 0) { alert('Informe a KM atual do veículo.'); return; }
        if (!inspOilLevel) { alert('Informe o nível do óleo.'); return; }
        if (!inspVideo) { alert('O vídeo é obrigatório para enviar a vistoria.'); return; }
        if (inspVideo.size > 200 * 1024 * 1024) { alert('Vídeo muito grande. Máximo: 200MB'); return; }

        setInspUploading(true);
        try {
            const ext = inspVideo.name.split('.').pop();
            const weekStart = (() => {
                const d = new Date();
                const day = d.getDay();
                const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                return new Date(d.setDate(diff)).toISOString().slice(0, 10);
            })();
            const fileName = `${tenant.id}/${tenant.vehicle_id || 'no-vehicle'}/${weekStart}.${ext}`;

            const { error: upErr } = await supabase.storage
                .from('weekly-videos')
                .upload(fileName, inspVideo, { contentType: inspVideo.type, upsert: true });

            if (upErr) throw new Error('Falha no upload: ' + upErr.message);

            const { data: urlData } = supabase.storage.from('weekly-videos').getPublicUrl(fileName);

            const { error: dbErr } = await supabase.from('weekly_inspections').insert({
                tenant_id: tenant.id,
                vehicle_id: tenant.vehicle_id || null,
                video_url: urlData.publicUrl,
                video_path: fileName,
                current_km: Number(inspKm),
                oil_level: inspOilLevel,
                notes: inspNotes || null,
                week_start: weekStart,
                status: 'pending',
            });

            if (dbErr) throw dbErr;

            alert('Vistoria enviada! Aguarde aprovação do gestor.');
            setInspKm('');
            setInspVideo(null);
            setInspOilLevel('');
            setInspNotes('');

            const { data: fresh } = await supabase
                .from('weekly_inspections')
                .select('*')
                .eq('tenant_id', token)
                .order('created_at', { ascending: false })
                .limit(5);
            setInspections(fresh || []);
        } catch (err) {
            alert('Erro na vistoria: ' + err.message);
        } finally {
            setInspUploading(false);
        }
    };

    const handleStripeCheckout = async (paymentId) => {
        setCheckoutId(paymentId);
        try {
            const data = await api.createCheckoutSession(paymentId);
            if (!data?.url) throw new Error('Sem URL de pagamento');
            window.location.href = data.url;
        } catch (err) {
            console.error('[stripe]', err);
            alert('Erro ao processar pagamento. Tente novamente.');
        } finally {
            setCheckoutId(null);
        }
    };

    const handleCreateInvoice = async () => {
        setInvoiceLoading(true);
        try {
            const data = await api.createInvoice(token);
            if (data?.payment_url) {
                window.location.href = data.payment_url;
            }
        } catch (err) {
            console.error('[invoice]', err);
            alert('Erro ao gerar fatura. Tente novamente.');
        } finally {
            setInvoiceLoading(false);
        }
    };

    if (loading) return (
        <div style={{ background: '#F6F6F4', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Helvetica, sans-serif' }}>
            <div className="spinner" style={{ borderColor: '#EBEBEB', borderTopColor: '#FFC524' }} />
        </div>
    );

    if (error) return (
        <div style={{ background: '#F6F6F4', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Helvetica, sans-serif' }}>
            <AlertCircle size={48} color="#991B1B" style={{ marginBottom: 16 }} />
            <h2 style={{ color: '#111827', margin: '0 0 8px', fontSize: 22, fontWeight: 700 }}>Acesso Negado</h2>
            <p style={{ color: '#6B7280', margin: 0, textAlign: 'center' }}>{error}</p>
        </div>
    );

    const pendingPayments = allPayments.filter(p => !p.paid_status);
    const paidPayments = allPayments.filter(p => p.paid_status);
    const totalDue = pendingPayments.reduce((acc, curr) => acc + (curr.value_amount || 0), 0);
    const contractSigned = !!tenant.contract_signature_url;

    // Invoice logic
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diffToMon);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const currentWeekPayment = allPayments.find(p => p.week_start === weekStartStr) ?? null;

    const currentWeekInvoice = invoices.find(inv =>
        inv.status !== 'cancelled' && new Date(inv.created_at) >= weekStart
    ) ?? null;
    const overdueInvoices = invoices.filter(inv =>
        inv.status === 'pending' && inv.due_date && inv.due_date < today
    );
    const isBlocked = contractSigned && overdueInvoices.length > 0;

    return (
        <div style={{
            background: '#F6F6F4',
            minHeight: '100vh',
            padding: '40px 24px',
            fontFamily: 'Helvetica, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            WebkitFontSmoothing: 'antialiased'
        }}>
            <div style={{ maxWidth: 480, margin: '0 auto' }}>

                {/* Header Minimalista */}
                <div style={{ marginBottom: 40, textAlign: 'center' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FFC524', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: '#111827', margin: '0 auto 16px', letterSpacing: '-1px' }}>
                        {tenant.name.charAt(0).toUpperCase()}
                    </div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: '#111827', margin: '0 0 4px', letterSpacing: '-0.5px' }}>Olá, {tenant.name.split(' ')[0]}</h1>
                    <p style={{ fontSize: 15, color: '#9CA3AF', margin: 0, fontWeight: 500 }}>Sua visão geral de locatário</p>
                </div>

                {/* ── Status Banner da Semana ── */}
                {contractSigned && (() => {
                    // Pago esta semana
                    if (currentWeekPayment?.paid_status) return (
                        <div style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 24, padding: '20px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                            <CheckCircle2 size={28} color="#16A34A" style={{ flexShrink: 0 }} />
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: '#166534' }}>Semana em dia!</div>
                                <div style={{ fontSize: 13, color: '#15803D', fontWeight: 500 }}>{currentWeekPayment.week_label} · PIX confirmado ✓</div>
                            </div>
                        </div>
                    );

                    // Cobrança gerada mas não paga
                    if (currentWeekPayment && !currentWeekPayment.paid_status) return (
                        <div style={{ background: '#FFFBEB', border: '2px solid #FDE68A', borderRadius: 24, padding: '20px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <QrCode size={22} color="#fff" />
                            </div>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: '#92400E' }}>Pagamento pendente</div>
                                <div style={{ fontSize: 13, color: '#B45309', fontWeight: 500 }}>
                                    {currentWeekPayment.week_label} · R$ {Number(currentWeekPayment.value_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · Veja o QR abaixo
                                </div>
                            </div>
                        </div>
                    );

                    // Sem cobrança gerada ainda
                    return (
                        <div style={{ background: '#F8FAFC', border: '1.5px dashed #CBD5E1', borderRadius: 24, padding: '20px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                            <Clock size={22} color="#9CA3AF" />
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Aluguel desta semana</div>
                                <div style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 500 }}>R$ {Number(tenant.rent_weekly || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · QR gerado automaticamente toda segunda</div>
                            </div>
                        </div>
                    );
                })()}

                {/* Card 0: Check-in / Contrato */}
                <div style={{ background: '#FFF', borderRadius: 32, padding: '32px 28px', marginBottom: 20, boxShadow: '0 4px 40px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(250, 204, 21, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B48A00' }}>
                            <FileText size={20} strokeWidth={2.5} />
                        </div>
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>Meu Contrato</h2>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                        <div style={{ background: '#F6F6F4', borderRadius: 20, padding: '16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase' }}>Início (Check-in)</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{ptDate(tenant.since)}</div>
                        </div>
                        <div style={{ background: '#F6F6F4', borderRadius: 20, padding: '16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase' }}>Aluguel Acordado</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>R$ {Number(tenant.rent_weekly || 0).toLocaleString('pt-BR')} /sem</div>
                        </div>
                        <div style={{ gridColumn: '1/-1', background: '#F6F6F4', borderRadius: 20, padding: '16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase' }}>Dia de Fechamento</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', textTransform: 'capitalize' }}>{tenant.payment_day || 'Segunda-feira'}</div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginTop: 16 }}>
                        <button
                            onClick={() => generateContractPDF(tenant, vehicle)}
                            style={{ width: '100%', background: '#FFF', border: '1.5px solid #EBEBEB', borderRadius: 999, padding: '14px 24px', fontSize: 14, fontWeight: 700, color: '#111827', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#111827'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = '#EBEBEB'; }}
                        >
                            <FileText size={16} /> Ler Termos do Contrato
                        </button>

                        {/* Status de Assinatura */}
                        {tenant.contract_signature_url ? (
                            <div style={{ background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0', borderRadius: 16, padding: '16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                                <CheckCircle2 size={24} />
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 14 }}>Contrato Assinado Digitalmente</div>
                                    <div style={{ fontSize: 12, opacity: 0.8 }}>Obrigado por completar seu onboard.</div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ background: '#FEF2F2', color: '#991B1B', border: '1px dashed #FECACA', borderRadius: 16, padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <AlertCircle size={24} />
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 14 }}>Assinatura Pendente</div>
                                        <div style={{ fontSize: 12, opacity: 0.8 }}>Você precisa assinar seu contrato digital.</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowSignModal(true)}
                                    style={{ width: '100%', background: '#991B1B', color: '#FFF', border: 'none', borderRadius: 999, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                                    Assinar Agora
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* MODAL DE ASSINATURA TOUCH */}
                {showSignModal && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', padding: 16 }}>
                        <div style={{ background: '#FFF', width: '100%', maxWidth: 500, borderRadius: 24, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '24px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F3F4F6' }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: 18, color: '#111827' }}>Assinatura Digital</h3>
                                    <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>Assine no quadro abaixo usando o dedo.</p>
                                </div>
                                <button onClick={() => setShowSignModal(false)} style={{ background: '#F3F4F6', border: 'none', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B7280' }}>
                                    <X size={18} />
                                </button>
                            </div>

                            <div style={{ background: '#F9FAFB', padding: 24 }}>
                                <div style={{ border: '2px dashed #D1D5DB', borderRadius: 12, background: '#FFF', overflow: 'hidden' }}>
                                    <SignatureCanvas penColor='blue'
                                        canvasProps={{ width: 500, height: 200, className: 'sigCanvas' }}
                                        ref={sigCanvas}
                                    />
                                </div>
                            </div>

                            <div style={{ padding: 24, display: 'flex', gap: 12, background: '#FFF', borderTop: '1px solid #F3F4F6' }}>
                                <button onClick={handleClearSignature} style={{ flex: 1, padding: '14px', borderRadius: 999, border: '1px solid #E5E7EB', background: '#FFF', color: '#4B5563', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
                                    Refazer
                                </button>
                                <button onClick={handleSaveSignature} disabled={isSavingSign} style={{ flex: 1, padding: '14px', borderRadius: 999, border: 'none', background: '#111827', color: '#FFF', fontWeight: 600, fontSize: 15, cursor: isSavingSign ? 'wait' : 'pointer', opacity: isSavingSign ? 0.7 : 1 }}>
                                    {isSavingSign ? 'Salvando...' : 'Confirmar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Card 1: Meu Veículo */}
                <div style={{ position: 'relative', marginBottom: 20 }}>
                    {(!contractSigned || isBlocked) && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(246,246,244,0.88)', borderRadius: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, backdropFilter: 'blur(3px)', zIndex: 10 }}>
                            <AlertCircle size={28} color="#991B1B" />
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{!contractSigned ? 'Assine o contrato para acessar' : 'Regularize sua fatura para acessar'}</div>
                        </div>
                    )}
                    <div style={{ background: '#FFF', borderRadius: 32, padding: '32px 28px', boxShadow: '0 4px 40px rgba(0,0,0,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(143,156,130,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4A5441' }}>
                                <Car size={20} strokeWidth={2.5} />
                            </div>
                            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>Meu Veículo</h2>
                        </div>

                        {vehicle ? (
                            <div>
                                <div style={{ fontSize: 32, fontWeight: 800, color: '#111827', letterSpacing: '-1px', marginBottom: 4 }}>
                                    {vehicle.brand} {vehicle.model}
                                </div>
                                <div style={{ fontSize: 14, color: '#6B7280', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 32 }}>
                                    Placa: <span style={{ color: '#111827' }}>{vehicle.plate}</span>
                                </div>

                                <div style={{ display: 'flex', gap: 16 }}>
                                    <div style={{ flex: 1, background: '#F6F6F4', borderRadius: 20, padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <Gauge size={18} color="#9CA3AF" />
                                        <div>
                                            <div style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase' }}>Ocorrências</div>
                                            <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>0 multas</div>
                                        </div>
                                    </div>
                                    <div style={{ flex: 1, background: '#F6F6F4', borderRadius: 20, padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <Fuel size={18} color="#9CA3AF" />
                                        <div>
                                            <div style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase' }}>Combustível</div>
                                            <div style={{ fontSize: 16, fontWeight: 700, color: '#4A5441' }}>OK</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p style={{ color: '#9CA3AF', margin: 0, fontSize: 15 }}>Nenhum veículo vinculado atualmente.</p>
                        )}
                    </div>
                </div>

                {/* Card 2: Financeiro Pendente (Ações de Pagamento) */}
                <div style={{ position: 'relative', marginBottom: 20 }}>
                    {(!contractSigned || isBlocked) && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(246,246,244,0.88)', borderRadius: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, backdropFilter: 'blur(3px)', zIndex: 10 }}>
                            <AlertCircle size={28} color="#991B1B" />
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{!contractSigned ? 'Assine o contrato para acessar' : 'Regularize sua fatura para acessar'}</div>
                        </div>
                    )}
                    <div style={{ background: '#FFF', borderRadius: 32, padding: '32px 28px', boxShadow: '0 4px 40px rgba(0,0,0,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 12, background: totalDue > 0 ? '#FEE2E2' : 'rgba(143,156,130,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: totalDue > 0 ? '#991B1B' : '#4A5441' }}>
                                {totalDue > 0 ? <AlertCircle size={20} strokeWidth={2.5} /> : <CheckCircle2 size={20} strokeWidth={2.5} />}
                            </div>
                            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>Financeiro Atual</h2>
                        </div>

                        <div style={{ marginBottom: 32 }}>
                            <div style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                                {totalDue > 0 ? "Saldo Pendente" : "Situação Atual"}
                            </div>
                            <div style={{ fontSize: 48, fontWeight: 800, color: totalDue > 0 ? '#991B1B' : '#111827', letterSpacing: '-2px', lineHeight: 1 }}>
                                {totalDue > 0 ? (
                                    <><span style={{ fontSize: 24, opacity: 0.5, marginRight: 8 }}>R$</span>{totalDue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</>
                                ) : (
                                    "Em dia"
                                )}
                            </div>
                        </div>

                        {/* PIX QR Code da semana */}
                        {currentWeekPayment && !currentWeekPayment.paid_status && currentWeekPayment.pix_copy_paste && (
                            <div style={{ marginTop: 8 }}>
                                <div style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>
                                    Pagar via PIX — {currentWeekPayment.week_label}
                                </div>

                                {/* QR Code Image */}
                                {currentWeekPayment.pix_qr_code && (
                                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                                        <div style={{ background: '#FFF', border: '1.5px solid #EBEBEB', borderRadius: 20, padding: 16, display: 'inline-block' }}>
                                            <img
                                                src={currentWeekPayment.pix_qr_code}
                                                alt="QR Code PIX"
                                                style={{ width: 200, height: 200, display: 'block' }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Código copia-e-cola */}
                                <div style={{ background: '#F6F6F4', borderRadius: 16, padding: '16px', marginBottom: 12 }}>
                                    <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>Código PIX (Copia e Cola)</div>
                                    <div style={{ fontSize: 11, color: '#374151', fontFamily: 'monospace', wordBreak: 'break-all', lineHeight: 1.6, marginBottom: 12 }}>
                                        {currentWeekPayment.pix_copy_paste}
                                    </div>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(currentWeekPayment.pix_copy_paste);
                                            setPixCopied(true);
                                            setTimeout(() => setPixCopied(false), 2500);
                                        }}
                                        style={{ width: '100%', background: pixCopied ? '#166534' : '#111827', color: '#FFF', border: 'none', borderRadius: 999, padding: '14px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.2s' }}
                                    >
                                        {pixCopied ? <><CheckCircle2 size={16} /> Copiado!</> : <><Copy size={16} /> Copiar Código PIX</>}
                                    </button>
                                </div>

                                {currentWeekPayment.pix_expires_at && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                                        <Clock size={12} color="#9CA3AF" />
                                        <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 500 }}>
                                            Válido até {new Date(currentWeekPayment.pix_expires_at).toLocaleDateString('pt-BR')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Semana sem PIX gerado ainda */}
                        {currentWeekPayment && !currentWeekPayment.paid_status && !currentWeekPayment.pix_copy_paste && (
                            <div style={{ background: '#F6F6F4', borderRadius: 16, padding: '20px', textAlign: 'center', marginTop: 8 }}>
                                <QrCode size={32} color="#9CA3AF" style={{ margin: '0 auto 12px' }} />
                                <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>QR Code sendo gerado</div>
                                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Volte em breve. A cobrança é criada automaticamente toda segunda-feira.</div>
                            </div>
                        )}

                        {/* Sem cobrança esta semana */}
                        {!currentWeekPayment && totalDue === 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, padding: '16px', background: '#F0FDF4', borderRadius: 16 }}>
                                <CheckCircle2 size={20} color="#16A34A" style={{ flexShrink: 0 }} />
                                <div style={{ fontSize: 14, color: '#166534', fontWeight: 600 }}>Nenhuma cobrança pendente esta semana.</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Card 3: Histórico Completo */}
                {allPayments.length > 0 && (
                    <div style={{ position: 'relative' }}>
                        {(!contractSigned || isBlocked) && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(246,246,244,0.88)', borderRadius: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, backdropFilter: 'blur(3px)', zIndex: 10 }}>
                                <AlertCircle size={28} color="#991B1B" />
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{!contractSigned ? 'Assine o contrato para acessar' : 'Regularize sua fatura para acessar'}</div>
                            </div>
                        )}
                        <div style={{ background: '#FFF', borderRadius: 32, padding: '32px 28px', boxShadow: '0 4px 40px rgba(0,0,0,0.03)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2D5085' }}>
                                    <Receipt size={20} strokeWidth={2.5} />
                                </div>
                                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>Histórico de Pagamentos</h2>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                                {allPayments.map((p, i) => {
                                    const isLast = i === allPayments.length - 1;
                                    const isPaid = p.paid_status;
                                    return (
                                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: isLast ? 'none' : '1px solid #F6F6F4' }}>
                                            <div>
                                                <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>{p.week_label || 'Cobrança Aluguel'}</div>
                                                <div style={{ fontSize: 12, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <CalendarDays size={12} />
                                                    {isPaid ? (p.paid_date ? `Pago em ${ptDate(p.paid_date)}` : 'Pago') : (p.due_date ? `Vence em ${ptDate(p.due_date)}` : 'Pendente')}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>R$ {Number(p.value_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                                <div style={{ display: 'inline-block', marginTop: 4, background: isPaid ? 'rgba(143,156,130,0.18)' : '#F6F6F4', color: isPaid ? '#4A5441' : '#9CA3AF', padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
                                                    {isPaid ? 'Confirmado' : 'Aberto'}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Card 4: Vistoria Semanal */}
                {contractSigned && (
                    <div style={{ background: '#FFF', borderRadius: 32, padding: '32px 28px', marginTop: 20, boxShadow: '0 4px 40px rgba(0,0,0,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4338CA' }}>
                                <Video size={20} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>Vistoria Semanal</h2>
                                <p style={{ fontSize: 12, color: '#9CA3AF', margin: '2px 0 0', fontWeight: 500 }}>Envie vídeo 360° + KM atual do veículo</p>
                            </div>
                        </div>

                        {/* Aviso de fotos obrigatórias (apenas se não tiver fotos de entrega e status for alugado) */}
                        {entregaPhotos.length === 0 && vehicle?.status === 'alugado' && (
                            <div style={{ background: '#FFF7ED', borderRadius: 14, padding: '12px 16px', border: '1px solid #FED7AA', marginBottom: 16 }}>
                                <div style={{ fontWeight: 800, color: '#C2410C', fontSize: 13 }}>
                                    📸 Para confirmar a saída do veículo, 4 fotos são obrigatórias.
                                </div>
                                <div style={{ fontSize: 12, color: '#92400E', marginTop: 4 }}>
                                    Frente, Traseira, Lateral E e Lateral D protegem você de disputas sobre danos que não foram causados por você.
                                </div>
                            </div>
                        )}

                        {/* Comparativo de Peças — Entrega */}
                        {(tireComparison.length > 0 || batteryInfo) && (
                            <div style={{ background: '#FFF', borderRadius: 20, padding: 24, border: '1px solid #F1F5F9', marginBottom: 24 }}>
                                <h3 style={{ fontSize: 16, fontWeight: 900, color: '#102A57', marginBottom: 16 }}>
                                    📋 Peças & Segurança — Registrado na Entrega
                                </h3>

                                {batteryInfo && (
                                    <div style={{ background: '#F8FAFF', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                                        <div style={{ fontWeight: 800, fontSize: 13, color: '#5B58EC', marginBottom: 10 }}>🔋 Bateria</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                                            {batteryInfo.serial && <div><span style={{ color: '#94A3B8', fontWeight: 700 }}>Série: </span>{batteryInfo.serial}</div>}
                                            {batteryInfo.brand && <div><span style={{ color: '#94A3B8', fontWeight: 700 }}>Marca: </span>{batteryInfo.brand}</div>}
                                            {batteryInfo.ah && <div><span style={{ color: '#94A3B8', fontWeight: 700 }}>Amperagem: </span>{batteryInfo.ah}Ah</div>}
                                            {batteryInfo.warrantyUntil && <div><span style={{ color: '#94A3B8', fontWeight: 700 }}>Garantia até: </span>{ptDate(batteryInfo.warrantyUntil)}</div>}
                                        </div>
                                    </div>
                                )}

                                {tireComparison.length > 0 && (
                                    <div>
                                        <div style={{ fontWeight: 800, fontSize: 13, color: '#EF4444', marginBottom: 10 }}>🔴 Pneus</div>
                                        {tireComparison.map(tire => {
                                            const labels = { dianteiro_esq: '↖ Dianteiro Esq', dianteiro_dir: '↗ Dianteiro Dir', traseiro_esq: '↙ Traseiro Esq', traseiro_dir: '↘ Traseiro Dir', step: '🔧 Step' };
                                            return (
                                                <div key={tire.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F1F5F9', fontSize: 13 }}>
                                                    <span style={{ fontWeight: 700, color: '#102A57' }}>{labels[tire.position] || tire.position}</span>
                                                    <span style={{ color: '#64748B' }}>{tire.dot_serial || '—'}</span>
                                                    <span style={{ color: '#64748B' }}>{tire.brand || '—'}</span>
                                                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800,
                                                        background: tire.condition === 'ruim' ? '#FFF1F1' : tire.condition === 'regular' ? '#FFF7ED' : '#F0FDF4',
                                                        color: tire.condition === 'ruim' ? '#EF4444' : tire.condition === 'regular' ? '#F97316' : '#10B981'
                                                    }}>{tire.condition}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Fotos do Estado de Entrega */}
                        {entregaPhotos.length > 0 && (
                            <div style={{ background: '#FFF', borderRadius: 20, padding: 24, border: '1px solid #F1F5F9', marginBottom: 24 }}>
                                <h3 style={{ fontSize: 16, fontWeight: 900, color: '#102A57', marginBottom: 4 }}>
                                    📸 Fotos do Estado de Entrega
                                </h3>
                                <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>
                                    Registradas no momento em que o veículo foi entregue a você.
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                                    {entregaPhotos.map(p => {
                                        const labels = { frente: 'Frente', traseira: 'Traseira', lateral_esq: 'Lateral E', lateral_dir: 'Lateral D', dano: 'Dano', interior: 'Interior', outro: 'Outro' };
                                        return (
                                            <div key={p.id} style={{ borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
                                                <img src={p.photo_url} style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                                                {p.position && (
                                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(16,42,87,0.75)', color: '#FFF', fontSize: 11, fontWeight: 800, padding: '4px 8px', textAlign: 'center' }}>
                                                        {labels[p.position] || p.position}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Histórico de vistorias */}
                        {inspections.length > 0 && (
                            <div style={{ marginBottom: 24 }}>
                                {inspections.slice(0, 3).map((insp, i) => {
                                    const statusColor = insp.status === 'approved' ? { bg: '#F0FDF4', text: '#166534', label: 'Aprovada' }
                                        : insp.status === 'rejected' ? { bg: '#FEF2F2', text: '#991B1B', label: 'Rejeitada' }
                                            : { bg: '#F6F6F4', text: '#6B7280', label: 'Em análise' };
                                    return (
                                        <div key={insp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < Math.min(inspections.length, 3) - 1 ? '1px solid #F6F6F4' : 'none' }}>
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{new Date(insp.created_at).toLocaleDateString('pt-BR')}</div>
                                                <div style={{ fontSize: 11, color: '#9CA3AF' }}>{insp.current_km?.toLocaleString('pt-BR')} km</div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                {insp.video_url && (
                                                    <a href={insp.video_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#4338CA', fontWeight: 600, textDecoration: 'none' }}>Ver vídeo</a>
                                                )}
                                                <div style={{ background: statusColor.bg, color: statusColor.text, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                                                    {statusColor.label}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Form de nova vistoria */}
                        <div style={{ background: '#F6F6F4', borderRadius: 20, padding: '20px' }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 4 }}>📹 Vistoria Semanal</div>
                            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>Envie até domingo 23:59. Vídeo obrigatório.</div>

                            {/* Checklist orientativo */}
                            <div style={{ background: '#FFF', borderRadius: 12, padding: '12px 14px', marginBottom: 16, border: '1px solid #E5E7EB' }}>
                                <div style={{ fontSize: 11, fontWeight: 800, color: '#374151', marginBottom: 8, textTransform: 'uppercase' }}>O vídeo deve mostrar:</div>
                                {[
                                    '📊 Painel com KM visível no odômetro',
                                    '🛢️ Vareta de óleo fora, nível legível',
                                    '🚗 Volta completa pelo carro (frente, laterais, traseira)'
                                ].map((item, i) => (
                                    <div key={i} style={{ fontSize: 12, color: '#6B7280', padding: '4px 0', borderBottom: i < 2 ? '1px solid #F3F4F6' : 'none' }}>
                                        {item}
                                    </div>
                                ))}
                            </div>

                            {/* KM */}
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>KM Atual *</div>
                                <input
                                    type="number"
                                    placeholder="Ex: 85400"
                                    value={inspKm}
                                    onChange={e => setInspKm(e.target.value)}
                                    style={{ width: '100%', background: '#FFF', border: '1.5px solid #EBEBEB', borderRadius: 12, padding: '12px 16px', fontSize: 15, fontWeight: 600, color: '#111827', outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>

                            {/* Nível do Óleo */}
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Nível do Óleo *</div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {[['ok', '✅ OK', '#F0FDF4', '#16A34A'], ['baixo', '⚠️ Baixo', '#FFF7ED', '#D97706'], ['trocar', '🔴 Trocar', '#FEF2F2', '#DC2626']].map(([val, lbl, bg, color]) => (
                                        <button key={val} onClick={() => setInspOilLevel(val)}
                                            style={{ flex: 1, padding: '10px 6px', borderRadius: 10, border: inspOilLevel === val ? `2px solid ${color}` : '2px solid #E5E7EB',
                                                background: inspOilLevel === val ? bg : '#FFF', color: inspOilLevel === val ? color : '#9CA3AF',
                                                fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                            {lbl}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Vídeo */}
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Vídeo (máx 200MB) *</div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#FFF', border: inspVideo ? '1.5px solid #10B981' : '1.5px dashed #D1D5DB', borderRadius: 12, padding: '14px 16px', cursor: 'pointer' }}>
                                    <Video size={18} color={inspVideo ? '#10B981' : '#9CA3AF'} />
                                    <span style={{ fontSize: 13, color: inspVideo ? '#111827' : '#9CA3AF', fontWeight: inspVideo ? 600 : 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {inspVideo ? inspVideo.name : 'Selecionar vídeo (MP4, MOV)...'}
                                    </span>
                                    {inspVideo && <span style={{ fontSize: 11, color: '#6B7280' }}>{(inspVideo.size / 1024 / 1024).toFixed(1)}MB</span>}
                                    <input type="file" accept="video/*" style={{ display: 'none' }} onChange={e => setInspVideo(e.target.files?.[0] || null)} />
                                </label>
                            </div>

                            {/* Observações */}
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Observações (opcional)</div>
                                <textarea
                                    placeholder="Ex: Barulho no freio, risco novo na lateral..."
                                    value={inspNotes}
                                    onChange={e => setInspNotes(e.target.value)}
                                    rows={2}
                                    style={{ width: '100%', background: '#FFF', border: '1.5px solid #EBEBEB', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#111827', outline: 'none', boxSizing: 'border-box', resize: 'none', fontFamily: 'inherit' }}
                                />
                            </div>

                            <button
                                onClick={handleInspectionSubmit}
                                disabled={inspUploading || !inspKm || !inspOilLevel || !inspVideo}
                                style={{ width: '100%', background: (!inspKm || !inspOilLevel || !inspVideo) ? '#9CA3AF' : '#111827', color: '#FFF', border: 'none', borderRadius: 999, padding: '14px', fontSize: 14, fontWeight: 700, cursor: (inspUploading || !inspKm || !inspOilLevel || !inspVideo) ? 'not-allowed' : 'pointer', opacity: inspUploading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                            >
                                <Upload size={16} />
                                {inspUploading ? 'Enviando vídeo...' : 'Enviar Vistoria'}
                            </button>
                            {(!inspKm || !inspOilLevel || !inspVideo) && (
                                <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 8 }}>
                                    Preencha KM + Óleo + Vídeo para habilitar o envio
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
