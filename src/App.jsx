import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";

// ── CONFIGURAÇÕES DE CORES (ALTO CONTRASTE) ──────────────────
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

// ── LÓGICA DE SEGURANÇA ──────────────────────────────────────
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

// ── BANCO DE DADOS LOCAL ─────────────────────────────────────
const DB = {
  g: (k) => { try { return JSON.parse(localStorage.getItem("dp_"+k)||"null"); } catch { return null; }},
  s: (k,v) => { try { localStorage.setItem("dp_"+k, JSON.stringify(v)); } catch {} },
  users: () => DB.g("users") || {},
  setUsers: (u) => DB.s("users", u),
  progress: (id) => DB.g("prog_"+id) || {userId:id, xp:0, level:1, streak:0, completedDays:[], achievements:[], trackProgress:{python:0,sql:0,powerbi:0,english:0}},
  setProgress: (id,p) => DB.s("prog_"+id, p),
  notes: (id) => DB.g("notes_"+id) || [],
  setNotes: (id,n) => DB.s("notes_"+id, n),
  portfolio: (id) => DB.g("pf_"+id) || [],
  setPortfolio: (id,p) => DB.s("pf_"+id, p),
};

// ── CONTEXTOS GLOBAIS ────────────────────────────────────────
const AuthCtx = createContext(null);
const ProgCtx = createContext(null);

// ── COMPONENTES DE INTERFACE ─────────────────────────────────
const XPBar = ({xp, level}) => {
  const hi = level * level * 100;
  const pct = Math.min(100, (xp / hi) * 100);
  return (
    <div style={{width:"100%", background:C.border, height:8, borderRadius:4, overflow:"hidden"}}>
      <div style={{width:`${pct}%`, background:C.accent, height:"100%", transition:"0.5s"}} />
    </div>
  );
};

// ── CONTEÚDO DA JORNADA (90 DIAS) ───────────────────────────
const DAY_DATA = Array.from({length: 90}, (_, i) => ({
  day: i + 1,
  title: i < 30 ? "Fase 1: Fundamentos" : i < 60 ? "Fase 2: Analítica" : "Fase 3: Projetos",
  xp: 50 + (i * 2),
  mission: `Missão do Dia ${i+1}: Aplique os conceitos aprendidos em um projeto real de dados.`,
  tasks: ["Revisar teoria", "Praticar no Sandbox", "Subir para o GitHub"],
  english: "Vocabulário técnico e expressões para entrevistas.",
  practice: "Exercício prático: Manipulação de tabelas e filtros."
}));

