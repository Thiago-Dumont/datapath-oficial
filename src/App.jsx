import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";

// ── SEGURANÇA & UTILITÁRIOS ─────────────────────────────────
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

// ── CORES DE ALTO CONTRASTE ──────────────────────────────────
const C = {
  bg: "#050507",
  surface: "#0f172a",
  card: "#1e293b",
  border: "#334155",
  border2: "#475569",
  text: "#f8fafc",
  muted: "#94a3b8",
  faint: "#64748b",
  accent: "#6366f1",
  accent2: "#8b5cf6",
  green: "#10b981",
  yellow: "#f59e0b",
  red: "#ef4444",
  blue: "#3b82f6",
};

// ── BANCO DE DADOS LOCAL ─────────────────────────────────────
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
  {id:1,name:"Estudar Python",streak:0,done:false,color:C.blue},
  {id:2,name:"Praticar SQL",streak:0,done:false,color:C.green},
  {id:3,name:"Inglês técnico",streak:0,done:false,color:C.yellow},
  {id:4,name:"Revisão do dia",streak:0,done:false,color:C.accent2},
]);

// ── GAMIFICAÇÃO ──────────────────────────────────────────────
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

const PHASES = [
  {id:1,name:"Fase 1: Fundamentos",range:[1,30],color:C.blue,icon:"🌱"},
  {id:2,name:"Fase 2: Prática Guiada",range:[31,60],color:C.green,icon:"⚡"},
  {id:3,name:"Fase 3: Projetos",range:[61,75],color:C.yellow,icon:"🚀"},
  {id:4,name:"Fase 4: Portfólio & Carreira",range:[76,90],color:C.accent2,icon:"🏆"},
];

// ── DADOS DA JORNADA (SIMULADO) ──────────────────────────────
const generateDayData = () => {
    let data = [];
    for(let i=1; i<=90; i++) {
        data.push({
            day: i,
            title: `Dia ${i}: ${i <= 30 ? "Fundamentos" : i <= 60 ? "Analítica" : "Especialização"}`,
            phase: i <= 30 ? 1 : i <= 60 ? 2 : i <= 75 ? 3 : 4,
            xp: 50 + (i * 2),
            track: i % 3 === 0 ? "sql" : i % 2 === 0 ? "python" : "powerbi",
            mission: `Missão técnica para o dia ${i}. Foque na prática e documentação.`,
            tasks: ["Estudar teoria", "Praticar exercícios", "Documentar no GitHub"],
            english: "Vocabulário técnico do dia.",
            practice: "Exercício prático de codificação."
        });
    }
    return data;
};
const DAY_DATA = generateDayData();

// ── CONTEXTOS ────────────────────────────────────────────────
const AuthCtx = createContext(null);
const ProgCtx = createContext(null);

function AuthProvider({children}) {
  const [user,setUser] = useState(null);
  const [loading,setLoading] = useState(true);

  useEffect(()=>{
    const tok = sessionStorage.getItem("dp_tok");
    if(tok) {
      const d = Security.verifyJWT(tok);
      if(d) { const u=DB.users()[d.sub]; if(u) setUser({...u,password:undefined}); }
    }
    setLoading(false);
  },[]);

  const login = async (email,pw)=>{
    const users=DB.users(), u=Object.values(users).find(u=>u.email===email.toLowerCase());
    if(!u) return {error:"Credenciais inválidas."};
    const h=await Security.hashPassword(pw);
    if(h!==u.password) return {error:"Credenciais inválidas."};
    const tok=Security.generateJWT(u.id);
    sessionStorage.setItem("dp_tok",tok);
    const safe={...u,password:undefined}; setUser(safe); return {user:safe};
  };

  const register = async (name,email,pw)=>{
    if(!Security.validateEmail(email)) return {error:"Email inválido."};
    if(!Security.validatePassword(pw)) return {error:"Senha inválida (8+ chars, A-Z, 0-9)."};
    const users=DB.users();
    if(Object.values(users).find(u=>u.email===email.toLowerCase())) return {error:"Email já existe."};
    const id=crypto.randomUUID(), h=await Security.hashPassword(pw);
    const nu={id,name:Security.sanitize(name),email:email.toLowerCase(),password:h};
    users[id]=nu; DB.setUsers(users); DB.setProgress(id,defProgress(id));
    const tok=Security.generateJWT(id);
    sessionStorage.setItem("dp_tok",tok);
    const safe={...nu,password:undefined}; setUser(safe); return {user:safe};
  };

  const logout=()=>{ sessionStorage.removeItem("dp_tok"); setUser(null); };

  return <AuthCtx.Provider value={{user,loading,login,register,logout}}>{children}</AuthCtx.Provider>;
}

