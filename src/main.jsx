// Acessando as funções do React diretamente (substitui o import inicial)
const { useState, useEffect, useCallback, useRef, createContext, useContext } = React;

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

const DAY_DATA = [
  {day:1,title:"Bem-vindo à Jornada de Dados!",phase:1,xp:50,track:"python",mission:"Configure seu ambiente e entenda a jornada que você está iniciando.",tasks:["Leia o guia de boas-vindas","Configure o VS Code com Python","Crie sua conta no GitHub","Defina sua meta de carreira por escrito"],english:"Vocabulário: 'data analyst', 'dataset', 'pipeline', 'insight', 'data-driven'",practice:"Escreva no bloco de notas: por que você quer trabalhar com dados?"},
  {day:2,title:"Python: Variáveis e Tipos",phase:1,xp:60,track:"python",mission:"Domine variáveis e tipos de dados em Python.",tasks:["Estude int, str, float, bool","Crie variáveis dos 4 tipos","Pratique type() e print()","Resolva 3 exercícios"],english:"Vocabulário: 'variable', 'string', 'integer', 'boolean', 'output'",practice:"Script com seu nome, idade e objetivo profissional."},
  {day:3,title:"Python: Operadores",phase:1,xp:60,track:"python",mission:"Domine operadores aritméticos, lógicos e de comparação.",tasks:["Operadores aritméticos (+,-,*,/,**)","Operadores de comparação","Operadores lógicos (and, or, not)","Crie calculadora básica"],english:"Vocabulário: 'operator', 'expression', 'comparison', 'boolean logic'",practice:"Calculadora de IMC em Python."},
  {day:4,title:"Python: Condicionais",phase:1,xp:70,track:"python",mission:"Aprenda if, elif e else para controle de fluxo.",tasks:["if / elif / else básico","Condicionais aninhados","Classificador de notas","Verificador de faixa salarial"],english:"Vocabulário: 'conditional', 'flow control', 'nested', 'if statement'",practice:"Classificador de senioridade por anos de experiência."},
  {day:5,title:"Python: Laços (for e while)",phase:1,xp:70,track:"python",mission:"Domine laços para automação e repetição.",tasks:["for com range()","while básico","break e continue","Tabuada automática"],english:"Vocabulário: 'loop', 'iteration', 'range', 'break', 'continue'",practice:"Gerador de relatório fictício de vendas."},
  {day:6,title:"SQL: Primeiros Passos",phase:1,xp:60,track:"sql",mission:"Entenda bancos de dados relacionais e faça seus primeiros SELECTs.",tasks:["O que é banco relacional?","Tabelas, linhas e colunas","SELECT * FROM tabela","5 queries no sandbox"],english:"Vocabulário: 'query', 'table', 'row', 'column', 'schema'",practice:"Execute queries básicas no banco demo da plataforma."},
  {day:7,title:"Revisão — Semana 1 🎉",phase:1,xp:80,track:"python",mission:"Revise a semana 1 e construa seu primeiro mini projeto.",tasks:["Revise: variáveis, operadores, condicionais, laços","Revise: SELECT básico","Mini projeto: analisador de lista de vendas","Commit no GitHub"],english:"Monte seu glossário pessoal da semana.",practice:"Script que lê uma lista, calcula média e exibe relatório."},
  {day:8,title:"Python: Funções",phase:1,xp:70,track:"python",mission:"Crie funções reutilizáveis para organizar seu código.",tasks:["def e return","Parâmetros e argumentos","Valores padrão","Refatore código anterior"],english:"Vocabulário: 'function', 'parameter', 'return value', 'scope'",practice:"Biblioteca de funções estatísticas sem pandas."},
  {day:9,title:"Python: Listas",phase:1,xp:70,track:"python",mission:"Domine listas para trabalhar com coleções de dados.",tasks:["Criação e indexação","Slicing e iteração","List comprehension","append, sort, filter, map"],english:"Vocabulário: 'list', 'index', 'slice', 'iteration', 'comprehension'",practice:"Análise de lista com 20 salários fictícios."},
  {day:10,title:"Python: Dicionários",phase:1,xp:70,track:"python",mission:"Use dicionários para estruturar dados com chave-valor.",tasks:["Criação e acesso","Iterar sobre dict","Dicionários aninhados","Exercício: dados de funcionários"],english:"Vocabulário: 'dictionary', 'key-value', 'hash map', 'nested'",practice:"Dicionário de 10 funcionários com relatório de salários."},
  {day:11,title:"SQL: WHERE e Filtros",phase:1,xp:65,track:"sql",mission:"Filtre dados com WHERE, AND, OR e operadores.",tasks:["WHERE básico","AND e OR","BETWEEN e IN","LIKE para texto"],english:"Vocabulário: 'filter', 'condition', 'wildcard', 'pattern matching'",practice:"Filtre produtos por categoria e faixa de preço."},
  {day:12,title:"Python: Strings",phase:1,xp:65,track:"python",mission:"Manipule strings para limpeza e processamento de dados.",tasks:["upper, lower, strip, split","replace e find","f-strings","Limpeza de dados textuais"],english:"Vocabulário: 'string manipulation', 'parsing', 'cleaning', 'normalize'",practice:"Normalize lista de nomes de clientes."},
  {day:13,title:"SQL: ORDER BY e LIMIT",phase:1,xp:60,track:"sql",mission:"Ordene e limite resultados para análises focadas.",tasks:["ORDER BY ASC e DESC","LIMIT e OFFSET","Múltiplas colunas","Top N análises"],english:"Vocabulário: 'sort', 'ascending', 'descending', 'offset', 'paginate'",practice:"Top 3 produtos mais caros e análise de ranking."},
  {day:14,title:"Revisão — Semana 2",phase:1,xp:80,track:"python",mission:"Revise semana 2 e crie exercício integrado.",tasks:["Revise: funções, listas, dicionários","Revise: WHERE, ORDER BY","Exercício integrado Python+SQL","GitHub atualizado"],english:"Frases técnicas com vocabulário das 2 semanas.",practice:"Script Python que simula queries SQL com dicionários."},
  {day:15,title:"Python: Tratamento de Erros",phase:1,xp:70,track:"python",mission:"Crie código robusto com try/except.",tasks:["try/except básico","Múltiplos erros","finally e raise","Funções com tratamento"],english:"Vocabulário: 'exception', 'error handling', 'raise', 'debug', 'traceback'",practice:"Adicione robustez ao projeto de vendas."},
  {day:16,title:"SQL: GROUP BY",phase:1,xp:70,track:"sql",mission:"Agrupe dados para análises poderosas.",tasks:["GROUP BY básico","COUNT, SUM, AVG, MAX, MIN","GROUP BY + WHERE","HAVING clause"],english:"Vocabulário: 'aggregate', 'group by', 'having', 'count', 'sum'",practice:"Total de vendas por categoria no sandbox."},
  {day:17,title:"Python: Arquivos e CSV",phase:1,xp:75,track:"python",mission:"Leia e escreva arquivos CSV com Python.",tasks:["open() e with","csv.reader e writer","Leitura de CSV real","Geração de relatório CSV"],english:"Vocabulário: 'file handling', 'CSV', 'read', 'write', 'encoding'",practice:"Leia um CSV e gere relatório de análise."},
  {day:18,title:"SQL: JOINs Básicos",phase:1,xp:75,track:"sql",mission:"Una tabelas com INNER JOIN e LEFT JOIN.",tasks:["O que são JOINs?","INNER JOIN","LEFT JOIN","Exercício: clientes + pedidos"],english:"Vocabulário: 'join', 'relationship', 'foreign key', 'primary key'",practice:"Una clientes e vendas no sandbox."},
  {day:19,title:"Python: Pandas — Introdução",phase:1,xp:80,track:"python",mission:"Comece a trabalhar com DataFrames pandas.",tasks:["import pandas as pd","pd.DataFrame()","Leitura de CSV com pandas","df.head(), info(), describe()"],english:"Vocabulário: 'DataFrame', 'Series', 'index', 'column', 'shape'",practice:"Carregue e explore um dataset de vendas."},
  {day:20,title:"Revisão — Semana 3",phase:1,xp:85,track:"python",mission:"Revise semana 3 e construa análise completa.",tasks:["Revise: arquivos, pandas intro","Revise: JOINs e GROUP BY","Mini projeto: análise CSV completa","Documente no GitHub"],english:"Frases de apresentação de projeto de dados.",practice:"Análise exploratória completa de dataset fictício."},
];

