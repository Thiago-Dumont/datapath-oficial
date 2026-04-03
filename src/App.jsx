import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";

// ============================================================
// DATAPATH — PLATAFORMA DE ENSINO GAMIFICADO PARA DADOS
// Design: Dark Mode de Alto Contraste
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
  }
};

// ── CORES (CORRIGIDAS) ───────────────────────────────────────
const C = {
  bg: "#050507",
  surface: "#111827",
  card: "#1f2937",
  border: "#374151",
  border2: "#4b5563",
  text: "#f9fafb",
  muted: "#9ca3af",
  faint: "#6b7280",
  accent: "#6366f1",
  accent2: "#a855f7",
  green: "#10b981", 
  yellow: "#f59e0b", 
  red: "#ef4444", 
  blue: "#3b82f6"
};

// ── BANCO DE DADOS ───────────────────────────────────────────
const DB = {
  g: (k) => { try { return JSON.parse(localStorage.getItem("dp_"+k)||"null"); } catch { return null; }},
  s: (k,v) => { try { localStorage.setItem("dp_"+k, JSON.stringify(v)); } catch {} },
  users: () => DB.g("users") || {},
  setUsers: (u) => DB.s("users", u),
  progress: (id) => DB.g("prog_"+id) || {userId:id, xp:0, level:1, streak:0, completedDays:[], achievements:[]},
  setProgress: (id,p) => DB.s("prog_"+id, p)
};

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
    if(!u) return alert("Usuario nao encontrado");
    const h=await Security.hashPassword(pw);
    if(h!==u.password) return alert("Senha incorreta");
    const tok=Security.generateJWT(u.id);
    sessionStorage.setItem("dp_tok",tok);
    setUser({...u,password:undefined});
  };

  const register = async (name,email,pw)=>{
    if(!Security.validatePassword(pw)) return alert("Senha fraca!");
    const id=crypto.randomUUID(), h=await Security.hashPassword(pw);
    const users=DB.users();
    users[id]={id,name,email:email.toLowerCase(),password:h};
    DB.setUsers(users);
    const tok=Security.generateJWT(id);
    sessionStorage.setItem("dp_tok",tok);
    setUser({id,name,email});
  };

  const logout=()=>{ sessionStorage.removeItem("dp_tok"); setUser(null); };

  return <AuthCtx.Provider value={{user,loading,login,register,logout}}>{children}</AuthCtx.Provider>;
}

function ProgressProvider({children}) {
  const {user}=useContext(AuthCtx);
  const [progress,setProgress]=useState(null);
  useEffect(()=>{ if(user) setProgress(DB.progress(user.id)); },[user]);

  return <ProgCtx.Provider value={{progress}}>{children}</ProgCtx.Provider>;
}

// ── COMPONENTES UI ───────────────────────────────────────────

function Dashboard() {
  const {user, logout} = useContext(AuthCtx);
  const {progress} = useContext(ProgCtx);

  if(!progress) return null;

  return (
    <div style={{padding:40, maxWidth:1200, margin:"0 auto", color:C.text}}>
      <header style={{display:"flex", justifyContent:"space-between", marginBottom:30}}>
        <div>
          <h1 style={{fontSize:28, fontWeight:900}}>Ola, {user.name}! ⚡</h1>
          <p style={{color:C.muted}}>Nivel {progress.level} · {progress.xp} XP</p>
        </div>
        <button onClick={logout} style={{padding:"10px 20px", borderRadius:8, background:C.card, color:"white", border:`1px solid ${C.border}`, cursor:"pointer"}}>Sair</button>
      </header>

      <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(300px, 1fr))", gap:20}}>
        <div style={{background:C.card, padding:25, borderRadius:15, border:`1px solid ${C.border}`}}>
          <h3 style={{color:C.accent, marginBottom:10}}>🚀 Proxima Missao</h3>
          <p style={{fontSize:20, fontWeight:700}}>Dia {progress.completedDays.length + 1}</p>
          <p style={{color:C.muted, marginTop:10}}>Continue sua jornada de dados hoje.</p>
        </div>
        <div style={{background:C.card, padding:25, borderRadius:15, border:`1px solid ${C.border}`}}>
          <h3 style={{color:C.green, marginBottom:10}}>🔥 Streak</h3>
          <p style={{fontSize:40, fontWeight:900}}>{progress.streak} Dias</p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
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

  if(loading) return <div style={{color:"white", textAlign:"center", marginTop:100}}>Carregando...</div>;
  if(user) return <div style={{background:C.bg, minHeight:"100vh"}}><Dashboard /></div>;

  return (
    <div style={{background:C.bg, minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontFamily:"sans-serif"}}>
      <div style={{background:C.card, padding:40, borderRadius:20, width:350, border:`1px solid ${C.border}`}}>
        <h2 style={{textAlign:"center", marginBottom:30, color:C.accent}}>DataPath Oficial</h2>
        {!isLogin && <input placeholder="Nome" onChange={e=>setName(e.target.value)} style={inpStyle} />}
        <input placeholder="Email" onChange={e=>setEmail(e.target.value)} style={inpStyle} />
        <input type="password" placeholder="Senha" onChange={e=>setPw(e.target.value)} style={inpStyle} />
        <button onClick={()=>isLogin?login(email,pw):register(name,email,pw)} style={btnStyle}>
          {isLogin ? "Entrar" : "Cadastrar"}
        </button>
        <p onClick={()=>setIsLogin(!isLogin)} style={{textAlign:"center", marginTop:20, cursor:"pointer", color:C.muted}}>
          {isLogin ? "Nao tem conta? Registre-se" : "Ja tem conta? Login"}
        </p>
      </div>
    </div>
  );
}

const inpStyle = {width:"100%", padding:12, marginBottom:15, borderRadius:8, border:`1px solid ${C.border}`, background:C.surface, color:"white", boxSizing:"border-box"};
const btnStyle = {width:"100%", padding:12, borderRadius:8, border:"none", background:C.accent, color:"white", fontWeight:700, cursor:"pointer"};
