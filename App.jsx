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

// ... (Aqui continua sua lógica original de DAY_DATA, TABLES e runSQL)

// Contexts, AuthProvider, ProgressProvider e UI Primitives...
// [INSIRA AQUI TODO O RESTO DO SEU CÓDIGO ORIGINAL]

export default function DataPath() {
  return (
    <AuthProvider>
      <ProgressProvider>
        <AppShell />
      </ProgressProvider>
    </AuthProvider>
  );
}
