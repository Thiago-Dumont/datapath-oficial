import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";

// ============================================================
// DATAPATH — PLATAFORMA DE ENSINO GAMIFICADO PARA DADOS
// Design: Dark Mode de Alto Contraste (Cores corrigidas)
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

// ── CORES (CORRIGIDAS PARA ALTO CONTRASTE) ─────────────────────
const C = {
  bg: "#050507",        // Fundo quase preto (máximo contraste)
  surface: "#111827",   // Azul marinho muito escuro para áreas de destaque
  card: "#1f2937",      // Cinza azulado escuro para cards (visível sobre o fundo)
  border: "#374151",    // Borda clara para separar os elementos
  border2: "#4b5563",
  text: "#f9fafb",      // Branco puro para leitura
  muted: "#9ca3af",     // Cinza para textos secundários
  faint: "#6b7280",
  accent: "#6366f1",    // Indigo (Destaque principal)
  accent2: "#a855f7",   // Roxo (Conquistas)
  green: "#10b981", 
  yellow: "#f59e0b", 
  red: "#ef4444", 
  blue: "#3b82f6",
};

// ── BANCO DE DADOS (LOCALSTORAGE) ─────────────────────────────
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
];

const PHASES = [
  {id:1,name:"Fase 1: Fundamentos",range:[1,30],color:C.blue,icon:"🌱"},
  {id:2,name:"Fase 2: Prática Guiada",range:[31,60],color:C.green,icon:"⚡"},
  {id:3,name:"Fase 3: Projetos",range:[61,75],color:C.yellow,icon:"🚀"},
  {id:4,name:"Fase 4: Carreira",range:[76,90],color:C.accent2,icon:"🏆"},
];

// Dados dos Dias (Exemplo reduzido para performance)
const DAY_DATA = [
  {day:1,title:"Bem-vindo à Jornada!",phase:1,xp:50,track:"python",mission:"Configure seu ambiente e inicie sua trilha.",tasks:["Instalar VS Code","Criar conta GitHub","Entender a trilha"],english:"Vocabulário: 'Data', 'Pipeline', 'Insight'",practice:"Escreva seu primeiro 'Hello World'"},
  {day:2,title:"Python: Variáveis",phase:1,xp:60,track:"python",mission:"Aprenda tipos de dados básicos.",tasks:["int, str, float","Operadores básicos"],english:"Terms: 'String', 'Integer'",practice:"Crie um script de saudação"},
  // Adicione mais dias conforme necessário seguindo o padrão
];

// ── CONTEXTOS ─────────────────────────────────────────────────
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
    if(h!==u.password) return {error:"Senha incorreta."};
    const tok=Security.generateJWT(u.id);
    sessionStorage.setItem("dp_tok",tok);
    setUser({...u,password:undefined}); return {success:true};
  };

  const register = async (name,email,pw)=>{
    if(!Security.validatePassword(pw)) return {error:"Senha deve ter 8+ chars, 1 maiúscula e 1 número."};
    const id=crypto.randomUUID(), h=await Security.hashPassword(pw);
    const users=DB.users();
    users[id]={id,name,email:email.toLowerCase(),password:h};
    DB.setUsers(users);
    const tok=Security.generateJWT(id);
    sessionStorage.setItem("dp_tok",tok);
    setUser({id,name,email}); return {success:true};
  };

  const logout=()=>{ sessionStorage.removeItem("dp_tok"); setUser(null); };

  return <AuthCtx.Provider value={{user,loading,login,register,logout}}>{children}</AuthCtx.Provider>;
}

function ProgressProvider({children}) {
  const {user}=useContext(AuthCtx);
  const [progress,setProgress]=useState(null);
  useEffect(()=>{ if(user) setProgress(DB.progress(user.id)); },[user]);

  const completeDay=(dayNum,xpAmt)=>{
    if(!user) return;
    const cur=DB.progress(user.id);
    if(cur.completedDays.includes(dayNum)) return;
    const upd={...cur, completedDays:[...cur.completedDays, dayNum], xp: cur.xp+xpAmt};
    upd.level = calcLevel(upd.xp);
    DB.setProgress(user.id, upd); setProgress(upd);
  };

  return <ProgCtx.Provider value={{progress,completeDay}}>{children}</ProgCtx.Provider>;
}

// ── COMPONENTES UI ────────────────────────────────────────────

function Card({children, sx={}}) {
  return <div style={{background:C.card, borderRadius:12, padding:20, border:`1px solid ${C.border}`, ...sx}}>{children}</div>;
}

