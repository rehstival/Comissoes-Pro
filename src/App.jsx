import { useState, useMemo } from "react";

const CATEGORIES = ["Venda", "Trabalho", "Outro"];
const DISCOUNT_TYPES = [
  { value: "none", label: "Sem desconto" },
  { value: "card", label: "Máquina de cartão (%)" },
  { value: "pix", label: "Taxa PIX (%)" },
  { value: "other_percent", label: "Outro (%)" },
  { value: "other_fixed", label: "Outro (R$ fixo)" },
];

const MONTHS = [
  { value: "01", label: "Janeiro" }, { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },   { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },    { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },   { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },{ value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },{ value: "12", label: "Dezembro" },
];

function formatBRL(v) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const today = new Date();
const todayStr = today.toISOString().split("T")[0];
const currentYear = String(today.getFullYear());
const currentMonth = String(today.getMonth() + 1).padStart(2, "0");

export default function App() {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState({
    description: "",
    category: "Venda",
    type: "percent",
    baseValue: "",
    commission: "",
    discountType: "none",
    discountValue: "",
    date: todayStr,
  });
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterYear, setFilterYear] = useState(currentYear);
  const [toast, setToast] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  // Comissão bruta
  const commissionGross = useMemo(() => {
    const base = parseFloat(form.baseValue) || 0;
    const comm = parseFloat(form.commission) || 0;
    return form.type === "percent" ? (base * comm) / 100 : comm;
  }, [form.baseValue, form.commission, form.type]);

  // Valor do desconto
  const discountAmount = useMemo(() => {
    const dv = parseFloat(form.discountValue) || 0;
    const base = parseFloat(form.baseValue) || 0;
    if (form.discountType === "none") return 0;
    if (form.discountType === "other_fixed") return dv;
    // percent sobre o valor base
    return (base * dv) / 100;
  }, [form.discountType, form.discountValue, form.baseValue]);

  // Líquido
  const commissionNet = useMemo(() => Math.max(0, commissionGross - discountAmount), [commissionGross, discountAmount]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      const [y, m] = e.date.split("-");
      return m === filterMonth && y === filterYear;
    });
  }, [entries, filterMonth, filterYear]);

  const totals = useMemo(() => ({
    gross: filtered.reduce((s, e) => s + e.commissionGross, 0),
    discount: filtered.reduce((s, e) => s + e.discountAmount, 0),
    net: filtered.reduce((s, e) => s + e.commissionNet, 0),
  }), [filtered]);

  const years = useMemo(() => {
    const set = new Set(entries.map((e) => e.date.split("-")[0]));
    set.add(currentYear);
    return Array.from(set).sort((a, b) => b - a);
  }, [entries]);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }

  function handleAdd() {
    if (!form.description.trim()) return showToast("Informe a descrição.", "error");
    if (!form.baseValue || parseFloat(form.baseValue) <= 0) return showToast("Informe o valor base.", "error");
    if (!form.commission || parseFloat(form.commission) <= 0) return showToast("Informe a comissão.", "error");
    if (form.discountType !== "none" && (!form.discountValue || parseFloat(form.discountValue) <= 0))
      return showToast("Informe o valor do desconto.", "error");

    const entry = {
      id: Date.now(),
      description: form.description.trim(),
      category: form.category,
      type: form.type,
      baseValue: parseFloat(form.baseValue),
      commission: parseFloat(form.commission),
      commissionGross,
      discountType: form.discountType,
      discountValue: parseFloat(form.discountValue) || 0,
      discountAmount,
      commissionNet,
      date: form.date,
    };
    setEntries((prev) => [entry, ...prev]);
    setForm((f) => ({ ...f, description: "", baseValue: "", commission: "", discountValue: "", discountType: "none" }));
    showToast("Lançamento adicionado!");
  }

  function handleDelete(id) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setDeleteId(null);
    showToast("Registro removido.", "error");
  }

  const discountIsPercent = form.discountType !== "none" && form.discountType !== "other_fixed";
  const showDiscount = form.discountType !== "none";

  return (
    <div style={s.root}>
      {toast && (
        <div style={{ ...s.toast, background: toast.type === "error" ? "#ef4444" : "#22c55e" }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={s.header}>
        <div style={s.headerIcon}>💰</div>
        <div>
          <div style={s.headerTitle}>ComissõesPro</div>
          <div style={s.headerSub}>Gerenciador de comissões e taxas</div>
        </div>
      </div>

      {/* Form */}
      <div style={s.card}>
        <div style={s.cardTitle}>➕ Novo Lançamento</div>

        <div style={s.row}>
          <div style={s.field}>
            <label style={s.label}>Descrição</label>
            <input style={s.input} placeholder="Ex: Venda de produto X"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div style={{ ...s.field, maxWidth: 140 }}>
            <label style={s.label}>Categoria</label>
            <select style={s.input} value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ ...s.field, maxWidth: 150 }}>
            <label style={s.label}>Data</label>
            <input style={s.input} type="date" value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          </div>
        </div>

        {/* Comissão */}
        <div style={s.sectionLabel}>🏷 Comissão</div>
        <div style={s.row}>
          <div style={{ ...s.field, maxWidth: 190 }}>
            <label style={s.label}>Tipo</label>
            <div style={s.toggle}>
              <button style={{ ...s.toggleBtn, ...(form.type === "percent" ? s.toggleActive : {}) }}
                onClick={() => setForm((f) => ({ ...f, type: "percent", commission: "" }))}>% Percentual</button>
              <button style={{ ...s.toggleBtn, ...(form.type === "fixed" ? s.toggleActive : {}) }}
                onClick={() => setForm((f) => ({ ...f, type: "fixed", commission: "" }))}>R$ Fixo</button>
            </div>
          </div>
          <div style={s.field}>
            <label style={s.label}>Valor base (R$)</label>
            <input style={s.input} type="number" min="0" placeholder="0,00"
              value={form.baseValue}
              onChange={(e) => setForm((f) => ({ ...f, baseValue: e.target.value }))} />
          </div>
          <div style={s.field}>
            <label style={s.label}>{form.type === "percent" ? "% Comissão" : "Comissão (R$)"}</label>
            <input style={s.input} type="number" min="0"
              placeholder={form.type === "percent" ? "Ex: 10" : "Ex: 150"}
              value={form.commission}
              onChange={(e) => setForm((f) => ({ ...f, commission: e.target.value }))} />
          </div>
        </div>

        {/* Desconto */}
        <div style={s.sectionLabel}>📉 Desconto / Taxa</div>
        <div style={s.row}>
          <div style={{ ...s.field, maxWidth: 220 }}>
            <label style={s.label}>Tipo de desconto</label>
            <select style={s.input} value={form.discountType}
              onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value, discountValue: "" }))}>
              {DISCOUNT_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          {showDiscount && (
            <div style={s.field}>
              <label style={s.label}>{discountIsPercent ? "% da taxa" : "Valor fixo (R$)"}</label>
              <input style={s.input} type="number" min="0"
                placeholder={discountIsPercent ? "Ex: 3.5" : "Ex: 10"}
                value={form.discountValue}
                onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))} />
            </div>
          )}
        </div>

        {/* Preview */}
        {commissionGross > 0 && (
          <div style={s.preview}>
            <div style={s.previewItem}>
              <span style={s.previewLabel}>Comissão bruta</span>
              <span style={{ ...s.previewValue, color: "#60a5fa" }}>{formatBRL(commissionGross)}</span>
            </div>
            {showDiscount && discountAmount > 0 && (
              <div style={s.previewItem}>
                <span style={s.previewLabel}>(-) Desconto/Taxa</span>
                <span style={{ ...s.previewValue, color: "#f87171", fontSize: 16 }}>- {formatBRL(discountAmount)}</span>
              </div>
            )}
            <div style={{ ...s.previewItem, borderTop: "1px solid #334155", paddingTop: 10, marginTop: 4 }}>
              <span style={{ ...s.previewLabel, color: "#86efac", fontWeight: 700 }}>✅ Valor líquido</span>
              <span style={{ ...s.previewValue, color: "#22c55e", fontSize: 24 }}>{formatBRL(commissionNet)}</span>
            </div>
          </div>
        )}

        <button style={s.addBtn} onClick={handleAdd}>Adicionar Lançamento</button>
      </div>

      {/* Filter */}
      <div style={s.filterRow}>
        <div style={s.filterGroup}>
          <span style={s.label}>Filtrar por:</span>
          <select style={s.filterSelect} value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
            {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select style={s.filterSelect} value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
            {years.map((y) => <option key={y}>{y}</option>)}
          </select>
        </div>

        {/* Totais */}
        <div style={s.totalsBox}>
          <div style={s.totalItem}>
            <span style={s.totalLabel}>Bruto</span>
            <span style={{ ...s.totalValue, color: "#60a5fa" }}>{formatBRL(totals.gross)}</span>
          </div>
          <div style={s.totalDivider} />
          <div style={s.totalItem}>
            <span style={s.totalLabel}>Taxas</span>
            <span style={{ ...s.totalValue, color: "#f87171" }}>- {formatBRL(totals.discount)}</span>
          </div>
          <div style={s.totalDivider} />
          <div style={s.totalItem}>
            <span style={{ ...s.totalLabel, color: "#86efac" }}>Líquido</span>
            <span style={{ ...s.totalValue, color: "#22c55e" }}>{formatBRL(totals.net)}</span>
          </div>
        </div>
      </div>

      {/* List */}
      <div style={s.card}>
        <div style={s.cardTitle}>
          📋 {MONTHS.find((m) => m.value === filterMonth)?.label} {filterYear}
          <span style={s.badge}>{filtered.length}</span>
        </div>

        {filtered.length === 0 ? (
          <div style={s.empty}>Nenhum lançamento neste período.</div>
        ) : (
          filtered.map((e) => (
            <div key={e.id} style={s.entryRow}>
              <div style={s.entryLeft}>
                <div style={s.entryIcon}>
                  {e.category === "Venda" ? "🛒" : e.category === "Trabalho" ? "🔧" : "📌"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={s.entryDesc}>{e.description}</div>
                  <div style={s.entryMeta}>
                    <span style={s.chip}>{e.category}</span>
                    <span style={s.chip}>{e.type === "percent" ? `${e.commission}%` : "Fixo"} s/ {formatBRL(e.baseValue)}</span>
                    {e.discountType !== "none" && (
                      <span style={{ ...s.chip, borderColor: "#f87171", color: "#f87171" }}>
                        -{e.discountType !== "other_fixed" ? `${e.discountValue}%` : formatBRL(e.discountAmount)} taxa
                      </span>
                    )}
                    <span style={s.entryDate}>{parseDate(e.date).toLocaleDateString("pt-BR")}</span>
                  </div>
                  {e.discountAmount > 0 && (
                    <div style={s.entryBreakdown}>
                      <span style={{ color: "#60a5fa" }}>{formatBRL(e.commissionGross)}</span>
                      <span style={{ color: "#64748b" }}> − </span>
                      <span style={{ color: "#f87171" }}>{formatBRL(e.discountAmount)}</span>
                      <span style={{ color: "#64748b" }}> = </span>
                    </div>
                  )}
                </div>
              </div>
              <div style={s.entryRight}>
                <div style={s.entryValue}>{formatBRL(e.commissionNet)}</div>
                {deleteId === e.id ? (
                  <div style={s.confirmRow}>
                    <span style={s.confirmText}>Remover?</span>
                    <button style={s.confirmYes} onClick={() => handleDelete(e.id)}>Sim</button>
                    <button style={s.confirmNo} onClick={() => setDeleteId(null)}>Não</button>
                  </div>
                ) : (
                  <button style={s.deleteBtn} onClick={() => setDeleteId(e.id)}>🗑</button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const s = {
  root: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    padding: "24px 16px",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    color: "#f1f5f9",
    maxWidth: 900,
    margin: "0 auto",
    position: "relative",
  },
  toast: {
    position: "fixed", top: 20, right: 20,
    color: "#fff", padding: "12px 20px", borderRadius: 10,
    fontWeight: 600, fontSize: 14, zIndex: 999,
    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
  },
  header: { display: "flex", alignItems: "center", gap: 14, marginBottom: 24 },
  headerIcon: { fontSize: 40 },
  headerTitle: { fontSize: 26, fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.5px" },
  headerSub: { fontSize: 13, color: "#94a3b8" },
  card: {
    background: "#1e293b", border: "1px solid #334155",
    borderRadius: 16, padding: "20px", marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15, fontWeight: 700, color: "#e2e8f0",
    marginBottom: 16, display: "flex", alignItems: "center", gap: 8,
  },
  badge: {
    background: "#3b82f6", color: "#fff", borderRadius: 20,
    padding: "2px 10px", fontSize: 12, fontWeight: 700,
  },
  sectionLabel: {
    fontSize: 12, fontWeight: 700, color: "#64748b",
    textTransform: "uppercase", letterSpacing: "0.8px",
    marginBottom: 8, marginTop: 4,
  },
  row: { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 },
  field: { display: "flex", flexDirection: "column", gap: 5, flex: 1, minWidth: 120 },
  label: { fontSize: 12, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" },
  input: {
    background: "#0f172a", border: "1px solid #334155",
    borderRadius: 8, padding: "9px 12px", color: "#f1f5f9",
    fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box",
  },
  toggle: { display: "flex", gap: 4 },
  toggleBtn: {
    flex: 1, padding: "8px 10px", border: "1px solid #334155",
    borderRadius: 8, background: "#0f172a", color: "#94a3b8",
    fontSize: 12, fontWeight: 600, cursor: "pointer",
  },
  toggleActive: { background: "#3b82f6", color: "#fff", border: "1px solid #3b82f6" },
  preview: {
    background: "#0f172a", border: "1px solid #334155",
    borderRadius: 12, padding: "14px 16px", marginBottom: 14,
    display: "flex", flexDirection: "column", gap: 8,
  },
  previewItem: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  previewLabel: { fontSize: 13, color: "#94a3b8" },
  previewValue: { fontSize: 18, fontWeight: 800 },
  addBtn: {
    background: "linear-gradient(90deg, #3b82f6, #6366f1)",
    color: "#fff", border: "none", borderRadius: 10,
    padding: "12px 24px", fontSize: 14, fontWeight: 700,
    cursor: "pointer", width: "100%",
  },
  filterRow: {
    display: "flex", alignItems: "center",
    justifyContent: "space-between", flexWrap: "wrap",
    gap: 12, marginBottom: 16,
  },
  filterGroup: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  filterSelect: {
    background: "#1e293b", border: "1px solid #334155",
    borderRadius: 8, padding: "8px 12px", color: "#f1f5f9",
    fontSize: 13, cursor: "pointer",
  },
  totalsBox: {
    background: "#1e293b", border: "1px solid #334155",
    borderRadius: 12, padding: "10px 16px",
    display: "flex", alignItems: "center", gap: 16,
  },
  totalItem: { display: "flex", flexDirection: "column", alignItems: "center" },
  totalLabel: { fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" },
  totalValue: { fontSize: 16, fontWeight: 800 },
  totalDivider: { width: 1, height: 32, background: "#334155" },
  empty: { color: "#64748b", textAlign: "center", padding: "32px 0", fontSize: 14 },
  entryRow: {
    display: "flex", alignItems: "flex-start",
    justifyContent: "space-between",
    padding: "12px 0", borderBottom: "1px solid #0f172a", gap: 12,
  },
  entryLeft: { display: "flex", alignItems: "flex-start", gap: 10, flex: 1 },
  entryIcon: { fontSize: 22, marginTop: 2 },
  entryDesc: { fontSize: 14, fontWeight: 600, color: "#f1f5f9", marginBottom: 4 },
  entryMeta: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 },
  chip: {
    background: "#0f172a", border: "1px solid #334155",
    borderRadius: 20, padding: "2px 8px", fontSize: 11, color: "#94a3b8",
  },
  entryDate: { fontSize: 11, color: "#64748b" },
  entryBreakdown: { fontSize: 12, color: "#94a3b8" },
  entryRight: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, minWidth: 90 },
  entryValue: { fontSize: 18, fontWeight: 800, color: "#22c55e" },
  deleteBtn: {
    background: "none", border: "none", cursor: "pointer",
    fontSize: 16, padding: "2px 6px", borderRadius: 6, opacity: 0.6,
  },
  confirmRow: { display: "flex", alignItems: "center", gap: 6 },
  confirmText: { fontSize: 12, color: "#f87171" },
  confirmYes: {
    background: "#ef4444", color: "#fff", border: "none",
    borderRadius: 6, padding: "3px 10px", fontSize: 12, cursor: "pointer", fontWeight: 700,
  },
  confirmNo: {
    background: "#334155", color: "#fff", border: "none",
    borderRadius: 6, padding: "3px 10px", fontSize: 12, cursor: "pointer",
  },
};