const TABLES = {
  produtos:[
    {id:1,nome:"Laptop Pro",categoria:"Tech",preco:3500,estoque:10},
    {id:2,nome:"Monitor 4K",categoria:"Tech",preco:1200,estoque:25},
    {id:3,nome:"Teclado Mecânico",categoria:"Periféricos",preco:350,estoque:50},
    {id:4,nome:"Mouse Gamer",categoria:"Periféricos",preco:180,estoque:80},
    {id:5,nome:"Headset BT",categoria:"Audio",preco:250,estoque:30},
    {id:6,nome:"Webcam HD",categoria:"Tech",preco:420,estoque:20},
  ],
  vendas:[
    {id:1,produto:"Laptop Pro",vendedor:"Ana",valor:3500,data:"2024-01-15",categoria:"Tech"},
    {id:2,produto:"Monitor 4K",vendedor:"João",valor:1200,data:"2024-01-16",categoria:"Tech"},
    {id:3,produto:"Teclado",vendedor:"Ana",valor:350,data:"2024-01-17",categoria:"Periféricos"},
    {id:4,produto:"Mouse",vendedor:"Maria",valor:180,data:"2024-01-18",categoria:"Periféricos"},
    {id:5,produto:"Headset",vendedor:"João",valor:250,data:"2024-01-19",categoria:"Audio"},
    {id:6,produto:"Webcam",vendedor:"Maria",valor:420,data:"2024-02-01",categoria:"Tech"},
  ],
  clientes:[
    {id:1,nome:"Carlos Silva",cidade:"São Paulo",plano:"Premium"},
    {id:2,nome:"Ana Lima",cidade:"Rio de Janeiro",plano:"Básico"},
    {id:3,nome:"Pedro Souza",cidade:"Curitiba",plano:"Premium"},
    {id:4,nome:"Julia Martins",cidade:"São Paulo",plano:"Básico"},
  ],
};