function Btn({children, onClick, v="primary"}) {
  const styles = {
    primary: {background:C.accent, color:"white"},
    ghost: {background:"transparent", border:`1px solid ${C.border}`, color:C.text}
  };
  return (
    <button onClick={onClick} style={{padding:"10px 20px", borderRadius:8, cursor:"pointer", fontWeight:600, border:"none", ...styles[v]}}>
      {children}
    </button>
  );
}

// ── APP PRINCIPAL ─────────────────────────────────────────────

function Dashboard() {
  const {user, logout} = useContext(AuthCtx);
  const {progress} = useContext(ProgCtx);

  if(!progress) return null;

  return (
    <div style={{padding:40, maxWidth:1200, margin:"0 auto"}}>
      <header style={{display:"flex", justifyContent:"space-between", marginBottom:30}}>
        <div>
          <h1 style={{fontSize:28, fontWeight:900, color:C.text}}>Bem-vindo, {user.name}! ⚡</h1>
          <p style={{color:C.muted}}>Nível {progress.level} · {progress.xp} XP acumulados</p>
        </div>
        <Btn onClick={logout} v="ghost">Sair</Btn>
      </header>

      <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(300px, 1fr))", gap:20}}>
        <Card>
          <h3 style={{color:C.accent, marginBottom:10}}>🚀 Próxima Missão</h3>
          <p style={{fontSize:18, fontWeight:700, marginBottom:5}}>Dia {progress.completedDays.length + 1}</p>
          <p style={{color:C.muted, marginBottom:20}}>Domine os fundamentos iniciais de Python para análise de dados.</p>
          <Btn>Continuar Jornada</Btn>
        </Card>

        <Card>
          <h3 style={{color:C.green, marginBottom:10}}>🔥 Streak Atual</h3>
          <p style={{fontSize:40, fontWeight:900}}>{progress.streak} Dias</p>
          <p style={{color:C.muted}}>Não perca o foco hoje!</p>
        </Card>
      </div>

      <div style={{marginTop:40}}>
        <h3 style={{marginBottom:20, fontWeight:800}}>🏆 Conquistas Recentes</h3>
        <div style={{display:"flex", gap:15}}>
          {ACHIEVEMENTS.slice(0,3).map(ach => (
            <div key={ach.id} style={{background:C.surface, padding:15, borderRadius:12, textAlign:"center", width:150, border:`1px solid ${C.border}`}}>
              <span style={{fontSize:30}}>{ach.icon}</span>
              <p style={{fontSize:12, fontWeight:700, marginTop:5}}>{ach.name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────

export default function DataPath() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <AuthProvider>
      <ProgressProvider>
        <AuthConsumer setIsLogin={setIsLogin} isLogin={isLogin} />
      </ProgressProvider>
    </AuthProvider>
  );
}

function AuthConsumer({setIsLogin, isLogin}) {
  const {user, login, register, loading} = useContext(AuthCtx);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");

  if(loading) return <div style={{color:C.text, textAlign:"center", marginTop:100}}>Carregando...</div>;
  if(user) return <div style={{background:C.bg, minHeight:"100vh", color:C.text}}><Dashboard /></div>;

  return (
    <div style={{background:C.bg, minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", color:C.text, fontFamily:"sans-serif"}}>
      <div style={{background:C.card, padding:40, borderRadius:20, width:400, border:`1px solid ${C.border}`}}>
        <h2 style={{textAlign:"center", marginBottom:30, fontWeight:900, color:C.accent}}>{isLogin ? "Login DataPath" : "Criar Conta"}</h2>
        {!isLogin && <input placeholder="Nome" onChange={e=>setName(e.target.value)} style={inpStyle} />}
        <input placeholder="Email" onChange={e=>setEmail(e.target.value)} style={inpStyle} />
        <input type="password" placeholder="Senha" onChange={e=>setPw(e.target.value)} style={inpStyle} />
        <button onClick={()=>isLogin?login(email,pw):register(name,email,pw)} style={btnStyle}>
          {isLogin ? "Entrar" : "Cadastrar"}
        </button>
        <p onClick={()=>setIsLogin(!isLogin)} style={{textAlign:"center", marginTop:20, cursor:"pointer", color:C.muted, fontSize:14}}>
          {isLogin ? "Não tem conta? Cadastre-se" : "Já tem conta? Faça Login"}
        </p>
      </div>
    </div>
  );
}

const inpStyle = {width:"100%", padding:12, marginBottom:15, borderRadius:8, border:`1px solid ${C.border}`, background:C.surface, color:"white", boxSizing:"border-box"};
const btnStyle = {width:"100%", padding:12, borderRadius:8, border:"none", background:C.accent, color:"white", fontWeight:700, cursor:"pointer"};