function ProgressProvider({children}) {
  const {user}=useContext(AuthCtx);
  const [progress,setProgress]=useState(null);
  useEffect(()=>{ if(user) setProgress(DB.progress(user.id)); },[user]);

  const save=useCallback((upd)=>{
    if(!user) return;
    const cur=DB.progress(user.id);
    const updated={...cur,...upd}; updated.level=calcLevel(updated.xp);
    DB.setProgress(user.id,updated); setProgress(updated);
  },[user]);

  const completeDay=useCallback((dayNum,xpAmt)=>{
    if(!user || progress.completedDays.includes(dayNum)) return;
    const days=[...progress.completedDays,dayNum];
    save({completedDays:days, xp:progress.xp+xpAmt});
  },[user, progress, save]);

  return <ProgCtx.Provider value={{progress,save,completeDay}}>{children}</ProgCtx.Provider>;
}

// ── COMPONENTES UI PRIMITIVOS ────────────────────────────────
const XPBar = ({xp, level}) => {
    const lo=xpForLevel(level), hi=xpForNext(level);
    const pct=Math.min(100,((xp-lo)/(hi-lo))*100);
    return (
        <div style={{width:"100%", background:C.border, height:8, borderRadius:4, overflow:"hidden"}}>
            <div style={{width:`${pct}%`, background:C.accent, height:"100%", transition:"0.5s"}} />
        </div>
    );
};

const Card = ({children, sx={}}) => (
    <div style={{background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:20, ...sx}}>{children}</div>
);

const Btn = ({children, onClick, v="primary", sx={}}) => {
    const b = v === "primary" ? C.accent : "transparent";
    return (
        <button onClick={onClick} style={{
            background:b, color:C.text, border:v==="ghost"?`1px solid ${C.border}`:"none",
            padding:"10px 20px", borderRadius:8, cursor:"pointer", fontWeight:600, ...sx
        }}>{children}</button>
    );
};

// ── TELAS DO APP ─────────────────────────────────────────────

function AppShell({children, setPage}) {
    const {user, logout} = useContext(AuthCtx);
    const {progress} = useContext(ProgCtx);
    if(!progress) return null;

    const nav = [
        {id:"dash", l:"Dashboard", i:"🏠"},
        {id:"journey", l:"Jornada", i:"🗺️"},
        {id:"lib", l:"Biblioteca", i:"📚"},
        {id:"port", l:"Portfólio", i:"💼"}
    ];

    return (
        <div style={{display:"flex", minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"sans-serif"}}>
            <aside style={{width:260, background:C.surface, borderRight:`1px solid ${C.border}`, padding:20}}>
                <h2 style={{color:C.accent, marginBottom:30}}>DataPath ⚡</h2>
                <div style={{marginBottom:30}}>
                    <p style={{fontSize:14, fontWeight:700}}>{user.name}</p>
                    <p style={{fontSize:12, color:C.muted, marginBottom:10}}>Nível {progress.level}</p>
                    <XPBar xp={progress.xp} level={progress.level} />
                </div>
                <nav>
                    {nav.map(n => (
                        <div key={n.id} onClick={() => setPage(n.id)} style={{
                            padding:"12px", cursor:"pointer", borderRadius:8, marginBottom:5,
                            background: "transparent", ":hover": {background: C.card}
                        }}>{n.i} {n.l}</div>
                    ))}
                    <div onClick={logout} style={{padding:"12px", cursor:"pointer", color:C.red, marginTop:40}}>🚪 Sair</div>
                </nav>
            </aside>
            <main style={{flex:1, padding:40, overflowY:"auto"}}>{children}</main>
        </div>
    );
}

