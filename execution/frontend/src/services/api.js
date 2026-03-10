import { supabase } from '../lib/supabase';

/**
 * Servico centralizado para chamadas ao "Motor" (Edge Functions)
 */
export const api = {
    /**
     * Gera uma nova fatura Stripe para o locatario
     */
    async createInvoice(tenantId) {
        const { data, error } = await supabase.functions.invoke('create-invoice', {
            body: { tenant_id: tenantId }
        });
        if (error) throw error;
        return data;
    },

    /**
     * Cria uma sessao de checkout para um pagamento especifico
     */
    async createCheckoutSession(paymentId) {
        const { data, error } = await supabase.functions.invoke('create-checkout-session', {
            body: { payment_id: paymentId }
        });
        if (error) throw error;
        return data;
    },

    /**
     * Obtem o link de onboarding do Stripe Connect para o frotista
     */
    async getStripeOnboardingLink() {
        const { data, error } = await supabase.functions.invoke('stripe-onboarding-link');
        if (error) throw error;
        return data;
    },

    /**
     * Varre multas via "Motor de Captura"
     */
    async scanFines() {
        const { data, error } = await supabase.functions.invoke('fines-scanner');
        if (error) throw error;
        return data;
    },

    /**
     * Envia o briefing diario/manual via Telegram
     */
    async sendBriefing(clientId) {
        const { data, error } = await supabase.functions.invoke('scheduled-alerts', {
            body: { manual_for_client: clientId }
        });
        if (error) throw error;
        return data;
    },

    /**
     * Obtem metricas globais para o Super Admin
     */
    async getSuperAdminMetrics() {
        const { data, error } = await supabase.functions.invoke('super-admin-metrics', {
            method: 'GET'
        });
        if (error) throw error;
        return data;
    },

    /**
     * Envia notificacao de cobranca via Telegram
     */
    async sendBillingNotification(payload) {
        const { data, error } = await supabase.functions.invoke('telegram-billing', {
            body: payload
        });
        if (error) throw error;
        return data;
    }
};