// ── COMPONENTE DE LOGIN/CADASTRO ─────────────────────────────
function AuthScreen({isLogin, setIsLogin}) {
  const {login, register} = useContext(AuthCtx);
  const [f, setF] = useState({name:"", email:"", pw:""});

  return (
    <div style={{background:C.bg, height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", color:C.text}}>
      <div style={{background:C.card, padding:40, borderRadius:20, width:350, border:`1px solid ${C.border}`, textAlign:"center"}}>
        <h2 style={{color:C.accent, marginBottom:30, fontSize:28, fontWeight:900}}>DataPath ⚡</h2>
        {!isLogin && <input placeholder="Nome" onChange={e=>setF({...f, name:e.target.value})} style={inpS} />}
        <input placeholder="Email" onChange={e=>setF({...f, email:e.target.value})} style={inpS} />
        <input type="password" placeholder="Senha" onChange={e=>setF({...f, pw:e.target.value})} style={inpS} />
        <button onClick={()=>isLogin?login(f.email,f.pw):register(f.name,f.email,f.pw)} style={btnS}>
          {isLogin ? "Entrar" : "Começar Jornada"}
        </button>
        <p onClick={()=>setIsLogin(!isLogin)} style={{marginTop:20, cursor:"pointer", color:C.muted}}>
          {isLogin ? "Não tem conta? Registre-se" : "Já tem conta? Faça Login"}
        </p>
      </div>
    </div>
  );
}

// ── DASHBOARD PRINCIPAL ──────────────────────────────────────
function Dashboard({setPage}) {
  const {user, logout} = useContext(AuthCtx);
  const {progress} = useContext(ProgCtx);
  if(!progress) return null;

  return (
    <div style={{padding:40, maxWidth:1100, margin:"0 auto"}}>
      <header style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:40}}>
        <div>
          <h1 style={{fontSize:32, fontWeight:900}}>Olá, {user.name}! 👋</h1>
          <p style={{color:C.muted}}>Você está no Nível {progress.level} · {progress.xp} XP acumulados</p>
        </div>
        <button onClick={logout} style={{background:C.card, color:C.red, border:`1px solid ${C.red}55`, padding:"10px 20px", borderRadius:8, cursor:"pointer"}}>Sair</button>
      </header>

      <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(300px, 1fr))", gap:25}}>
        <div style={{background:C.card, padding:30, borderRadius:15, border:`1px solid ${C.border}`}}>
          <h3 style={{color:C.accent, marginBottom:10}}>📍 Próxima Parada</h3>
          <p style={{fontSize:22, fontWeight:800}}>Dia {progress.completedDays.length + 1}</p>
          <p style={{color:C.muted, marginTop:10, marginBottom:20}}>Foque na sua trilha de Python e SQL hoje.</p>
          <button onClick={()=>setPage("journey")} style={btnS}>Continuar 🚀</button>
        </div>

        <div style={{background:C.card, padding:30, borderRadius:15, border:`1px solid ${C.border}`}}>
          <h3 style={{color:C.green, marginBottom:10}}>🔥 Sua Sequência</h3>
          <p style={{fontSize:48, fontWeight:900}}>{progress.streak} Dias</p>
          <XPBar xp={progress.xp} level={progress.level} />
        </div>
      </div>
    </div>
  );
}

// ── APLICATIVO RAIZ ──────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState("dash");
  const [isLogin, setIsLogin] = useState(true);

  useEffect(() => {
    const tok = sessionStorage.getItem("dp_tok");
    if (tok) {
      const d = Security.verifyJWT(tok);
      if (d) {
        const u = DB.users()[d.sub];
        if (u) {
          setUser({...u, password: undefined});
          setProgress(DB.progress(u.id));
        }
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, pw) => {
    const u = Object.values(DB.users()).find(u => u.email === email.toLowerCase());
    if (!u) return alert("Usuário não encontrado.");
    const h = await Security.hashPassword(pw);
    if (h !== u.password) return alert("Senha incorreta.");
    sessionStorage.setItem("dp_tok", Security.generateJWT(u.id));
    setUser({...u, password: undefined});
    setProgress(DB.progress(u.id));
  };

  const register = async (name, email, pw) => {
    if (!Security.validatePassword(pw)) return alert("Senha deve ter 8+ caracteres, 1 maiúscula e 1 número.");
    const id = crypto.randomUUID();
    const h = await Security.hashPassword(pw);
    const users = DB.users();
    users[id] = {id, name, email: email.toLowerCase(), password: h};
    DB.setUsers(users);
    sessionStorage.setItem("dp_tok", Security.generateJWT(id));
    setUser({id, name, email});
    setProgress(DB.progress(id));
  };

  const logout = () => { sessionStorage.removeItem("dp_tok"); setUser(null); };

  if (loading) return <div style={{background:C.bg, height:"100vh"}} />;
  if (!user) return <AuthScreen isLogin={isLogin} setIsLogin={setIsLogin} login={login} register={register} />;

  return (
    <AuthCtx.Provider value={{user, login, register, logout}}>
      <ProgCtx.Provider value={{progress}}>
        <div style={{background:C.bg, minHeight:"100vh", color:C.text, fontFamily:"'Outfit', sans-serif"}}>
          <Dashboard setPage={setPage} />
        </div>
      </ProgCtx.Provider>
    </AuthCtx.Provider>
  );
}

const inpS = {width:"100%", padding:14, marginBottom:15, borderRadius:10, border:`1px solid ${C.border}`, background:C.surface, color:"white", boxSizing:"border-box", fontSize:16};
const btnS = {width:"100%", padding:14, borderRadius:10, border:"none", background:C.accent, color:"white", fontWeight:700, cursor:"pointer", fontSize:16};
