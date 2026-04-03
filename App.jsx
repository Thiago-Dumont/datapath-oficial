import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";

// ── CONFIGURAÇÕES E BANCO DE DADOS (BASEADO NO SEU ARQUIVO) ──
const Security = {
  hashPassword: async (pw) => {
    const data = new TextEncoder().encode(pw + "dp_salt_x9k2");
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,"0")).join("");
  },
  validateEmail: (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),
  validatePassword: (p) => p.length >= 8 && /[A-Z]/.test(p) && /[0-9]/.test(p),
};

const DB = {
  g: (k) => JSON.parse(localStorage.getItem("dp_"+k)||"null"),
  s: (k,v) => localStorage.setItem("dp_"+k, JSON.stringify(v)),
  progress: (id) => DB.g("prog_"+id) || {xp:0, level:1, streak:0, completedDays:[]},
};

const C = {
  bg:"#020817", surface:"#0a1628", card:"#0f172a",
  border:"#1e293b", text:"#e2e8f0", accent:"#6366f1", yellow:"#f59e0b"
};

// ── COMPONENTES DA INTERFACE ORIGINAL ──

function Landing({onStart}) {
  return (
    <div style={{minHeight:"100vh", background:C.bg, color:C.text, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", padding:20}}>
      <div style={{background:"#6366f118", border:"1px solid #6366f135", borderRadius:999, padding:"5px 16px", fontSize:12, color:"#818cf8", marginBottom:20}}>🚀 Jornada Gamificada de 90 Dias</div>
      <h1 style={{fontSize:"clamp(2rem, 5vw, 4rem)", fontWeight:900, marginBottom:20, fontFamily:"'Syne', sans-serif"}}>Do Zero ao Analista<br/>de Dados em 90 Dias</h1>
      [span_4](start_span)<p style={{maxWidth:600, color:"#64748b", marginBottom:40}}>Aprenda Python, SQL e Power BI com missões diárias e portfólio real[span_4](end_span).</p>
      <button onClick={onStart} style={{padding:"15px 40px", background:C.accent, color:"#fff", border:"none", borderRadius:10, fontWeight:700, cursor:"pointer", fontSize:18}}>Começar Grátis →</button>
    </div>
  );
}

function Dashboard() {
  return (
    <div style={{padding:30, maxWidth:1200, margin:"0 auto", color:C.text}}>
      <div style={{background:"linear-gradient(135deg,#1e1b4b,#1a2744)", borderRadius:20, padding:30, border:`1px solid ${C.accent}30`, marginBottom:30}}>
        <h2 style={{fontSize:24, fontWeight:900}}>Olá, Aluno! 👋</h2>
        [span_5](start_span)<p style={{color:"#94a3b8"}}>Você está no Dia 1 da sua jornada de dados[span_5](end_span).</p>
      </div>
      <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:20}}>
        <div style={{background:C.card, padding:20, borderRadius:15, border:`1px solid ${C.border}`}}>
          <div style={{fontSize:12, color:"#64748b"}}>XP TOTAL</div>
          [span_6](start_span)<div style={{fontSize:24, fontWeight:900, color:C.accent}}>0 XP[span_6](end_span)</div>
        </div>
        <div style={{background:C.card, padding:20, borderRadius:15, border:`1px solid ${C.border}`}}>
          <div style={{fontSize:12, color:"#64748b"}}>SEQUÊNCIA</div>
          [span_7](start_span)<div style={{fontSize:24, fontWeight:900, color:"#ef4444"}}>0d[span_7](end_span)</div>
        </div>
      </div>
    </div>
  );
}

// ── LÓGICA DE NAVEGAÇÃO ──

export default function App() {
  const [view, setView] = useState("landing");

  return (
    <div style={{minHeight:"100vh", background:C.bg, fontFamily:"'Outfit', sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@900&family=Outfit:wght@400;700&display=swap');`}</style>
      {view === "landing" ? <Landing onStart={() => setView("app")} /> : <Dashboard />}
    </div>
  );
}
