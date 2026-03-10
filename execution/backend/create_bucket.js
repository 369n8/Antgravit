'use strict';

const { createClient } = require('@supabase/supabase-js');
const { readFileSync } = require('fs');
const path = require('path');

// .env está em Projects/ (dois níveis acima de execution/backend/)
const envPath = path.resolve(__dirname, '../../.env');
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const supabaseUrl = envVars.SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontrados em .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

const BUCKET_NAME = 'contracts';

async function ensureBucket() {
  console.log(`🔍 Verificando bucket "${BUCKET_NAME}"...`);

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error('❌ Erro ao listar buckets:', listError.message);
    process.exit(1);
  }

  const exists = buckets.some(b => b.name === BUCKET_NAME);

  if (exists) {
    console.log(`✅ Bucket "${BUCKET_NAME}" já existe. Nenhuma ação necessária.`);
    return;
  }

  console.log(`📦 Bucket não encontrado. Criando "${BUCKET_NAME}" como público...`);

  const { data, error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
    public: true,
    fileSizeLimit: 10485760, // 10 MB
    allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg'],
  });

  if (createError) {
    console.error('❌ Erro ao criar bucket:', createError.message);
    process.exit(1);
  }

  console.log(`✅ Bucket "${BUCKET_NAME}" criado com sucesso!`);
  console.log(`   URL pública base: ${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/`);
}

ensureBucket();
