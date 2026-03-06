import React from 'react';

function daysUntil(d) { return Math.ceil((new Date(d) - new Date()) / 86400000); }
function ptDate(d) { if (!d) return '—'; const [y,m,dd] = d.split('-'); return `${dd}/${m}/${y}`; }

export default function Dashboard({ vehicles = [], tenants = [], alerts = [], weekRev = 0, totalExpenses = 0, fleetAlerts = { insurance: [], fines: [] }, onNavigate }) {
  const nav = (page) => onNavigate && onNavigate(page);
  const locados = vehicles.filter(v => v.status === "locado").length;
  const disponiveis = vehicles.filter(v => v.status === "disponível").length;
  const inadimplentes = tenants.filter(t => !t.paid).length;

  const S = {
    g4: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(185px,1fr))", gap: 13, marginBottom: 20 },
    sc: ac => ({ background: "linear-gradient(135deg,#0f172a,#1e293b)", border: `1px solid ${ac}40`, borderRadius: 16, padding: 18, position: "relative", overflow: "hidden" }),
    bar: ac => ({ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: ac }),
    card: { background: "linear-gradient(135deg,#0f172a,#1e293b)", border: "1px solid #334155", borderRadius: 16, padding: 20 },
    alr: d => ({ background: d < 15 ? "#ef444410" : d < 30 ? "#f59e0b10" : "#3b82f610", border: `1px solid ${d < 15 ? "#ef4444" : d < 30 ? "#f59e0b" : "#3b82f6"}40`, borderRadius: 12, padding: "12px 15px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }),
    bdg: c => ({ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${c}20`, color: c, border: `1px solid ${c}40`, letterSpacing: ".05em", textTransform: "uppercase", whiteSpace: "nowrap" })
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>📊 Painel Geral</div>
      </div>

      <div style={S.g4}>
        {[
          { l: "Receita Semanal", v: `R$ ${weekRev.toLocaleString()}`, ac: "#6366f1", ic: "💰", to: "payments" },
          { l: "Receita Mensal",  v: `R$ ${(weekRev * 4).toLocaleString()}`, ac: "#8b5cf6", ic: "📈", to: "payments" },
          { l: "Gastos (total)",  v: `R$ ${totalExpenses.toLocaleString()}`, ac: "#ef4444", ic: "💸", to: "maintenance" },
          { l: "Lucro Estimado",  v: `R$ ${Math.max(0, weekRev * 4 - totalExpenses).toLocaleString()}`, ac: "#22c55e", ic: "🏆", to: "payments" },
          { l: "Locados",         v: locados,          ac: "#22c55e", ic: "🚗", to: "vehicles" },
          { l: "Disponíveis",     v: disponiveis,      ac: "#3b82f6", ic: "✅", to: "vehicles" },
          { l: "Inadimplentes",   v: inadimplentes,    ac: "#ef4444", ic: "⚠️", to: "tenants" },
          { l: "Alertas",         v: alerts.length,    ac: "#f59e0b", ic: "🔔", to: "maintenance" },
        ].map((s, i) => (
          <div key={i} onClick={() => nav(s.to)} style={{ ...S.sc(s.ac), cursor: "pointer", transition: "transform .15s, box-shadow .15s" }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 24px ${s.ac}30`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
            <div style={S.bar(s.ac)} /><div style={{ fontSize: 20 }}>{s.ic}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.ac, letterSpacing: "-1px", margin: "5px 0 2px" }}>{s.v}</div>
            <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: ".07em" }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {/* Alertas de Frota */}
        <div style={{ ...S.card, gridColumn: "1/-1" }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            🚨 Alertas de Frota
            {(fleetAlerts.insurance.length + fleetAlerts.fines.length) > 0 && (
              <span style={S.bdg("#ef4444")}>{fleetAlerts.insurance.length + fleetAlerts.fines.length}</span>
            )}
          </div>
          {fleetAlerts.insurance.length === 0 && fleetAlerts.fines.length === 0 ? (
            <div style={{ color: "#22c55e", fontSize: 14 }}>✓ Nenhum alerta de frota</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 9 }}>
              {fleetAlerts.insurance.map((ins, i) => {
                const d = ins.expiry_date ? daysUntil(ins.expiry_date) : null;
                const c = d !== null && d <= 7 ? "#ef4444" : "#f59e0b";
                const veh = ins.vehicles;
                return (
                  <div key={`ins-${i}`} onClick={() => nav("maintenance")}
                    style={{ background: `${c}10`, border: `1px solid ${c}40`, borderRadius: 12, padding: "12px 15px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>🛡 {veh ? `${veh.brand} ${veh.model}` : "—"}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                        {ins.insurer ?? "Seguro"} · vence {ptDate(ins.expiry_date)}
                      </div>
                    </div>
                    <span style={S.bdg(c)}>{d !== null ? `${d}d` : "—"}</span>
                  </div>
                );
              })}
              {fleetAlerts.fines.map((f, i) => {
                const veh = f.vehicles;
                const hasDue = !!f.due_date;
                const d = hasDue ? daysUntil(f.due_date) : null;
                const c = d !== null && d <= 3 ? "#ef4444" : "#f59e0b";
                return (
                  <div key={`fine-${i}`} onClick={() => nav("maintenance")}
                    style={{ background: "#ef444410", border: "1px solid #ef444440", borderRadius: 12, padding: "12px 15px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>🚨 {veh ? `${veh.brand} ${veh.model}` : "Multa"}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                        {f.description ? f.description.slice(0, 30) : "Pendente"}
                        {hasDue ? ` · vence ${ptDate(f.due_date)}` : ""}
                      </div>
                    </div>
                    <span style={S.bdg("#ef4444")}>
                      {f.amount > 0 ? `R$${Number(f.amount).toFixed(0)}` : "Pendente"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Alertas de Documentos */}
        <div style={{ ...S.card, gridColumn: "1/-1" }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>⚠️ Alertas de Documentos</div>
          {alerts.length === 0 ? (
             <div style={{ color: "#22c55e", fontSize: 14 }}>✓ Tudo em ordem!</div>
          ) : (
            alerts.slice(0, 5).map((a, i) => (
              <div key={i} style={S.alr(a.days)}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{a.veh} <span style={{ color: "#64748b", fontWeight: 400 }}>({a.plate})</span></div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                    {a.doc.toUpperCase()} — {a.days} dias restantes
                  </div>
                </div>
                <div style={S.bdg(a.days < 15 || a.days === 0 ? "#ef4444" : a.days < 30 ? "#f59e0b" : "#3b82f6")}>
                  {a.days === 0 ? "URGENTE" : `${a.days}d`}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
