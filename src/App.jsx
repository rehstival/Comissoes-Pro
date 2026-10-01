import { useState, useMemo, useEffect, useRef } from "react";

// ─── Constantes ───────────────────────────────────────────────
const DISCOUNT_TYPES = [
  { value: "none",         label: "Sem desconto" },
  { value: "card",         label: "Máquina de cartão (%)" },
  { value: "pix",          label: "Taxa PIX (%)" },
  { value: "other_percent",label: "Outro (%)" },
  { value: "other_fixed",  label: "Outro (R$ fixo)" },
];
const MONTHS = [
  {value:"01",label:"Janeiro"},{value:"02",label:"Fevereiro"},{value:"03",label:"Março"},
  {value:"04",label:"Abril"},{value:"05",label:"Maio"},{value:"06",label:"Junho"},
  {value:"07",label:"Julho"},{value:"08",label:"Agosto"},{value:"09",label:"Setembro"},
  {value:"10",label:"Outubro"},{value:"11",label:"Novembro"},{value:"12",label:"Dezembro"},
];

function fBRL(v){return(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}
function fDate(str){const[y,m,d]=str.split("-").map(Number);return new Date(y,m-1,d);}
function load(k,def){try{const s=localStorage.getItem(k);return s?JSON.parse(s):def;}catch{return def;}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}

const today=new Date();
const todayStr=today.toISOString().split("T")[0];
const curYear=String(today.getFullYear());
const curMonth=String(today.getMonth()+1).padStart(2,"0");

const EMPTY_FORM={
  osNumber:"", description:"", mechanic:"", vehicle:"",
  type:"percent", baseValue:"", commission:"",
  discountType:"none", discountValue:"", date:todayStr,
};

// ─── Componente principal ─────────────────────────────────────
export default function App() {
  const [entries,  setEntries]  = useState(()=>load("cmp_entries",[]));
  const [mechanics,setMechanics]= useState(()=>load("cmp_mechanics",[]));
  const [vehicles, setVehicles] = useState(()=>load("cmp_vehicles",[]));
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [filterMonth, setFM]    = useState(curMonth);
  const [filterYear,  setFY]    = useState(curYear);
  const [filterMech,  setFMech] = useState("todos");
  const [toast,    setToast]    = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [tab,      setTab]      = useState("launch"); // launch | mechanics | vehicles | report
  const [newMech,  setNewMech]  = useState("");
  const [newVeh,   setNewVeh]   = useState("");
  const [showPdf,  setShowPdf]  = useState(false);
  const [pdfMech,  setPdfMech]  = useState("todos");
  const [gdStatus, setGdStatus] = useState("idle"); // idle | syncing | ok | error
  const gdTokenRef = useRef(null);

  // Persistência automática
  useEffect(()=>save("cmp_entries",entries),[entries]);
  useEffect(()=>save("cmp_mechanics",mechanics),[mechanics]);
  useEffect(()=>save("cmp_vehicles",vehicles),[vehicles]);

  // Cálculos do formulário
  const gross = useMemo(()=>{
    const base=parseFloat(form.baseValue)||0;
    const c=parseFloat(form.commission)||0;
    return form.type==="percent"?(base*c)/100:c;
  },[form.baseValue,form.commission,form.type]);

  const disc = useMemo(()=>{
    const dv=parseFloat(form.discountValue)||0;
    const base=parseFloat(form.baseValue)||0;
    if(form.discountType==="none") return 0;
    if(form.discountType==="other_fixed") return dv;
    return(base*dv)/100;
  },[form.discountType,form.discountValue,form.baseValue]);

  const net = useMemo(()=>Math.max(0,gross-disc),[gross,disc]);

  // Lançamentos filtrados
  const filtered = useMemo(()=>entries.filter(e=>{
    const[y,m]=e.date.split("-");
    return m===filterMonth&&y===filterYear&&(filterMech==="todos"||e.mechanic===filterMech);
  }),[entries,filterMonth,filterYear,filterMech]);

  const totals = useMemo(()=>({
    base:    filtered.reduce((s,e)=>s+e.baseValue,0),
    disc:    filtered.reduce((s,e)=>s+e.discountAmount,0),
    net:     filtered.reduce((s,e)=>s+e.commissionNet,0),
    gross:   filtered.reduce((s,e)=>s+e.commissionGross,0),
  }),[filtered]);

  const years = useMemo(()=>{
    const s=new Set(entries.map(e=>e.date.split("-")[0]));
    s.add(curYear); return Array.from(s).sort((a,b)=>b-a);
  },[entries]);

  // Toast
  function toast_(msg,type="success"){
    setToast({msg,type});setTimeout(()=>setToast(null),3000);
  }

  // Adicionar lançamento
  function handleAdd(){
    if(!form.osNumber.trim())   return toast_("Informe o número da O.S.","error");
    if(!form.description.trim())return toast_("Informe o serviço realizado.","error");
    if(!form.mechanic)          return toast_("Selecione o mecânico.","error");
    if(!form.vehicle)           return toast_("Selecione o veículo.","error");
    if(!form.baseValue||parseFloat(form.baseValue)<=0) return toast_("Informe o valor do serviço.","error");
    if(!form.commission||parseFloat(form.commission)<=0) return toast_("Informe a comissão.","error");
    if(form.discountType!=="none"&&(!form.discountValue||parseFloat(form.discountValue)<=0))
      return toast_("Informe o valor do desconto.","error");

    setEntries(prev=>[{
      id:Date.now(),
      osNumber:form.osNumber.trim(),
      description:form.description.trim(),
      mechanic:form.mechanic,
      vehicle:form.vehicle,
      type:form.type,
      baseValue:parseFloat(form.baseValue),
      commission:parseFloat(form.commission),
      commissionGross:gross,
      discountType:form.discountType,
      discountValue:parseFloat(form.discountValue)||0,
      discountAmount:disc,
      commissionNet:net,
      date:form.date,
    },...prev]);
    setForm(EMPTY_FORM);
    toast_("✅ Lançamento adicionado!");
  }

  function moveEntry(id,dir){
    const idx=entries.findIndex(e=>e.id===id);
    if(idx===-1) return;
    const arr=[...entries];
    const sw=dir==="up"?idx-1:idx+1;
    if(sw<0||sw>=arr.length) return;
    [arr[idx],arr[sw]]=[arr[sw],arr[idx]];
    setEntries(arr);
  }

  // Google Drive sync usando Google Identity Services (sem redirect URI)
  function gdSync(){
    const CLIENT_ID="624958645603-mfvods2p3dodjkrorus37d6v6du40ss8.apps.googleusercontent.com";
    const SCOPE="https://www.googleapis.com/auth/drive.appdata";

    function doUpload(token){
      setGdStatus("syncing");
      const data=JSON.stringify({entries,mechanics,vehicles,savedAt:new Date().toISOString()});
      const meta=JSON.stringify({name:"comissoespro-backup.json",parents:["appDataFolder"]});
      const boundary="boundary_cmp";
      const body=`--${boundary}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${data}\r\n--${boundary}--`;
      fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",{
        method:"POST",
        headers:{"Authorization":`Bearer ${token}`,"Content-Type":`multipart/related; boundary=${boundary}`},
        body,
      })
      .then(r=>{
        if(r.ok){setGdStatus("ok");toast_("✅ Salvo no Google Drive!");}
        else{setGdStatus("error");toast_("Erro ao salvar no Drive.","error");}
      })
      .catch(()=>{setGdStatus("error");toast_("Erro de conexão.","error");});
    }

    if(gdTokenRef.current){
      doUpload(gdTokenRef.current);
      return;
    }

    // Carrega o script do Google Identity Services se ainda não carregou
    if(!window.google?.accounts?.oauth2){
      const script=document.createElement("script");
      script.src="https://accounts.google.com/gsi/client";
      script.onload=()=>initClient();
      document.head.appendChild(script);
    } else {
      initClient();
    }

    function initClient(){
      const client=window.google.accounts.oauth2.initTokenClient({
        client_id:CLIENT_ID,
        scope:SCOPE,
        callback:(resp)=>{
          if(resp.error){setGdStatus("error");toast_("Erro no login Google.","error");return;}
          gdTokenRef.current=resp.access_token;
          doUpload(resp.access_token);
        },
      });
      client.requestToken();
    }
  }

  // Gerar PDF
  function generatePDF(){
    const ml=MONTHS.find(m=>m.value===filterMonth)?.label;
    const period=`${ml} ${filterYear}`;
    const list=entries.filter(e=>{
      const[y,m]=e.date.split("-");
      return m===filterMonth&&y===filterYear&&(pdfMech==="todos"||e.mechanic===pdfMech);
    });
    if(!list.length) return toast_("Nenhum lançamento para este período.","error");
    const pt={base:list.reduce((s,e)=>s+e.baseValue,0),disc:list.reduce((s,e)=>s+e.discountAmount,0),net:list.reduce((s,e)=>s+e.commissionNet,0),gross:list.reduce((s,e)=>s+e.commissionGross,0)};
    const mechName=pdfMech==="todos"?"Todos os Mecânicos":pdfMech;
    const rows=list.map((e,i)=>`
      <tr style="background:${i%2===0?"#f9fafb":"#fff"}">
        <td>${e.osNumber}</td><td>${e.description}</td><td>${e.vehicle}</td>
        <td>${e.mechanic}</td><td>${fDate(e.date).toLocaleDateString("pt-BR")}</td>
        <td>${fBRL(e.baseValue)}</td>
        <td>${e.type==="percent"?e.commission+"%":"Fixo"}</td>
        <td style="color:#dc2626">${e.discountAmount>0?"- "+fBRL(e.discountAmount):"-"}</td>
        <td style="color:#16a34a;font-weight:700">${fBRL(e.commissionNet)}</td>
      </tr>`).join("");
    const sigs=pdfMech==="todos"
      ?mechanics.map(m=>`<div class="sig"><div class="sl"></div><b>${m}</b><small>Mecânico</small></div>`).join("")
      :`<div class="sig"><div class="sl"></div><b>${pdfMech}</b><small>Mecânico</small></div>
        <div class="sig"><div class="sl"></div><b>Responsável</b><small>Empregador</small></div>`;
    const html=`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
    <title>Comissões ${period}</title><style>
    *{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:32px;color:#111}
    h1{font-size:20px;color:#1e3a5f;margin-bottom:4px}.sub{font-size:12px;color:#6b7280;margin-bottom:18px}
    .info{background:#f3f4f6;border-radius:6px;padding:12px 16px;display:flex;gap:28px;flex-wrap:wrap;margin-bottom:16px}
    .il{font-size:10px;color:#6b7280;text-transform:uppercase;font-weight:700}.iv{font-size:14px;font-weight:700;margin-top:2px}
    table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:18px}
    th{background:#1e3a5f;color:#fff;padding:8px 10px;text-align:left;font-size:11px}
    td{padding:7px 10px;border-bottom:1px solid #e5e7eb}
    .tots{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px}
    .tc{flex:1;min-width:140px;border-radius:6px;padding:10px 14px}
    .tbase{background:#e0f2fe;border:3px solid #0284c7}
    .tdisc{background:#fee2e2;border:3px solid #dc2626}
    .tgross{background:#eff6ff;border:1px solid #bfdbfe}
    .tnet{background:#dcfce7;border:3px solid #16a34a}
    .tl{font-size:11px;text-transform:uppercase;font-weight:800;color:#374151}
    .tv{font-size:20px;font-weight:900;margin-top:4px}
    .tbase .tv{color:#0284c7}.tdisc .tv{color:#dc2626}.tgross .tv{color:#2563eb}.tnet .tv{color:#16a34a}
    .tbase,.tdisc,.tnet{box-shadow:0 2px 8px rgba(0,0,0,0.12)}
    .highlight-label{font-size:10px;background:#0284c7;color:#fff;border-radius:4px;padding:2px 6px;display:inline-block;margin-bottom:4px;font-weight:700}
    .highlight-label.red{background:#dc2626}
    .highlight-label.green{background:#16a34a}
    .decl{font-size:12px;font-weight:600;margin-bottom:24px}
    .sigs{display:flex;gap:32px;flex-wrap:wrap}.sig{flex:1;min-width:160px;display:flex;flex-direction:column;align-items:center;gap:6px}
    .sl{width:100%;border-top:2px solid #374151}
    .sig b{font-size:12px}.sig small{font-size:11px;color:#9ca3af}
    .foot{margin-top:24px;font-size:10px;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb;padding-top:10px}
    </style></head><body>
    <h1>💰 Relatório de Comissões — JetLub</h1>
    <div class="sub">Período: ${period} • Gerado em: ${new Date().toLocaleDateString("pt-BR")}</div>
    <div class="info">
      <div><div class="il">Mecânico</div><div class="iv">${mechName}</div></div>
      <div><div class="il">Período</div><div class="iv">${period}</div></div>
      <div><div class="il">Serviços</div><div class="iv">${list.length}</div></div>
    </div>
    <table><thead><tr><th>O.S.</th><th>Serviço</th><th>Veículo</th><th>Mecânico</th><th>Data</th><th>Vlr Serviço</th><th>Comissão</th><th>Desconto</th><th>Líquido</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="tots">
      <div class="tc tbase">
        <div class="highlight-label">⭐ DESTAQUE</div>
        <div class="tl">Total Mão de Obra</div>
        <div class="tv">${fBRL(pt.base)}</div>
      </div>
      <div class="tc tdisc">
        <div class="highlight-label red">⚠️ DESCONTO</div>
        <div class="tl">Total Desconto Taxas</div>
        <div class="tv">- ${fBRL(pt.disc)}</div>
      </div>
      <div class="tc tgross">
        <div class="tl">Comissão Bruta</div>
        <div class="tv">${fBRL(pt.gross)}</div>
      </div>
      <div class="tc tnet">
        <div class="highlight-label green">✅ A RECEBER</div>
        <div class="tl">Comissão a Receber</div>
        <div class="tv">${fBRL(pt.net)}</div>
      </div>
    </div>
    <div class="decl">Declaro que recebi os valores acima referentes ao período de ${period}.</div>
    <div class="sigs">${sigs}</div>
    <div class="foot">ComissõesPro • JetLub Caldas Novas • ${new Date().toLocaleString("pt-BR")}</div>
    </body></html>`;
    const w=window.open("","_blank");
    w.document.write(html);w.document.close();w.focus();
    setTimeout(()=>w.print(),500);
    setShowPdf(false);
  }

  const discIsPercent=form.discountType!=="none"&&form.discountType!=="other_fixed";

  // ─── Render ───────────────────────────────────────────────────
  return(
    <div style={s.root}>
      {toast&&<div style={{...s.toast,background:toast.type==="error"?"#ef4444":"#22c55e"}}>{toast.msg}</div>}

      {/* PDF Modal */}
      {showPdf&&(
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.mTitle}>📄 Gerar PDF</div>
            <div style={s.mSub}>{MONTHS.find(m=>m.value===filterMonth)?.label} {filterYear}</div>
            <label style={s.label}>Mecânico</label>
            <select style={{...s.input,marginTop:6,marginBottom:20}} value={pdfMech} onChange={e=>setPdfMech(e.target.value)}>
              <option value="todos">Todos os mecânicos</option>
              {mechanics.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
            <div style={{display:"flex",gap:10}}>
              <button style={s.btnGray} onClick={()=>setShowPdf(false)}>Cancelar</button>
              <button style={s.btnPurple} onClick={generatePDF}>📄 Gerar e Imprimir</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={s.header}>
        <div style={{fontSize:36}}>🔧</div>
        <div style={{flex:1}}>
          <div style={s.hTitle}>ComissõesPro</div>
          <div style={s.hSub}>JetLub • Caldas Novas</div>
        </div>
        <button
          style={{...s.btnGray, fontSize:12, opacity: gdStatus==="syncing"?0.6:1}}
          onClick={gdSync}
          disabled={gdStatus==="syncing"}
        >
          {gdStatus==="syncing"?"⏳ Sincronizando...":gdStatus==="ok"?"✅ Salvo no Drive":gdStatus==="error"?"❌ Erro Drive":"☁️ Salvar no Drive"}
        </button>
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {[["launch","➕ Lançar"],["mechanics","🔧 Mecânicos"],["vehicles","🚗 Veículos"],["report","📋 Relatório"]].map(([k,l])=>(
          <button key={k} style={{...s.tab,...(tab===k?s.tabActive:{})}} onClick={()=>setTab(k)}>{l}</button>
        ))}
      </div>

      {/* ── ABA LANÇAR ── */}
      {tab==="launch"&&(
        <div style={s.card}>
          <div style={s.cardTitle}>➕ Novo Lançamento</div>

          <div style={s.tip}>💡 Preencha todos os campos abaixo e clique em <b>Adicionar</b></div>

          <div style={s.row}>
            <div style={{...s.field,maxWidth:140}}>
              <label style={s.label}>Nº da O.S. <span style={s.req}>*</span></label>
              <input style={s.input} placeholder="Ex: 00123"
                value={form.osNumber} onChange={e=>setForm(f=>({...f,osNumber:e.target.value}))}/>
            </div>
            <div style={s.field}>
              <label style={s.label}>Serviço Realizado <span style={s.req}>*</span></label>
              <input style={s.input} placeholder="Ex: Troca de óleo, Revisão..."
                value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>
            </div>
          </div>

          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>Mecânico <span style={s.req}>*</span></label>
              <select style={s.input} value={form.mechanic} onChange={e=>setForm(f=>({...f,mechanic:e.target.value}))}>
                <option value="">Selecione o mecânico...</option>
                {mechanics.map(m=><option key={m} value={m}>{m}</option>)}
              </select>
              {mechanics.length===0&&<span style={s.hint}>Cadastre mecânicos na aba 🔧 Mecânicos</span>}
            </div>
            <div style={s.field}>
              <label style={s.label}>Veículo <span style={s.req}>*</span></label>
              <select style={s.input} value={form.vehicle} onChange={e=>setForm(f=>({...f,vehicle:e.target.value}))}>
                <option value="">Selecione o veículo...</option>
                {vehicles.map(v=><option key={v} value={v}>{v}</option>)}
              </select>
              {vehicles.length===0&&<span style={s.hint}>Cadastre veículos na aba 🚗 Veículos</span>}
            </div>
            <div style={{...s.field,maxWidth:150}}>
              <label style={s.label}>Data</label>
              <input style={s.input} type="date" value={form.date}
                onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
            </div>
          </div>

          <div style={s.secLabel}>💵 Valor e Comissão</div>
          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>Valor do Serviço (R$) <span style={s.req}>*</span></label>
              <input style={s.input} type="number" min="0" placeholder="0,00"
                value={form.baseValue} onChange={e=>setForm(f=>({...f,baseValue:e.target.value}))}/>
            </div>
            <div style={{...s.field,maxWidth:180}}>
              <label style={s.label}>Tipo de Comissão</label>
              <div style={s.toggle}>
                <button style={{...s.tBtn,...(form.type==="percent"?s.tActive:{})}}
                  onClick={()=>setForm(f=>({...f,type:"percent",commission:""}))}>% Percentual</button>
                <button style={{...s.tBtn,...(form.type==="fixed"?s.tActive:{})}}
                  onClick={()=>setForm(f=>({...f,type:"fixed",commission:""}))}>R$ Fixo</button>
              </div>
            </div>
            <div style={s.field}>
              <label style={s.label}>{form.type==="percent"?"% da Comissão":"Valor Fixo da Comissão (R$)"} <span style={s.req}>*</span></label>
              <input style={s.input} type="number" min="0"
                placeholder={form.type==="percent"?"Ex: 10 (para 10%)":"Ex: 50,00"}
                value={form.commission} onChange={e=>setForm(f=>({...f,commission:e.target.value}))}/>
            </div>
          </div>

          <div style={s.secLabel}>📉 Desconto / Taxa da Máquina</div>
          <div style={s.row}>
            <div style={{...s.field,maxWidth:220}}>
              <label style={s.label}>Tipo de Desconto</label>
              <select style={s.input} value={form.discountType}
                onChange={e=>setForm(f=>({...f,discountType:e.target.value,discountValue:""}))}>
                {DISCOUNT_TYPES.map(d=><option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            {form.discountType!=="none"&&(
              <div style={s.field}>
                <label style={s.label}>{discIsPercent?"% da Taxa":"Valor Fixo do Desconto (R$)"}</label>
                <input style={s.input} type="number" min="0"
                  placeholder={discIsPercent?"Ex: 3,5":"Ex: 10,00"}
                  value={form.discountValue} onChange={e=>setForm(f=>({...f,discountValue:e.target.value}))}/>
              </div>
            )}
          </div>

          {/* Preview */}
          {gross>0&&(
            <div style={s.preview}>
              <div style={s.pRow}>
                <span style={s.pLabel}>💵 Valor do Serviço (Mão de Obra)</span>
                <span style={{...s.pVal,color:"#94a3b8"}}>{fBRL(parseFloat(form.baseValue)||0)}</span>
              </div>
              <div style={s.pRow}>
                <span style={s.pLabel}>📊 Comissão Bruta ({form.type==="percent"?form.commission+"%":"Fixo"})</span>
                <span style={{...s.pVal,color:"#60a5fa"}}>{fBRL(gross)}</span>
              </div>
              {disc>0&&(
                <div style={s.pRow}>
                  <span style={s.pLabel}>📉 Desconto / Taxa</span>
                  <span style={{...s.pVal,color:"#f87171"}}>- {fBRL(disc)}</span>
                </div>
              )}
              <div style={{...s.pRow,borderTop:"1px solid #334155",paddingTop:10,marginTop:4}}>
                <span style={{...s.pLabel,color:"#86efac",fontWeight:700}}>✅ Comissão a Receber pelo Mecânico</span>
                <span style={{...s.pVal,color:"#22c55e",fontSize:22}}>{fBRL(net)}</span>
              </div>
            </div>
          )}

          <button style={s.btnBlue} onClick={handleAdd}>✅ Adicionar Lançamento</button>
        </div>
      )}

      {/* ── ABA MECÂNICOS ── */}
      {tab==="mechanics"&&(
        <div style={s.card}>
          <div style={s.cardTitle}>🔧 Mecânicos Cadastrados</div>
          <div style={s.tip}>💡 Cadastre aqui os mecânicos. Eles aparecerão como opção na hora de lançar.</div>
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            <input style={{...s.input,flex:1}} placeholder="Nome do mecânico"
              value={newMech} onChange={e=>setNewMech(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"){const n=newMech.trim();if(!n)return;if(mechanics.includes(n))return toast_("Já cadastrado.","error");setMechanics(p=>[...p,n]);setNewMech("");toast_(`${n} adicionado!`);}}}/>
            <button style={s.btnBlueSmall} onClick={()=>{
              const n=newMech.trim();if(!n)return toast_("Informe o nome.","error");
              if(mechanics.includes(n))return toast_("Já cadastrado.","error");
              setMechanics(p=>[...p,n]);setNewMech("");toast_(`${n} adicionado!`);
            }}>+ Adicionar</button>
          </div>
          {mechanics.length===0
            ?<div style={s.empty}>Nenhum mecânico cadastrado ainda.</div>
            :mechanics.map(m=>(
              <div key={m} style={s.listRow}>
                <span>🔧 {m}</span>
                <button style={s.btnRed} onClick={()=>{setMechanics(p=>p.filter(x=>x!==m));toast_(`${m} removido.`,"error");}}>Remover</button>
              </div>
            ))
          }
        </div>
      )}

      {/* ── ABA VEÍCULOS ── */}
      {tab==="vehicles"&&(
        <div style={s.card}>
          <div style={s.cardTitle}>🚗 Veículos Cadastrados</div>
          <div style={s.tip}>💡 Cadastre os veículos dos clientes. Ex: "Toyota Corolla - ABC-1234"</div>
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            <input style={{...s.input,flex:1}} placeholder="Ex: Toyota Corolla - ABC-1234"
              value={newVeh} onChange={e=>setNewVeh(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"){const n=newVeh.trim();if(!n)return;if(vehicles.includes(n))return toast_("Já cadastrado.","error");setVehicles(p=>[...p,n]);setNewVeh("");toast_(`${n} adicionado!`);}}}/>
            <button style={s.btnBlueSmall} onClick={()=>{
              const n=newVeh.trim();if(!n)return toast_("Informe o veículo.","error");
              if(vehicles.includes(n))return toast_("Já cadastrado.","error");
              setVehicles(p=>[...p,n]);setNewVeh("");toast_(`${n} adicionado!`);
            }}>+ Adicionar</button>
          </div>
          {vehicles.length===0
            ?<div style={s.empty}>Nenhum veículo cadastrado ainda.</div>
            :vehicles.map(v=>(
              <div key={v} style={s.listRow}>
                <span>🚗 {v}</span>
                <button style={s.btnRed} onClick={()=>{setVehicles(p=>p.filter(x=>x!==v));toast_(`${v} removido.`,"error");}}>Remover</button>
              </div>
            ))
          }
        </div>
      )}

      {/* ── ABA RELATÓRIO ── */}
      {tab==="report"&&(
        <>
          {/* Filtros */}
          <div style={s.filterRow}>
            <div style={s.filterGroup}>
              <span style={{...s.label,alignSelf:"center"}}>Filtrar:</span>
              <select style={s.filterSel} value={filterMonth} onChange={e=>setFM(e.target.value)}>
                {MONTHS.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <select style={s.filterSel} value={filterYear} onChange={e=>setFY(e.target.value)}>
                {years.map(y=><option key={y}>{y}</option>)}
              </select>
              <select style={s.filterSel} value={filterMech} onChange={e=>setFMech(e.target.value)}>
                <option value="todos">Todos os mecânicos</option>
                {mechanics.map(m=><option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {filtered.length>0&&(
              <button style={s.btnPurple} onClick={()=>setShowPdf(true)}>📄 Gerar PDF</button>
            )}
          </div>

          {/* Totais */}
          <div style={s.totalsGrid}>
            <div style={{...s.totalCard,borderColor:"#38bdf8"}}>
              <div style={s.totalLabel}>💵 Total Mão de Obra</div>
              <div style={{...s.totalVal,color:"#38bdf8"}}>{fBRL(totals.base)}</div>
            </div>
            <div style={{...s.totalCard,borderColor:"#f87171"}}>
              <div style={s.totalLabel}>📉 Total Desconto Taxas</div>
              <div style={{...s.totalVal,color:"#f87171"}}>- {fBRL(totals.disc)}</div>
            </div>
            <div style={{...s.totalCard,borderColor:"#60a5fa"}}>
              <div style={s.totalLabel}>📊 Comissão Bruta</div>
              <div style={{...s.totalVal,color:"#60a5fa"}}>{fBRL(totals.gross)}</div>
            </div>
            <div style={{...s.totalCard,borderColor:"#22c55e",background:"#052e16"}}>
              <div style={s.totalLabel}>✅ Comissão a Receber</div>
              <div style={{...s.totalVal,color:"#22c55e",fontSize:22}}>{fBRL(totals.net)}</div>
            </div>
          </div>

          {/* Lista */}
          <div style={s.card}>
            <div style={s.cardTitle}>
              📋 {MONTHS.find(m=>m.value===filterMonth)?.label} {filterYear}
              {filterMech!=="todos"&&<span style={s.mechTag}>🔧 {filterMech}</span>}
              <span style={s.badge}>{filtered.length}</span>
            </div>
            {filtered.length===0
              ?<div style={s.empty}>Nenhum lançamento neste período.</div>
              :filtered.map((e,idx)=>{
                const gi=entries.findIndex(en=>en.id===e.id);
                return(
                  <div key={e.id} style={s.entryRow}>
                    <div style={s.orderBtns}>
                      <button style={s.arrowBtn} onClick={()=>moveEntry(e.id,"up")} disabled={gi===0}>▲</button>
                      <span style={s.orderNum}>{idx+1}</span>
                      <button style={s.arrowBtn} onClick={()=>moveEntry(e.id,"down")} disabled={gi===entries.length-1}>▼</button>
                    </div>
                    <div style={s.entryLeft}>
                      <div>
                        <div style={s.entryDesc}>
                          <span style={s.osTag}>OS #{e.osNumber}</span> {e.description}
                        </div>
                        <div style={s.entryMeta}>
                          <span style={{...s.chip,borderColor:"#6366f1",color:"#a5b4fc"}}>🔧 {e.mechanic}</span>
                          <span style={{...s.chip,borderColor:"#0ea5e9",color:"#7dd3fc"}}>🚗 {e.vehicle}</span>
                          <span style={s.chip}>{e.type==="percent"?`${e.commission}%`:"Fixo"} s/ {fBRL(e.baseValue)}</span>
                          {e.discountType!=="none"&&<span style={{...s.chip,borderColor:"#f87171",color:"#f87171"}}>-{e.discountType!=="other_fixed"?`${e.discountValue}%`:fBRL(e.discountAmount)} taxa</span>}
                          <span style={s.dateTag}>{fDate(e.date).toLocaleDateString("pt-BR")}</span>
                        </div>
                      </div>
                    </div>
                    <div style={s.entryRight}>
                      <div style={s.entryVal}>{fBRL(e.commissionNet)}</div>
                      {deleteId===e.id
                        ?<div style={s.confirmRow}>
                            <span style={{fontSize:12,color:"#f87171"}}>Remover?</span>
                            <button style={s.btnRedSm} onClick={()=>{setEntries(p=>p.filter(x=>x.id!==e.id));setDeleteId(null);toast_("Removido.","error");}}>Sim</button>
                            <button style={s.btnGraySm} onClick={()=>setDeleteId(null)}>Não</button>
                          </div>
                        :<button style={s.delBtn} onClick={()=>setDeleteId(e.id)}>🗑</button>
                      }
                    </div>
                  </div>
                );
              })
            }
          </div>
        </>
      )}
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────
const s={
  root:{minHeight:"100vh",background:"linear-gradient(135deg,#0f172a 0%,#1e293b 100%)",padding:"20px 14px",fontFamily:"'Segoe UI',system-ui,sans-serif",color:"#f1f5f9",maxWidth:980,margin:"0 auto",position:"relative"},
  toast:{position:"fixed",top:16,right:16,color:"#fff",padding:"12px 20px",borderRadius:10,fontWeight:600,fontSize:14,zIndex:999,boxShadow:"0 4px 20px rgba(0,0,0,0.4)"},
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"},
  modal:{background:"#1e293b",border:"1px solid #334155",borderRadius:16,padding:28,width:"90%",maxWidth:420},
  mTitle:{fontSize:18,fontWeight:800,color:"#f8fafc",marginBottom:4},
  mSub:{fontSize:13,color:"#94a3b8",marginBottom:18},
  header:{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"},
  hTitle:{fontSize:24,fontWeight:800,color:"#f8fafc",letterSpacing:"-0.5px"},
  hSub:{fontSize:12,color:"#94a3b8"},
  tabs:{display:"flex",gap:4,marginBottom:16,flexWrap:"wrap"},
  tab:{padding:"9px 16px",border:"1px solid #334155",borderRadius:10,background:"#0f172a",color:"#94a3b8",fontSize:13,fontWeight:600,cursor:"pointer"},
  tabActive:{background:"#3b82f6",color:"#fff",border:"1px solid #3b82f6"},
  card:{background:"#1e293b",border:"1px solid #334155",borderRadius:16,padding:20,marginBottom:16},
  cardTitle:{fontSize:15,fontWeight:700,color:"#e2e8f0",marginBottom:14,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"},
  tip:{background:"#0f172a",border:"1px solid #1e40af",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#93c5fd",marginBottom:16},
  secLabel:{fontSize:12,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:8,marginTop:4},
  row:{display:"flex",gap:12,flexWrap:"wrap",marginBottom:12},
  field:{display:"flex",flexDirection:"column",gap:4,flex:1,minWidth:130},
  label:{fontSize:12,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.4px"},
  req:{color:"#f87171"},
  hint:{fontSize:11,color:"#f59e0b",marginTop:3},
  input:{background:"#0f172a",border:"1px solid #334155",borderRadius:8,padding:"9px 12px",color:"#f1f5f9",fontSize:14,outline:"none",width:"100%",boxSizing:"border-box"},
  toggle:{display:"flex",gap:4},
  tBtn:{flex:1,padding:"8px 10px",border:"1px solid #334155",borderRadius:8,background:"#0f172a",color:"#94a3b8",fontSize:12,fontWeight:600,cursor:"pointer"},
  tActive:{background:"#3b82f6",color:"#fff",border:"1px solid #3b82f6"},
  preview:{background:"#0f172a",border:"1px solid #1e3a5f",borderRadius:12,padding:"14px 16px",marginBottom:16,display:"flex",flexDirection:"column",gap:10},
  pRow:{display:"flex",alignItems:"center",justifyContent:"space-between"},
  pLabel:{fontSize:13,color:"#94a3b8"},
  pVal:{fontSize:17,fontWeight:800},
  btnBlue:{background:"linear-gradient(90deg,#3b82f6,#6366f1)",color:"#fff",border:"none",borderRadius:10,padding:"13px 24px",fontSize:14,fontWeight:700,cursor:"pointer",width:"100%"},
  btnBlueSmall:{background:"#3b82f6",color:"#fff",border:"none",borderRadius:8,padding:"9px 14px",fontSize:13,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"},
  btnPurple:{background:"linear-gradient(90deg,#7c3aed,#4f46e5)",color:"#fff",border:"none",borderRadius:10,padding:"10px 18px",fontSize:13,fontWeight:700,cursor:"pointer"},
  btnGray:{background:"#334155",color:"#fff",border:"none",borderRadius:10,padding:"10px 18px",fontSize:13,fontWeight:700,cursor:"pointer"},
  btnRed:{background:"#ef4444",color:"#fff",border:"none",borderRadius:8,padding:"5px 12px",fontSize:12,cursor:"pointer",fontWeight:700},
  btnRedSm:{background:"#ef4444",color:"#fff",border:"none",borderRadius:6,padding:"3px 10px",fontSize:12,cursor:"pointer",fontWeight:700},
  btnGraySm:{background:"#334155",color:"#fff",border:"none",borderRadius:6,padding:"3px 10px",fontSize:12,cursor:"pointer"},
  listRow:{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#0f172a",borderRadius:8,padding:"10px 14px",marginBottom:8},
  filterRow:{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginBottom:14},
  filterGroup:{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"},
  filterSel:{background:"#1e293b",border:"1px solid #334155",borderRadius:8,padding:"8px 12px",color:"#f1f5f9",fontSize:13,cursor:"pointer"},
  totalsGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:16},
  totalCard:{background:"#0f172a",border:"1px solid",borderRadius:12,padding:"12px 16px"},
  totalLabel:{fontSize:11,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:4},
  totalVal:{fontSize:18,fontWeight:800},
  badge:{background:"#3b82f6",color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:12,fontWeight:700},
  mechTag:{background:"#312e81",color:"#a5b4fc",borderRadius:20,padding:"2px 10px",fontSize:12,fontWeight:700},
  empty:{color:"#64748b",textAlign:"center",padding:"32px 0",fontSize:14},
  entryRow:{display:"flex",alignItems:"flex-start",padding:"12px 0",borderBottom:"1px solid #0f172a",gap:8},
  orderBtns:{display:"flex",flexDirection:"column",alignItems:"center",gap:2,minWidth:28},
  arrowBtn:{background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:11,padding:"2px 4px",lineHeight:1},
  orderNum:{fontSize:11,color:"#475569",fontWeight:700},
  entryLeft:{flex:1},
  entryDesc:{fontSize:14,fontWeight:600,color:"#f1f5f9",marginBottom:5,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"},
  osTag:{background:"#1e3a5f",color:"#93c5fd",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700},
  entryMeta:{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"},
  chip:{background:"#0f172a",border:"1px solid #334155",borderRadius:20,padding:"2px 8px",fontSize:11,color:"#94a3b8"},
  dateTag:{fontSize:11,color:"#64748b"},
  entryRight:{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,minWidth:90},
  entryVal:{fontSize:17,fontWeight:800,color:"#22c55e"},
  confirmRow:{display:"flex",alignItems:"center",gap:5},
  delBtn:{background:"none",border:"none",cursor:"pointer",fontSize:16,opacity:0.6},
};
