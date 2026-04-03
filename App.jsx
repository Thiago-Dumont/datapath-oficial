import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";

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

const DB = {
  g: (k) => { try { return JSON.parse(localStorage.getItem("dp_"+k)||"null"); } catch { return null; }},
  s: (k,v) => { try { localStorage.setItem("dp_"+k, JSON.stringify(v)); } catch {} },
  users: () => DB.g("users") || {},
  setUsers: (u) => DB.s("users", u),
  progress: (id) => DB.g("prog_"+id) || {userId:id, xp:0, level:1, streak:0, completedDays:[], achievements:[], trackProgress:{python:0,sql:0,powerbi:0,english:0}},
  setProgress: (id,p) => DB.s("prog_"+id, p),
};

const calcLevel = (xp) => Math.floor(Math.sqrt(xp/100))+1;
const xpForLevel = (lvl) => (lvl-1)*(lvl-1)*100;
const xpForNext = (lvl) => lvl*lvl*100;

const ACHIEVEMENTS = [
  {id:"first",name:"Primeiro Passo",desc:"Concluiu o Dia 1",icon:"🌱",xp:50,cond:(p)=>p.completedDays.length>=1},
  {id:"lvl5",name:"Nível 5",desc:"Alcançou o nível 5",icon:"⭐",xp:200,cond:(p)=>p.level>=5},
];

const PHASES = [
  {id:1,name:"Fase 1: Fundamentos",range:[1,30],color:"#3b82f6",icon:"🌱"},
  {id:2,name:"Fase 2: Prática Guiada",range:[31,60],color:"#10b981",icon:"⚡"},
];

const DAY_DATA = [
  {day:1,title:"Bem-vindo à Jornada de Dados!",phase:1,xp:50,track:"python",mission:"Configure seu ambiente.",tasks:["GitHub","VS Code"],english:"Data driven",practice:"Hello World"},
  {day:2,title:"Python: Variáveis",phase:1,xp:60,track:"python",mission:"Aprenda tipos.",tasks:["int","str"],english:"Variable",practice:"Script básico"},
];

const AuthCtx = createContext(null);

function AuthProvider({children}) {
  const [user,setUser] = useState(null);
  const login = async (email,pw)=>{ const safe={id:"1",name:"Usuário",email}; setUser(safe); return {user:safe}; };
  const logout=()=>{ setUser(null); };
  return <AuthCtx.Provider value={{user,login,logout}}>{children}</AuthCtx.Provider>;
}

function ProgressProvider({children}) {
  const [progress,setProgress]=useState({xp:0,level:1,completedDays:[],streak:0});
  return <ProgCtx.Provider value={{progress}}>{children}</ProgCtx.Provider>;
}

const ProgCtx = createContext(null);
const useAuth=()=>useContext(AuthCtx);
const useProgress=()=>useContext(ProgCtx);

const C = { bg:"#020817", surface:"#0a1628", card:"#0f172a", border:"#1e293b", text:"#e2e8f0", accent:"#6366f1" };

function Landing({onLogin}) {
  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"sans-serif"}}>
      <h1 style={{fontSize:48,fontWeight:900,marginBottom:20}}>DataPath ⚡</h1>
      <p style={{color:"#64748b",marginBottom:30}}>Sua jornada de dados começa aqui.</p>
      <button onClick={onLogin} style={{padding:"12px 24px",background:C.accent,border:"none",borderRadius:8,color:"#fff",fontWeight:700,cursor:"pointer"}}>Começar Agora →</button>
    </div>
  );
}

function Dashboard() {
    return <div style={{padding:40,color:"#fff"}}><h1>Dashboard Ativo 🚀</h1><p>Bem-vindo ao DataPath oficial.</p></div>;
}

function AppRoot() {
  const [page,setPage]=useState("landing");
  const {user}=useAuth();
  useEffect(()=>{ if(user) setPage("app"); },[user]);

  return (
    <div style={{background:C.bg, minHeight:"100vh"}}>
      {page==="landing" && <Landing onLogin={()=>setPage("app")}/>}
      {page==="app" && <Dashboard/>}
    </div>
  );
}

export default function DataPath() {
  return (
    <AuthProvider>
      <AppRoot/>
    </AuthProvider>
  );
}