function Dashboard() {
    const {progress} = useContext(ProgCtx);
    const today = DAY_DATA[progress.completedDays.length];

    return (
        <div>
            <h1 style={{marginBottom:30}}>Dashboard 📊</h1>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:20, marginBottom:40}}>
                <Card><h3>XP Total</h3><p style={{fontSize:24, fontWeight:900, color:C.accent}}>{progress.xp}</p></Card>
                <Card><h3>Streak</h3><p style={{fontSize:24, fontWeight:900, color:C.orange}}>{progress.streak} dias</p></Card>
                <Card><h3>Nível</h3><p style={{fontSize:24, fontWeight:900, color:C.green}}>{progress.level}</p></Card>
            </div>
            <Card sx={{border:`1px solid ${C.accent}55`}}>
                <h2 style={{marginBottom:10}}>🔥 Próximo Passo: Dia {today.day}</h2>
                <h3 style={{color:C.muted, marginBottom:20}}>{today.title}</h3>
                <p style={{marginBottom:20}}>{today.mission}</p>
                <Btn>Ir para Jornada</Btn>
            </Card>
        </div>
    );
}

// ── COMPONENTE RAIZ ──────────────────────────────────────────

export default function DataPathFull() {
    const [page, setPage] = useState("dash");
    const [authMode, setAuthMode] = useState("login");

    return (
        <AuthProvider>
            <ProgressProvider>
                <AuthWrapper page={page} setPage={setPage} authMode={authMode} setAuthMode={setAuthMode} />
            </ProgressProvider>
        </AuthProvider>
    );
}

function AuthWrapper({page, setPage, authMode, setAuthMode}) {
    const {user, login, register, loading} = useContext(AuthCtx);
    const [form, setForm] = useState({name:"", email:"", pw:""});

    if(loading) return <div style={{background:C.bg, height:"100vh"}} />;

    if(!user) {
        return (
            <div style={{background:C.bg, height:"100vh", display:"flex", alignItems:"center", justifyContent:"center"}}>
                <Card sx={{width:360}}>
                    <h2 style={{textAlign:"center", color:C.accent, marginBottom:30}}>DataPath ⚡</h2>
                    {authMode === "reg" && <input placeholder="Nome" onChange={e=>setForm({...form, name:e.target.value})} style={inpS} />}
                    <input placeholder="Email" onChange={e=>setForm({...form, email:e.target.value})} style={inpS} />
                    <input type="password" placeholder="Senha" onChange={e=>setForm({...form, pw:e.target.value})} style={inpS} />
                    <Btn sx={{width:"100%"}} onClick={() => authMode === "login" ? login(form.email, form.pw) : register(form.name, form.email, form.pw)}>
                        {authMode === "login" ? "Entrar" : "Criar Conta"}
                    </Btn>
                    <p onClick={() => setAuthMode(authMode === "login" ? "reg" : "login")} style={{textAlign:"center", marginTop:20, cursor:"pointer", color:C.muted}}>
                        {authMode === "login" ? "Novo por aqui? Cadastre-se" : "Já tem conta? Login"}
                    </p>
                </Card>
            </div>
        );
    }

    return (
        <AppShell setPage={setPage}>
            {page === "dash" && <Dashboard />}
            {page === "journey" && <div><h2>Jornada de 90 Dias</h2><p>Conteúdo em desenvolvimento...</p></div>}
            {page === "lib" && <div><h2>Biblioteca Técnica</h2><p>Recursos e Documentação...</p></div>}
            {page === "port" && <div><h2>Portfólio de Projetos</h2><p>Gerencie seus cases...</p></div>}
        </AppShell>
    );
}

const inpS = {width:"100%", padding:12, marginBottom:15, background:C.surface, border:`1px solid ${C.border}`, color:"white", borderRadius:8, boxSizing:"border-box"};
