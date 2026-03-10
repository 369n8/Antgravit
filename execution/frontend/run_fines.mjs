import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bmwvigbktrypgkcbxlxi.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtd3ZpZ2JrdHJ5cGdrY2J4bHhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2ODQ0MTcsImV4cCI6MjA4ODI2MDQxN30._QNNVB9RQWWlP1NzUPVzX6JI07pQ98aFvn522bzIAVI'
const supabase = createClient(supabaseUrl, supabaseKey)

async function autoTrigger() {
    console.log('Buscando clientes...')
    const { data: users, error: userErr } = await supabase.from('clients').select('id')

    if (users && users.length > 0) {
        for (const u of users) {
            console.log('Configurando provedor mock para o usuário:', u.id)
            const { error: upsertErr } = await supabase.from('fleet_settings').upsert({
                client_id: u.id,
                api_provider: 'mock',
                scan_enabled: true,
                document: '00.000.000/0001-00'
            })
            if (upsertErr) console.error('Erro ao configurar settings:', upsertErr.message)
        }
    }

    console.log('Disparando robô de multas (Edge Function: fines-scanner)...')
    const { data, error } = await supabase.functions.invoke('fines-scanner', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseKey}` }
    })

    if (error) {
        console.error('Erro na Edge Function:', error.message)
    } else {
        console.log('Sucesso! Resultado:', JSON.stringify(data))
    }
}

autoTrigger()
