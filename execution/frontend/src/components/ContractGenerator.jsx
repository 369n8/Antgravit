/**
 * ContractGenerator
 * Extraído de frotas-app (1).jsx
 *
 * Uso:
 *   import { ContractButton } from './components/ContractGenerator';
 *   <ContractButton tenant={tenant} vehicle={vehicle} style={...} />
 *
 * Ou use a função diretamente:
 *   import { generateContractPDF } from './components/ContractGenerator';
 *   generateContractPDF(tenant, vehicle);
 */

const ptDate = (s) => s ? new Date(s).toLocaleDateString('pt-BR') : '—';
const fmtBRL  = (v) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

// ── HTML do contrato (idêntico ao original) ────────────────────────────────
function buildContractHTML(tenant, vehicle) {
  const hoje = new Date().toLocaleDateString('pt-BR');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
  body{font-family:Arial,sans-serif;margin:40px;color:#111;font-size:13px}
  h1{text-align:center;font-size:20px;margin-bottom:4px}
  h2{font-size:14px;margin:20px 0 8px;border-bottom:1px solid #ccc;padding-bottom:4px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
  .field{margin-bottom:6px}.label{font-size:11px;color:#666;text-transform:uppercase}
  .value{font-weight:bold;border-bottom:1px solid #999;padding:2px 0;min-width:120px;display:inline-block}
  .clause{margin-bottom:10px;line-height:1.5}
  .sign{margin-top:50px;display:grid;grid-template-columns:1fr 1fr;gap:40px}
  .sign-line{border-top:1px solid #333;padding-top:8px;text-align:center;font-size:12px}
  </style></head><body>
  <h1>CONTRATO DE LOCAÇÃO DE VEÍCULO</h1>
  <p style="text-align:center;color:#555">Emitido em ${hoje}</p>
  <h2>LOCADOR</h2>
  <div class="grid">
    <div class="field"><div class="label">Nome</div><div class="value">_______________________________</div></div>
    <div class="field"><div class="label">CPF</div><div class="value">_______________________________</div></div>
  </div>
  <h2>LOCATÁRIO</h2>
  <div class="grid">
    <div class="field"><div class="label">Nome</div><div class="value">${tenant.name}</div></div>
    <div class="field"><div class="label">CPF</div><div class="value">${tenant.cpf || '—'}</div></div>
    <div class="field"><div class="label">RG</div><div class="value">${tenant.rg || '—'}</div></div>
    <div class="field"><div class="label">CNH</div><div class="value">${tenant.cnh || '—'} (Cat. ${tenant.cnh_category || tenant.cnhCategory || '—'})</div></div>
    <div class="field"><div class="label">Telefone</div><div class="value">${tenant.phone || '—'}</div></div>
    <div class="field"><div class="label">E-mail</div><div class="value">${tenant.email || '—'}</div></div>
    <div class="field" style="grid-column:1/-1"><div class="label">Endereço</div><div class="value">${
      [tenant.address, tenant.bairro, tenant.cidade && tenant.estado ? `${tenant.cidade}/${tenant.estado}` : '']
        .filter(Boolean).join(', ') || '—'
    }</div></div>
  </div>
  <h2>VEÍCULO</h2>
  <div class="grid">
    <div class="field"><div class="label">Veículo</div><div class="value">${vehicle ? `${vehicle.brand} ${vehicle.model} ${vehicle.year}` : '—'}</div></div>
    <div class="field"><div class="label">Placa</div><div class="value">${vehicle?.plate || '—'}</div></div>
    <div class="field"><div class="label">Cor</div><div class="value">${vehicle?.color || '—'}</div></div>
    <div class="field"><div class="label">KM na entrega</div><div class="value">${Number(vehicle?.km || 0).toLocaleString()}</div></div>
  </div>
  <h2>CONDIÇÕES</h2>
  <div class="grid">
    <div class="field"><div class="label">Valor semanal</div><div class="value">${fmtBRL(tenant.rent_weekly ?? tenant.rentWeekly ?? 0)}</div></div>
    <div class="field"><div class="label">Caução</div><div class="value">${fmtBRL(tenant.deposits ?? 0)}</div></div>
    <div class="field"><div class="label">Pagamento</div><div class="value">${tenant.payment_method ?? tenant.paymentMethod ?? '—'} — ${tenant.payment_day ?? tenant.paymentDay ?? '—'}</div></div>
    <div class="field"><div class="label">Início</div><div class="value">${ptDate(tenant.since ?? tenant.created_at)}</div></div>
  </div>
  <h2>CLÁUSULAS</h2>
  <div class="clause"><b>1. OBJETO:</b> O presente instrumento tem por objeto a locação do veículo identificado acima pelo prazo indeterminado, iniciando em ${ptDate(tenant.since ?? tenant.created_at)}.</div>
  <div class="clause"><b>2. PAGAMENTO:</b> O LOCATÁRIO deverá efetuar o pagamento de ${fmtBRL(tenant.rent_weekly ?? tenant.rentWeekly ?? 0)} semanais toda ${tenant.payment_day ?? tenant.paymentDay ?? '—'}, por meio de ${tenant.payment_method ?? tenant.paymentMethod ?? '—'}.</div>
  <div class="clause"><b>3. CAUÇÃO:</b> O LOCATÁRIO deposita a caução de ${fmtBRL(tenant.deposits ?? 0)}, a ser devolvida ao término do contrato, deduzidos eventuais danos.</div>
  <div class="clause"><b>4. MULTAS E INFRAÇÕES:</b> Todas as multas de trânsito cometidas durante a locação são de responsabilidade exclusiva do LOCATÁRIO.</div>
  <div class="clause"><b>5. DANOS:</b> O LOCATÁRIO é responsável por qualquer avaria causada ao veículo durante o período de locação.</div>
  <div class="clause"><b>6. RESCISÃO:</b> O contrato pode ser rescindido por qualquer das partes com aviso prévio de 7 (sete) dias.</div>
  <div class="clause"><b>7. FORO:</b> Fica eleito o foro da Comarca de ${tenant.cidade || 'São Paulo'} para dirimir quaisquer controvérsias.</div>
  <div class="sign">
    <div class="sign-line">Locador<br><br>CPF: ___________________</div>
    <div class="sign-line">${tenant.name}<br><br>CPF: ${tenant.cpf || '___________________'}</div>
  </div>
  </body></html>`;
}

// ── Função exportada: abre janela de impressão ─────────────────────────────
export function generateContractPDF(tenant, vehicle) {
  const html = buildContractHTML(tenant, vehicle);
  const win  = window.open('', '_blank');
  if (!win) { alert('Permita pop-ups para gerar o contrato.'); return; }
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
}

// ── Componente botão pronto para usar ─────────────────────────────────────
export function ContractButton({ tenant, vehicle, style = {} }) {
  return (
    <button
      style={style}
      onClick={() => generateContractPDF(tenant, vehicle)}
    >
      Gerar Contrato PDF
    </button>
  );
}