function runSQL(q) {
  const ql = q.toLowerCase().trim();
  if (!ql.startsWith("select")) return {error:"Apenas SELECT é permitido no sandbox."};
  let rows = [];
  if (ql.includes("from produtos")) rows = [...TABLES.produtos];
  else if (ql.includes("from vendas")) rows = [...TABLES.vendas];
  else if (ql.includes("from clientes")) rows = [...TABLES.clientes];
  else return {error:"Tabelas: produtos, vendas, clientes"};
  const wm = ql.match(/where (.+?)(?:order by|group by|limit|having|$)/);
  if (wm) {
    const wc = wm[1].trim();
    if (wc.includes("preco >")) { const v=parseInt(wc.match(/preco > (\d+)/)?.[1]||0); rows=rows.filter(r=>r.preco>v); }
    if (wc.includes("preco <")) { const v=parseInt(wc.match(/preco < (\d+)/)?.[1]||0); rows=rows.filter(r=>r.preco<v); }
    if (wc.includes("valor >")) { const v=parseInt(wc.match(/valor > (\d+)/)?.[1]||0); rows=rows.filter(r=>r.valor>v); }
    if (wc.includes("categoria = ")) { const v=wc.match(/categoria = '([^']+)'/)?.[1]; if(v) rows=rows.filter(r=>r.categoria===v); }
    if (wc.includes("plano = ")) { const v=wc.match(/plano = '([^']+)'/)?.[1]; if(v) rows=rows.filter(r=>r.plano===v); }
  }
  if (ql.includes("group by")) {
    const gb = ql.match(/group by (\w+)/)?.[1];
    if (gb) {
      const grouped = {};
      rows.forEach(r => { const k=r[gb]; if(!grouped[k]) grouped[k]={[gb]:k,count:0,total:0}; grouped[k].count++; grouped[k].total+=(r.valor||r.preco||0); });
      rows = Object.values(grouped).map(g=>({[gb]:g[gb],"COUNT(*)":g.count,"SUM(valor/preco)":g.total}));
    }
  }
  if (ql.includes("order by")) {
    const ob = ql.match(/order by (\w+)(?: (asc|desc))?/);
    if (ob) { const [,col,dir="asc"]=ob; rows=[...rows].sort((a,b)=>{const va=a[col]||0,vb=b[col]||0;return dir==="desc"?vb-va:va-vb;}); }
  }
  const lm = ql.match(/limit (\d+)/);
  if (lm) rows = rows.slice(0, parseInt(lm[1]));
  return {rows, count:rows.length};
}

