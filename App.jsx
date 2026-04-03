import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";

// ============================================================
// DATAPATH — PLATAFORMA DE ENSINO GAMIFICADO PARA DADOS
// ============================================================

const Security = {
  hashPassword: async (pw) => {
    const data = new TextEncoder().encode(pw + "dp_salt_x9k2");
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,"0")).join("");
  },
  sanitize: (s) => typeof s === "string" ? s.replace(/[<>&"']/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&#x27;"}[c])) : "",
  validateEmail: (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),
  validatePassword: (p) => p.length >= 8 && /[A-Z]/.test(p) && /[0-9]/.test(p),
  generateJWT: (uid) => {
    const h = btoa(JSON.stringify({alg:"HS256",typ:"JWT"}));
    const p = btoa(JSON.stringify({sub:uid,iat:Date.now(),exp:Date.now()+86400000}));
    const s = btoa(uid+"dp_secret_key");
    return `${h}.${p}.${s}`;
  },
  verifyJWT: (token) => {
    try { const d = JSON.parse(atob(token.split(".")[1])); return d.exp > Date.now() ? d : null; }
    catch { return null; }
  },
};

const RL = { _a: {}, check(k, max=5, win=900000) {
  const now = Date.now();
  this._a[k] = (this._a[k]||[]).filter(t=>now-t<win);
  if (this._a[k].length >= max) return false;
  this._a[k].push(now); return true;
}};

const DB = {
  g: (k) => { try { return JSON.parse(localStorage.getItem("dp_"+k)||"null"); } catch { return null; }},
  s: (k,v) => { try { localStorage.setItem("dp_"+k, JSON.stringify(v)); } catch {} },
  users: () => DB.g("users") || {},
  setUsers: (u) => DB.s("users", u),
  progress: (id) => DB.g("prog_"+id) || defProgress(id),
  setProgress: (id,p) => DB.s("prog_"+id, p),
  notes: (id) => DB.g("notes_"+id) || [],
  setNotes: (id,n) => DB.s("notes_"+id, n),
  portfolio: (id) => DB.g("pf_"+id) || [],
  setPortfolio: (id,p) => DB.s("pf_"+id, p),
  resume: (id) => DB.g("cv_"+id) || defResume(),
  setResume: (id,r) => DB.s("cv_"+id, r),
  goals: (id) => DB.g("goals_"+id) || [],
  setGoals: (id,g) => DB.s("goals_"+id, g),
  habits: (id) => DB.g("habits_"+id) || defHabits(),
  setHabits: (id,h) => DB.s("habits_"+id, h),
  checklist: (id) => DB.g("check_"+id) || [],
  setChecklist: (id,c) => DB.s("check_"+id, c),
};

const defProgress = (id) => ({
  userId:id, xp:0, level:1, streak:0, lastStudy:null,
  completedDays:[], achievements:[], trackProgress:{python:0,sql:0,powerbi:0,english:0}
});
const defResume = () => ({
  name:"",title:"",email:"",phone:"",linkedin:"",github:"",
  summary:"",skills:[],experience:[],education:[],projects:[],certifications:[]
});
const defHabits = () => ([
  {id:1,name:"Estudar Python",streak:0,done:false,color:"#3b82f6"},
  {id:2,name:"Praticar SQL",streak:0,done:false,color:"#10b981"},
  {id:3,name:"Inglês técnico",streak:0,done:false,color:"#f59e0b"},
  {id:4,name:"Revisão do dia",streak:0,done:false,color:"#8b5cf6"},
]);

// ── GAMIFICATION ─────────────────────────────────────────────
const calcLevel = (xp) => Math.floor(Math.sqrt(xp/100))+1;
const xpForLevel = (lvl) => (lvl-1)*(lvl-1)*100;
const xpForNext = (lvl) => lvl*lvl*100;

const ACHIEVEMENTS = [
  {id:"first",name:"Primeiro Passo",desc:"Concluiu o Dia 1",icon:"🌱",xp:50,cond:(p)=>p.completedDays.length>=1},
  {id:"week1",name:"Semana Completa",desc:"7 dias concluídos",icon:"🔥",xp:100,cond:(p)=>p.completedDays.length>=7},
  {id:"streak7",name:"Sequência de 7d",desc:"7 dias consecutivos",icon:"⚡",xp:150,cond:(p)=>p.streak>=7},
  {id:"lvl5",name:"Nível 5",desc:"Alcançou o nível 5",icon:"⭐",xp:200,cond:(p)=>p.level>=5},
  {id:"day30",name:"Mês de Dados",desc:"30 dias concluídos",icon:"🏆",xp:300,cond:(p)=>p.completedDays.length>=30},
  {id:"pf1",name:"Portfólio Iniciado",desc:"Adicionou 1 projeto",icon:"💼",xp:100,cond:(p)=>(p.portfolioCount||0)>=1},
];

// ── JOURNEY 90 DAYS ─────────────────────────────────────────
const PHASES = [
  {id:1,name:"Fase 1: Fundamentos",range:[1,30],color:"#3b82f6",icon:"🌱"},
  {id:2,name:"Fase 2: Prática Guiada",range:[31,60],color:"#10b981",icon:"⚡"},
  {id:3,name:"Fase 3: Projetos",range:[61,75],color:"#f59e0b",icon:"🚀"},
  {id:4,name:"Fase 4: Portfólio & Carreira",range:[76,90],color:"#8b5cf6",icon:"🏆"},
];

// ... (DAY_DATA, TABLES, runSQL, LIBRARY, PYTHON_EX, SQL_EX - COLE AQUI SEU CONTEÚDO ORIGINAL COMPLETO)

// [COLOQUE AQUI TODO O SEU CÓDIGO DA ETAPA ANTERIOR A PARTIR DO "AuthCtx"]

// ESSA É A PARTE QUE CORRIGE A TELA AZUL:
export default function App() {
  return (
    <AuthProvider>
      <ProgressProvider>
        <AppShell />
      </ProgressProvider>
    </AuthProvider>
  );
}

// Certifique-se de que a função principal no seu código se chame "AppShell" ou "DataPath" e esteja dentro deste export.