const LIBRARY = [
  {id:1,title:"Cheatsheet Python para Dados",cat:"Python",type:"Cheatsheet",tags:["pandas","numpy","python"],desc:"Referência rápida dos principais comandos Python para análise de dados.",url:"https://pandas.pydata.org/docs/",icon:"🐍"},
  {id:2,title:"SQL para Analistas",cat:"SQL",type:"Apostila",tags:["sql","select","joins"],desc:"Guia completo de SQL com foco em análise de dados.",url:"https://www.w3schools.com/sql/",icon:"🗄️"},
  {id:4,title:"Power BI — Guia Completo",cat:"Power BI",type:"Guia",tags:["powerbi","dax","dashboard"],desc:"Do básico ao avançado no Power BI.",url:"https://docs.microsoft.com/pt-br/power-bi/",icon:"📊"},
];

const PYTHON_EX = [
  {id:1,level:"Iniciante",title:"Calculadora de IMC",desc:"Calcule o IMC.",hint:"IMC = peso / (altura**2).",xp:30},
];

const SQL_EX = [
  {id:1,level:"Iniciante",title:"SELECT com colunas",desc:"Selecione dados.",hint:"SELECT nome, categoria FROM produtos",xp:20},
];

// ── CONTEXTS ──────────────────────────────────────────────────
const AuthCtx = createContext(null);
const ProgCtx = createContext(null);

function AuthProvider({children}) {
  const [user,setUser] = useState(null);
  const [loading,setLoading] = useState(true);
  useEffect(()=>{
    const tok = sessionStorage.getItem("dp_tok");
    if(tok) { const d = Security.verifyJWT(tok); if(d) { const u=DB.users()[d.sub]; if(u) setUser({...u,password:undefined}); } }
    setLoading(false);
  },[]);
  const login = async (email,pw)=>{
    const users=DB.users(), u=Object.values(users).find(u=>u.email===email.toLowerCase());
    if(!u) return {error:"Erro"};
    const h=await Security.hashPassword(pw);
    if(h!==u.password) return {error:"Erro"};
    const tok=Security.generateJWT(u.id);
    sessionStorage.setItem("dp_tok",tok);
    const safe={...u,password:undefined}; setUser(safe); return {user:safe};
  };
  const register = async (name,email,pw)=>{
    const users=DB.users();
    const id=crypto.randomUUID(), h=await Security.hashPassword(pw);
    const nu={id,name:Security.sanitize(name),email:email.toLowerCase(),password:h,createdAt:Date.now()};
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
    DB.setProgress(user.id,updated); setProgress({...updated}); return updated;
  },[user]);
  const completeDay=useCallback((dayNum,xpAmt)=>{
    if(!user) return;
    const cur=DB.progress(user.id);
    const days=[...cur.completedDays,dayNum], newXP=cur.xp+xpAmt;
    save({completedDays:days,xp:newXP});
  },[user,save]);
  return <ProgCtx.Provider value={{progress,save,completeDay}}>{children}</ProgCtx.Provider>;
}

const useAuth=()=>useContext(AuthCtx);
const useProgress=()=>useContext(ProgCtx);

// ── UI PRIMITIVES ─────────────────────────────────────────────
const C = { bg:"#020817", surface:"#0a1628", card:"#0f172a", border:"#1e293b", text:"#e2e8f0", muted:"#64748b", accent:"#6366f1", green:"#10b981", yellow:"#f59e0b", red:"#ef4444", blue:"#3b82f6" };

function XPBar({xp,level}) {
  const hi=xpForNext(level);
  const pct=Math.min(100,(xp/hi)*100);
  return (
    <div style={{width:"100%",background:C.border,borderRadius:999,height:7}}>
      <div style={{width:`${pct}%`,background:"#6366f1",height:"100%",borderRadius:999}}/>
    </div>
  );
}

function Btn({children,onClick,v="primary",sx={}}) {
  const bg = v==="primary" ? C.accent : C.card;
  return <button onClick={onClick} style={{padding:"10px 20px",borderRadius:8,border:"none",background:bg,color:"#fff",cursor:"pointer",fontWeight:700,...sx}}>{children}</button>;
}

function Inp({label,type="text",value,onChange,placeholder}) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      <label style={{color:C.muted,fontSize:12}}>{label}</label>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{padding:"10px",background:C.card,border:`1px solid ${C.border}`,color:"#fff",borderRadius:8}}/>
    </div>
  );
}

// ── COMPONENTES PRINCIPAIS ──────────────────────────────────────

function Landing({onLogin,onRegister}) {
  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",padding:20}}>
      <h1 style={{fontSize:48,margin:0,color:C.accent}}>DataPath</h1>
      <p style={{color:C.muted,maxWidth:500,margin:"20px 0 40px"}}>Plataforma Gamificada de Dados. Aprenda Python, SQL e Power BI.</p>
      <div style={{display:"flex",gap:15}}>
        <Btn onClick={onRegister}>Começar Agora</Btn>
        <Btn onClick={onLogin} v="secondary">Entrar</Btn>
      </div>
    </div>
  );
}

function AuthPage({mode,onSuccess}) {
  const [email,setEmail]=useState(""); const [pw,setPw]=useState(""); const [name,setName]=useState("");
  const {login,register}=useAuth();
  const handle=async()=>{
    if(mode==="login") await login(email,pw); else await register(name,email,pw);
    onSuccess();
  };
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:C.card,padding:40,borderRadius:16,width:350,display:"flex",flexDirection:"column",gap:15}}>
        <h2>{mode==="login"?"Login":"Cadastro"}</h2>
        {mode==="register"&&<Inp label="Nome" value={name} onChange={setName}/>}
        <Inp label="Email" value={email} onChange={setEmail}/>
        <Inp label="Senha" type="password" value={pw} onChange={setPw}/>
        <Btn onClick={handle}>{mode==="login"?"Entrar":"Cadastrar"}</Btn>
      </div>
    </div>
  );
}

function Dashboard({go}) {
  const {user}=useAuth();
  const {progress}=useProgress();
  if(!progress) return null;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div style={{background:C.surface,padding:30,borderRadius:16}}>
        <h2>Olá, {user.name}! 👋</h2>
        <p style={{color:C.muted}}>Nível {progress.level} — {progress.xp} XP</p>
        <XPBar xp={progress.xp} level={progress.level}/>
      </div>
      <Btn onClick={()=>go("journey")}>Ir para Jornada 90 Dias</Btn>
    </div>
  );
}

function AppShell() {
  const [page,setPage]=useState("dashboard");
  const {logout}=useAuth();
  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,display:"flex"}}>
      <nav style={{width:250,background:C.surface,padding:20,display:"flex",flexDirection:"column",gap:10}}>
        <h3>DataPath</h3>
        <button onClick={()=>setPage("dashboard")}>Dashboard</button>
        <button onClick={()=>setPage("journey")}>Jornada</button>
        <button onClick={logout}>Sair</button>
      </nav>
      <main style={{flex:1,padding:40}}>
        {page==="dashboard"&&<Dashboard go={setPage}/>}
        {page==="journey"&&<div>Página da Jornada (Em breve)</div>}
      </main>
    </div>
  );
}

function AppRoot() {
  const [view,setView]=useState("landing");
  const {user,loading}=useAuth();
  if(loading) return <div style={{color:"#fff",padding:20}}>Carregando...</div>;
  if(user) return <ProgressProvider><AppShell/></ProgressProvider>;
  if(view==="landing") return <Landing onLogin={()=>setView("login")} onRegister={()=>setView("register")}/>;
  return <AuthPage mode={view} onSuccess={()=>{}}/>;
}

function DataPath() {
  return (
    <AuthProvider>
      <AppRoot/>
    </AuthProvider>
  );
}

// LIGA O SITE NA DIV ROOT
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<DataPath />);
