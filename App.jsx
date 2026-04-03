import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";

// ============================================================
// DATAPATH — PLATAFORMA DE ENSINO GAMIFICADO PARA DADOS
[span_10](start_span)[span_11](start_span)// Segurança: hash SHA-256, JWT, rate limiting, XSS sanitization[span_10](end_span)[span_11](end_span)
[span_12](start_span)[span_13](start_span)// Persistência: localStorage[span_12](end_span)[span_13](end_span)
// ============================================================

const Security = {
  hashPassword: async (pw) => {
    const data = new TextEncoder().encode(pw + "dp_salt_x9k2");
    [span_14](start_span)const hash = await crypto.subtle.digest("SHA-256", data);[span_14](end_span)
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,"0")).join("");
  },
  [span_15](start_span)sanitize: (s) => typeof s === "string" ? s.replace(/[<>&"']/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&#x27;"}[c])) : "",[span_15](end_span)
  validateEmail: (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),
  validatePassword: (p) => p.length >= 8 && /[A-Z]/.test(p) && /[0-9]/.test(p),
  generateJWT: (uid) => {
    const h = btoa(JSON.stringify({alg:"HS256",typ:"JWT"}));
    [span_16](start_span)const p = btoa(JSON.stringify({sub:uid,iat:Date.now(),exp:Date.now()+86400000}));[span_16](end_span)
    const s = btoa(uid+"dp_secret_key");
    return `${h}.${p}.${s}`;
  },
  verifyJWT: (token) => {
    try { const d = JSON.parse(atob(token.split(".")[1])); return d.exp > Date.now() ? d : null; [span_17](start_span)}
    catch { return null; }
  },
};

const RL = { _a: {}, check(k, max=5, win=900000) {
  const now = Date.now();
  this._a[k] = (this._a[k]||[]).filter(t=>now-t<win);[span_17](end_span)
  [span_18](start_span)if (this._a[k].length >= max) return false;[span_18](end_span)
  this._a[k].push(now); return true;
}};

const DB = {
  g: (k) => { try { return JSON.parse(localStorage.getItem("dp_"+k)||"null"); } catch { return null; [span_19](start_span)}},[span_19](end_span)
  s: (k,v) => { try { localStorage.setItem("dp_"+k, JSON.stringify(v)); [span_20](start_span)} catch {} },[span_20](end_span)
  users: () => DB.g("users") || [span_21](start_span){},[span_21](end_span)
  [span_22](start_span)setUsers: (u) => DB.s("users", u),[span_22](end_span)
  [span_23](start_span)progress: (id) => DB.g("prog_"+id) || defProgress(id),[span_23](end_span)
  [span_24](start_span)setProgress: (id,p) => DB.s("prog_"+id, p),[span_24](end_span)
  notes: (id) => DB.g("notes_"+id) || [span_25](start_span)[],[span_25](end_span)
  [span_26](start_span)setNotes: (id,n) => DB.s("notes_"+id, n),[span_26](end_span)
  portfolio: (id) => DB.g("pf_"+id) || [span_27](start_span)[],[span_27](end_span)
  [span_28](start_span)setPortfolio: (id,p) => DB.s("pf_"+id, p),[span_28](end_span)
  [span_29](start_span)resume: (id) => DB.g("cv_"+id) || defResume(),[span_29](end_span)
  [span_30](start_span)setResume: (id,r) => DB.s("cv_"+id, r),[span_30](end_span)
  goals: (id) => DB.g("goals_"+id) || [span_31](start_span)[],[span_31](end_span)
  [span_32](start_span)setGoals: (id,g) => DB.s("goals_"+id, g),[span_32](end_span)
  [span_33](start_span)habits: (id) => DB.g("habits_"+id) || defHabits(),[span_33](end_span)
  [span_34](start_span)setHabits: (id,h) => DB.s("habits_"+id, h),[span_34](end_span)
  checklist: (id) => DB.g("check_"+id) || [span_35](start_span)[],[span_35](end_span)
  [span_36](start_span)setChecklist: (id,c) => DB.s("check_"+id, c),[span_36](end_span)
};

const defProgress = (id) => ({
  userId:id, xp:0, level:1, streak:0, lastStudy:null,
  [span_37](start_span)completedDays:[], achievements:[], trackProgress:{python:0,sql:0,powerbi:0,english:0}[span_37](end_span)
});
const defResume = () => ({
  name:"",title:"",email:"",phone:"",linkedin:"",github:"",
  [span_38](start_span)summary:"",skills:[],experience:[],education:[],projects:[],certifications:[][span_38](end_span)
});
const defHabits = () => ([
  {id:1,name:"Estudar Python",streak:0,done:false,color:"#3b82f6"},
  {id:2,name:"Praticar SQL",streak:0,done:false,color:"#10b981"},
  {id:3,name:"Inglês técnico",streak:0,done:false,color:"#f59e0b"},
  [span_39](start_span){id:4,name:"Revisão do dia",streak:0,done:false,color:"#8b5cf6"},[span_39](end_span)
]);

// ── GAMIFICATION ─────────────────────────────────────────────
[span_40](start_span)const calcLevel = (xp) => Math.floor(Math.sqrt(xp/100))+1;[span_40](end_span)
[span_41](start_span)const xpForLevel = (lvl) => (lvl-1)*(lvl-1)*100;[span_41](end_span)
[span_42](start_span)const xpForNext = (lvl) => lvl*lvl*100;[span_42](end_span)

const ACHIEVEMENTS = [
  {id:"first",name:"Primeiro Passo",desc:"Concluiu o Dia 1",icon:"🌱",xp:50,cond:(p)=>p.completedDays.length>=1},
  {id:"week1",name:"Semana Completa",desc:"7 dias concluídos",icon:"🔥",xp:100,cond:(p)=>p.completedDays.length>=7},
  {id:"streak7",name:"Sequência de 7d",desc:"7 dias consecutivos",icon:"⚡",xp:150,cond:(p)=>p.streak>=7},
  {id:"lvl5",name:"Nível 5",desc:"Alcançou o nível 5",icon:"⭐",xp:200,cond:(p)=>p.level>=5},
  {id:"day30",name:"Mês de Dados",desc:"30 dias concluídos",icon:"🏆",xp:300,cond:(p)=>p.completedDays.length>=30},
  [span_43](start_span){id:"pf1",name:"Portfólio Iniciado",desc:"Adicionou 1 projeto",icon:"💼",xp:100,cond:(p)=>(p.portfolioCount||0)>=1},[span_43](end_span)
];

const PHASES = [
  {id:1,name:"Fase 1: Fundamentos",range:[1,30],color:"#3b82f6",icon:"🌱"},
  {id:2,name:"Fase 2: Prática Guiada",range:[31,60],color:"#10b981",icon:"⚡"},
  {id:3,name:"Fase 3: Projetos",range:[61,75],color:"#f59e0b",icon:"🚀"},
  [span_44](start_span){id:4,name:"Fase 4: Portfólio & Carreira",range:[76,90],color:"#8b5cf6",icon:"🏆"},[span_44](end_span)
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
  [span_45](start_span){day:15,title:"Python: Tratamento de Erros",phase:1,xp:70,track:"python",mission:"Crie código robusto com try/except.",tasks:["try/except básico","Múltiplos erros","finally e raise","Funções com tratamento"],english:"Vocabulário: 'exception', 'error handling', 'raise', 'debug', 'traceback'",practice:"Adicione robustez ao projeto de vendas."},[span_45](end_span)
  {day:16,title:"SQL: GROUP BY",phase:1,xp:70,track:"sql",mission:"Agrupe dados para análises poderosas.",tasks:["GROUP BY básico","COUNT, SUM, AVG, MAX, MIN","GROUP BY + WHERE","HAVING clause"],english:"Vocabulário: 'aggregate', 'group by', 'having', 'count', 'sum'",practice:"Total de vendas por categoria no sandbox."},
  {day:17,title:"Python: Arquivos e CSV",phase:1,xp:75,track:"python",mission:"Leia e escreva arquivos CSV com Python.",tasks:["open() e with","csv.reader e writer","Leitura de CSV real","Geração de relatório CSV"],english:"Vocabulário: 'file handling', 'CSV', 'read', 'write', 'encoding'",practice:"Leia um CSV e gere relatório de análise."},
  {day:18,title:"SQL: JOINs Básicos",phase:1,xp:75,track:"sql",mission:"Una tabelas com INNER JOIN e LEFT JOIN.",tasks:["O que são JOINs?","INNER JOIN","LEFT JOIN","Exercício: clientes + pedidos"],english:"Vocabulário: 'join', 'relationship', 'foreign key', 'primary key'",practice:"Una clientes e vendas no sandbox."},
  {day:19,title:"Python: Pandas — Introdução",phase:1,xp:80,track:"python",mission:"Comece a trabalhar com DataFrames pandas.",tasks:["import pandas as pd","pd.DataFrame()","Leitura de CSV com pandas","df.head(), info(), describe()"],english:"Vocabulário: 'DataFrame', 'Series', 'index', 'column', 'shape'",practice:"Carregue e explore um dataset de vendas."},
  [span_46](start_span){day:20,title:"Revisão — Semana 3",phase:1,xp:85,track:"python",mission:"Revise semana 3 e construa análise completa.",tasks:["Revise: arquivos, pandas intro","Revise: JOINs e GROUP BY","Mini projeto: análise CSV completa","Documente no GitHub"],english:"Frases de apresentação de projeto de dados.",practice:"Análise exploratória completa de dataset fictício."},[span_46](end_span)
  ...Array.from({length:10},(_,i)=>({day:21+i,title:["Python: Pandas Filtros","SQL: Subqueries","Power BI: Introdução","Inglês: Tech Vocab","Python: GroupBy Pandas","SQL: LEFT e RIGHT JOIN","Power BI: Power Query","Inglês: Documentation","Python: Merge e Concat","SQL: CTEs"][i],phase:1,xp:75+i*5,track:["python","sql","powerbi","english","python","sql","powerbi","english","python","sql"][i],mission:`Evolua suas habilidades no dia ${21+i} da jornada.`,tasks:["Estude o conteúdo do dia","Pratique exercícios","Anote aprendizados","Atualize GitHub"],english:"Pratique vocabulário técnico aplicado.",practice:"Complete o exercício prático do dia."})),
  ...Array.from({length:9},(_,i)=>({day:31+i,title:["Python: Visualização com Matplotlib","SQL: Window Functions","Power BI: Modelagem","Inglês: Meetings","Python: Seaborn","SQL: Funções de Data","Power BI: DAX Básico","Inglês: Presentations","Python: NumPy"][i],phase:2,xp:80+i*5,track:["python","sql","powerbi","english","python","sql","powerbi","english","python"][i],mission:`Aprofunde sua prática — dia ${31+i}.`,tasks:["Conteúdo teórico do dia","Exercício prático","Mini projeto parcial","Commit GitHub"],english:"Vocabulário técnico aplicado a contextos reais.",practice:"Exercício prático com dados reais ou simulados."})),
  [span_47](start_span)...Array.from({length:51},(_,i)=>({day:40+i,title:`Dia ${40+i}: ${["Python Avançado","SQL Analítico","Power BI Avançado","Inglês para Entrevistas","Projeto Python","Análise SQL Completa","Dashboard Power BI","Inglês Técnico","Portfólio","Currículo ATS"][i%10]}`,phase:40+i<=60?2:40+i<=75?3:4,xp:85+Math.floor(i/5)*5,track:["python","sql","powerbi","english","python","sql","powerbi","english","python","sql"][i%10],mission:`Continue sua evolução — dia ${40+i} da jornada de dados.`,tasks:["Conteúdo do dia","Exercícios práticos","Revisão e notas","GitHub atualizado"],english:"Vocabulário e frases técnicas do dia.",practice:"Exercício integrado do dia."})),[span_47](end_span)
];

// ── SQL SANDBOX DATA ─────────────────────────────────────────
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
    [span_48](start_span){id:4,nome:"Julia Martins",cidade:"São Paulo",plano:"Básico"},[span_48](end_span)
  ],
};

function runSQL(q) {
  const ql = q.toLowerCase().trim();
  [span_49](start_span)if (!ql.startsWith("select")) return {error:"Apenas SELECT é permitido no sandbox."};[span_49](end_span)
  let rows = [];
  [span_50](start_span)if (ql.includes("from produtos")) rows = [...TABLES.produtos];[span_50](end_span)
  [span_51](start_span)else if (ql.includes("from vendas")) rows = [...TABLES.vendas];[span_51](end_span)
  [span_52](start_span)else if (ql.includes("from clientes")) rows = [...TABLES.clientes];[span_52](end_span)
  [span_53](start_span)else return {error:"Tabelas: produtos, vendas, clientes"};[span_53](end_span)
  [span_54](start_span)const wm = ql.match(/where (.+?)(?:order by|group by|limit|having|$)/);[span_54](end_span)
  if (wm) {
    [span_55](start_span)const wc = wm[1].trim();[span_55](end_span)
    if (wc.includes("preco >")) { const v=parseInt(wc.match(/preco > (\d+)/)?.[1]||0); rows=rows.filter(r=>r.preco>v); [span_56](start_span)}
    if (wc.includes("preco <")) { const v=parseInt(wc.match(/preco < (\d+)/)?.[1]||0); rows=rows.filter(r=>r.preco<v); }[span_56](end_span)
    if (wc.includes("valor >")) { const v=parseInt(wc.match(/valor > (\d+)/)?.[1]||0); rows=rows.filter(r=>r.valor>v); [span_57](start_span)}
    if (wc.includes("categoria = ")) { const v=wc.match(/categoria = '([^']+)'/)?.[1]; if(v) rows=rows.filter(r=>r.categoria===v); }[span_57](end_span)
    if (wc.includes("plano = ")) { const v=wc.match(/plano = '([^']+)'/)?.[1]; if(v) rows=rows.filter(r=>r.plano===v); [span_58](start_span)}
  }
  if (ql.includes("group by")) {
    const gb = ql.match(/group by (\w+)/)?.[1];[span_58](end_span)
    if (gb) {
      [span_59](start_span)const grouped = {};[span_59](end_span)
      [span_60](start_span)rows.forEach(r => { const k=r[gb]; if(!grouped[k]) grouped[k]={[gb]:k,count:0,total:0}; grouped[k].count++; grouped[k].total+=(r.valor||r.preco||0); });[span_60](end_span)
      [span_61](start_span)rows = Object.values(grouped).map(g=>({[gb]:g[gb],"COUNT(*)":g.count,"SUM(valor/preco)":g.total}));[span_61](end_span)
    [span_62](start_span)}
  }
  if (ql.includes("order by")) {
    const ob = ql.match(/order by (\w+)(?: (asc|desc))?/);[span_62](end_span)
    if (ob) { const [,col,dir="asc"]=ob; rows=[...rows].sort((a,b)=>{const va=a[col]||0,vb=b[col]||0;return dir==="desc"?vb-va:va-vb;}); [span_63](start_span)}
  }
  const lm = ql.match(/limit (\d+)/);[span_63](end_span)
  [span_64](start_span)if (lm) rows = rows.slice(0, parseInt(lm[1]));[span_64](end_span)
  [span_65](start_span)if (ql.includes("count(*)") && !ql.includes("group by")) return {rows:[{"count(*)":rows.length}],count:1};[span_65](end_span)
  if (ql.match(/sum\((\w+)\)/) && !ql.includes("group by")) {
    const col = ql.match(/sum\((\w+)\)/)?.[1]; const t=rows.reduce((s,r)=>s+(r[col]||0),0);
    [span_66](start_span)return {rows:[{[`sum(${col})`]:t}],count:1};[span_66](end_span)
  }
  if (ql.match(/avg\((\w+)\)/) && !ql.includes("group by")) {
    const col = ql.match(/avg\((\w+)\)/)?.[1]; const a=rows.reduce((s,r)=>s+(r[col]||0),0)/(rows.length||1);
    [span_67](start_span)return {rows:[{[`avg(${col})`]:parseFloat(a.toFixed(2))}],count:1};[span_67](end_span)
  }
  [span_68](start_span)return {rows, count:rows.length};[span_68](end_span)
}

// ── LIBRARY DATA ─────────────────────────────────────────────
const LIBRARY = [
  {id:1,title:"Cheatsheet Python para Dados",cat:"Python",type:"Cheatsheet",tags:["pandas","numpy","python"],desc:"Referência rápida dos principais comandos Python para análise de dados.",url:"https://pandas.pydata.org/docs/",icon:"🐍"},
  {id:2,title:"SQL para Analistas",cat:"SQL",type:"Apostila",tags:["sql","select","joins"],desc:"Guia completo de SQL com foco em análise de dados.",url:"https://www.w3schools.com/sql/",icon:"🗄️"},
  {id:3,title:"Documentação Pandas",cat:"Python",type:"Docs",tags:["pandas","dataframe"],desc:"Documentação oficial do Pandas.",url:"https://pandas.pydata.org/docs/",icon:"📚"},
  {id:4,title:"Power BI — Guia Completo",cat:"Power BI",type:"Guia",tags:["powerbi","dax","dashboard"],desc:"Do básico ao avançado no Power BI.",url:"https://docs.microsoft.com/pt-br/power-bi/",icon:"📊"},
  {id:5,title:"Vocabulário Técnico em Inglês",cat:"Inglês",type:"Glossário",tags:["english","vocabulary","tech"],desc:"500+ termos da área de dados com tradução.",url:"#",icon:"🇺🇸"},
  {id:6,title:"Dataset: Vendas Brasileiras",cat:"Datasets",type:"Dataset",tags:["dataset","vendas","csv"],desc:"10.000 registros de vendas para prática.",url:"#",icon:"📁"},
  {id:7,title:"Cheatsheet SQL Avançado",cat:"SQL",type:"Cheatsheet",tags:["sql","window functions","cte"],desc:"CTEs, Window Functions e queries analíticas.",url:"#",icon:"📋"},
  [span_69](start_span){id:8,title:"DAX — Fórmulas Essenciais",cat:"Power BI",type:"Cheatsheet",tags:["dax","powerbi","medidas"],desc:"As 50 fórmulas DAX mais usadas.",url:"#",icon:"⚡"},[span_69](end_span)
  {id:9,title:"Guia de Carreira: Analista de Dados",cat:"Carreira",type:"Guia",tags:["carreira","emprego","salário"],desc:"Mercado, salários e como conseguir o 1º emprego.",url:"#",icon:"💼"},
  {id:10,title:"Python: Automação com openpyxl",cat:"Python",type:"Tutorial",tags:["python","excel","automação"],desc:"Automatize planilhas Excel com Python.",url:"#",icon:"🤖"},
  {id:11,title:"Inglês: Frases para Entrevistas",cat:"Inglês",type:"Guia",tags:["inglês","entrevista"],desc:"100 frases em inglês para entrevistas de dados.",url:"#",icon:"🎯"},
  [span_70](start_span){id:12,title:"Modelagem de Dados",cat:"SQL",type:"Apostila",tags:["modelagem","er","normalização"],desc:"Modelagem ER e normalização de banco.",url:"#",icon:"🔗"},[span_70](end_span)
];

const PYTHON_EX = [
  {id:1,level:"Iniciante",title:"Calculadora de IMC",desc:"Calcule e classifique o IMC (Abaixo do peso / Normal / Sobrepeso / Obesidade).",hint:"IMC = peso / (altura**2). Use if/elif para classificar.",xp:30},
  {id:2,level:"Iniciante",title:"Tabuada Automática",desc:"Gere a tabuada de 1 a 10 de qualquer número usando for.",hint:"for num in range(1,11): print(f'{n} x {num} = {n*num}')",xp:25},
  {id:3,level:"Iniciante",title:"Par ou Ímpar",desc:"Função que recebe uma lista de números e separa em pares e ímpares.",hint:"num % 2 == 0 → par. Use list comprehension.",xp:25},
  [span_71](start_span){id:4,level:"Intermediário",title:"Estatísticas de Salários",desc:"Calcule média, mediana, max, min e variância de uma lista de salários sem bibliotecas.",hint:"Ordene a lista para mediana. Variância = média dos quadrados das diferenças.",xp:50},[span_71](end_span)
  {id:5,level:"Intermediário",title:"Filtro de Funcionários",desc:"Filtre funcionários (lista de dicts) com salário > 5000 e departamento 'TI' ou 'Dados'.",hint:"[f for f in lista if f['sal']>5000 and f['dept'] in ['TI','Dados']]",xp:50},
  [span_72](start_span){id:6,level:"Intermediário",title:"Relatório de Vendas",desc:"Agrupe lista de vendas por mês e calcule total, qtd e ticket médio.",hint:"Use dicionários para acumular. {mes: {total, qtd}}",xp:55},[span_72](end_span)
  {id:7,level:"Avançado",title:"Análise com Pandas",desc:"Carregue dados de vendas e calcule: total/categoria, top produto, variação mensal.",hint:"df.groupby('cat').agg({'valor':['sum','mean','count']})",xp:80},
  [span_73](start_span){id:8,level:"Avançado",title:"Mini ETL Pipeline",desc:"Construa extract() → transform() → load() para processar dados fictícios.",hint:"Cada função tem responsabilidade única. transform() normaliza e filtra.",xp:90},[span_73](end_span)
];

const SQL_EX = [
  {id:1,level:"Iniciante",title:"SELECT com colunas",desc:"Selecione nome, categoria e preço de produtos, ordenados por preço desc.",hint:"SELECT nome, categoria, preco FROM produtos ORDER BY preco DESC",xp:20},
  {id:2,level:"Iniciante",title:"Filtrar Produtos",desc:"Produtos com preço acima de R$300 da categoria Tech.",hint:"WHERE preco > 300 AND categoria = 'Tech'",xp:25},
  {id:3,level:"Iniciante",title:"Top 3 Mais Caros",desc:"Os 3 produtos mais caros (nome e preço).",hint:"ORDER BY preco DESC LIMIT 3",xp:25},
  {id:4,level:"Intermediário",title:"Total por Categoria",desc:"Total de vendas e quantidade por categoria.",hint:"GROUP BY categoria com SUM e COUNT",xp:45},
  {id:5,level:"Intermediário",title:"Melhor Vendedor",desc:"Vendedor com maior faturamento total.",hint:"GROUP BY vendedor + SUM(valor) + ORDER BY + LIMIT 1",xp:50},
  [span_74](start_span){id:6,level:"Intermediário",title:"Acima da Média",desc:"Produtos com preço acima da média geral.",hint:"WHERE preco > (SELECT AVG(preco) FROM produtos)",xp:60},[span_74](end_span)
  {id:7,level:"Avançado",title:"Análise por Vendedor",desc:"Faturamento, qtd de vendas e ticket médio por vendedor.",hint:"GROUP BY vendedor com SUM, COUNT, AVG",xp:70},
  [span_75](start_span){id:8,level:"Avançado",title:"Clientes Premium",desc:"Quantos clientes de cada plano existem?",hint:"GROUP BY plano com COUNT(*) FROM clientes",xp:65},[span_75](end_span)
];

// ── CONTEXTS ──────────────────────────────────────────────────
[span_76](start_span)const AuthCtx = createContext(null);[span_76](end_span)
[span_77](start_span)const ProgCtx = createContext(null);[span_77](end_span)

function AuthProvider({children}) {
  [span_78](start_span)const [user,setUser] = useState(null);[span_78](end_span)
  [span_79](start_span)const [loading,setLoading] = useState(true);[span_79](end_span)

  useEffect(()=>{
    const tok = sessionStorage.getItem("dp_tok");
    if(tok) {
      const d = Security.verifyJWT(tok);
      if(d) { const u=DB.users()[d.sub]; if(u) setUser({...u,password:undefined}); }
    }
    setLoading(false);
  [span_80](start_span)},[]);[span_80](end_span)
  const login = async (email,pw)=>{
    [span_81](start_span)if(!RL.check("login_"+email,5,900000)) return {error:"Muitas tentativas. Aguarde 15 minutos."};[span_81](end_span)
    [span_82](start_span)const users=DB.users(), u=Object.values(users).find(u=>u.email===email.toLowerCase());[span_82](end_span)
    [span_83](start_span)if(!u) return {error:"Credenciais inválidas."};[span_83](end_span)
    [span_84](start_span)const h=await Security.hashPassword(pw);[span_84](end_span)
    [span_85](start_span)if(h!==u.password) return {error:"Credenciais inválidas."};[span_85](end_span)
    [span_86](start_span)const tok=Security.generateJWT(u.id);[span_86](end_span)
    [span_87](start_span)sessionStorage.setItem("dp_tok",tok);[span_87](end_span)
    [span_88](start_span)const safe={...u,password:undefined}; setUser(safe); return {user:safe};[span_88](end_span)
  };
  const register = async (name,email,pw)=>{
    [span_89](start_span)if(!Security.validateEmail(email)) return {error:"Email inválido."};[span_89](end_span)
    [span_90](start_span)if(!Security.validatePassword(pw)) return {error:"Senha: 8+ chars, 1 maiúsc., 1 número."};[span_90](end_span)
    [span_91](start_span)const users=DB.users();[span_91](end_span)
    [span_92](start_span)if(Object.values(users).find(u=>u.email===email.toLowerCase())) return {error:"Email já cadastrado."};[span_92](end_span)
    [span_93](start_span)const id=crypto.randomUUID(), h=await Security.hashPassword(pw);[span_93](end_span)
    [span_94](start_span)const nu={id,name:Security.sanitize(name),email:email.toLowerCase(),password:h,createdAt:Date.now()};[span_94](end_span)
    users[id]=nu; DB.setUsers(users); [span_95](start_span)DB.setProgress(id,defProgress(id));[span_95](end_span)
    [span_96](start_span)const tok=Security.generateJWT(id);[span_96](end_span)
    [span_97](start_span)sessionStorage.setItem("dp_tok",tok);[span_97](end_span)
    [span_98](start_span)const safe={...nu,password:undefined}; setUser(safe); return {user:safe};[span_98](end_span)
  };

  const logout=()=>{ sessionStorage.removeItem("dp_tok"); setUser(null); [span_99](start_span)};[span_99](end_span)
  const resetPassword=async(email,pw)=>{
    [span_100](start_span)if(!Security.validatePassword(pw)) return {error:"Senha: 8+ chars, 1 maiúsc., 1 número."};[span_100](end_span)
    [span_101](start_span)const users=DB.users(), uid=Object.keys(users).find(k=>users[k].email===email.toLowerCase());[span_101](end_span)
    [span_102](start_span)if(!uid) return {error:"Email não encontrado."};[span_102](end_span)
    [span_103](start_span)users[uid].password=await Security.hashPassword(pw);[span_103](end_span)
    [span_104](start_span)DB.setUsers(users); return {success:true};[span_104](end_span)
  };

  [span_105](start_span)return <AuthCtx.Provider value={{user,loading,login,register,logout,resetPassword}}>{children}</AuthCtx.Provider>;[span_105](end_span)
}

function ProgressProvider({children}) {
  [span_106](start_span)const {user}=useAuth();[span_106](end_span)
  [span_107](start_span)const [progress,setProgress]=useState(null);[span_107](end_span)
  [span_108](start_span)useEffect(()=>{ if(user) setProgress(DB.progress(user.id)); else setProgress(null); },[user]);[span_108](end_span)

  const save=useCallback((upd)=>{
    if(!user) return null;
    const cur=DB.progress(user.id);
    const updated={...cur,...upd}; updated.level=calcLevel(updated.xp);
    DB.setProgress(user.id,updated); setProgress({...updated}); return updated;
  [span_109](start_span)},[user]);[span_109](end_span)
  const checkAchievements=(prog)=>{
    const ach=[...(prog.achievements||[])]; let bonus=0;
    ACHIEVEMENTS.forEach(a=>{ if(!ach.includes(a.id)&&a.cond(prog)){ach.push(a.id);bonus+=a.xp;} });
    if(bonus>0) save({achievements:ach,xp:prog.xp+bonus});
  [span_110](start_span)};[span_110](end_span)
  const completeDay=useCallback((dayNum,xpAmt)=>{
    if(!user) return;
    const cur=DB.progress(user.id);
    if(cur.completedDays.includes(dayNum)) return;
    const days=[...cur.completedDays,dayNum], newXP=cur.xp+xpAmt;
    const today=new Date().toDateString(), yest=new Date(Date.now()-86400000).toDateString();
    const newStreak=cur.lastStudy===yest?cur.streak+1:cur.lastStudy===today?cur.streak:1;
    const upd=save({completedDays:days,xp:newXP,streak:newStreak,lastStudy:today});
    if(upd) checkAchievements(upd);
  [span_111](start_span)},[user,save]);[span_111](end_span)
  const addXP=useCallback((amt)=>{
    if(!user) return;
    const cur=DB.progress(user.id);
    const upd=save({xp:cur.xp+amt});
    if(upd) checkAchievements(upd);
  [span_112](start_span)},[user,save]);[span_112](end_span)
  [span_113](start_span)return <ProgCtx.Provider value={{progress,save,completeDay,addXP}}>{children}</ProgCtx.Provider>;[span_113](end_span)
}

[span_114](start_span)const useAuth=()=>useContext(AuthCtx);[span_114](end_span)
[span_115](start_span)const useProgress=()=>useContext(ProgCtx);[span_115](end_span)

// ── UI PRIMITIVES ─────────────────────────────────────────────

const C = {
  bg:"#020817", surface:"#0a1628", card:"#0f172a",
  border:"#1e293b", border2:"#334155",
  text:"#e2e8f0", muted:"#64748b", faint:"#475569",
  accent:"#6366f1", accent2:"#8b5cf6",
  [span_116](start_span)green:"#10b981", yellow:"#f59e0b", red:"#ef4444", blue:"#3b82f6",[span_116](end_span)
};

function XPBar({xp,level}) {
  const lo=xpForLevel(level), hi=xpForNext(level);
  const pct=Math.min(100,((xp-lo)/(hi-lo))*100);
  return (
    <div style={{width:"100%"}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted,marginBottom:4}}>
        <span>Nível {level}</span><span>{xp} / {hi} XP</span>
      </div>
      <div style={{background:C.border,borderRadius:999,height:7}}>
        <div style={{width:`${pct}%`,background:"linear-gradient(90deg,#6366f1,#8b5cf6)",height:"100%",borderRadius:999,transition:"width 0.7s ease"}}/>
      </div>
    </div>
  [span_117](start_span));[span_117](end_span)
}

function Btn({children,onClick,v="primary",disabled,sx={},size="md"}) {
  const sz={sm:{padding:"7px 15px",fontSize:12.5},md:{padding:"11px 22px",fontSize:14},lg:{padding:"15px 30px",fontSize:16}};
  const vs={
    primary:{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",boxShadow:"0 4px 18px #6366f138"},
    secondary:{background:C.card,color:C.text,border:`1px solid ${C.border2}`},
    ghost:{background:"transparent",color:C.muted,border:`1px solid ${C.border}`},
    success:{background:"linear-gradient(135deg,#10b981,#059669)",color:"#fff",border:"none"},
    danger:{background:"linear-gradient(135deg,#ef4444,#dc2626)",color:"#fff",border:"none"},
    yellow:{background:"linear-gradient(135deg,#f59e0b,#d97706)",color:"#fff",border:"none"},
  [span_118](start_span)};[span_118](end_span)
  return (
    <button onClick={!disabled?onClick:undefined}
      style={{cursor:disabled?"not-allowed":"pointer",borderRadius:10,fontWeight:700,transition:"all 0.2s",display:"inline-flex",alignItems:"center",gap:7,fontFamily:"inherit",opacity:disabled?0.5:1,...sz[size],...vs[v],...sx}}>
      {children}
    </button>
  [span_119](start_span));[span_119](end_span)
}

function Inp({label,type="text",value,onChange,placeholder,error,icon,rows}) {
  const base={width:"100%",background:C.card,border:`1px solid ${error?C.red:C.border}`,borderRadius:10,color:C.text,fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"inherit"};
  return (
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      {label&&<label style={{color:C.muted,fontSize:12.5,fontWeight:600}}>{label}</label>}
      <div style={{position:"relative"}}>
        {icon&&<span style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",fontSize:15,pointerEvents:"none"}}>{icon}</span>}
        {rows
          ?<textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows}
            style={{...base,padding:"12px 14px",resize:"vertical"}}/>
          :<input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
            [span_120](start_span)style={{...base,padding:"11px 14px",paddingLeft:icon?42:14}}/>[span_120](end_span)
        }
      </div>
      {error&&<span style={{color:C.red,fontSize:11.5}}>{error}</span>}
    </div>
  [span_121](start_span));[span_121](end_span)
}

function Badge({text,color="#6366f1"}) {
  [span_122](start_span)return <span style={{background:color+"1e",color,border:`1px solid ${color}38`,borderRadius:999,padding:"2px 10px",fontSize:11,fontWeight:600}}>{text}</span>;[span_122](end_span)
}

function Card({children,sx={}}) {
  [span_123](start_span)return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:22,...sx}}>{children}</div>;[span_123](end_span)
}

function Stat({icon,label,value,color=C.accent}) {
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"18px 20px"}}>
      <div style={{fontSize:22,marginBottom:7}}>{icon}</div>
      <div style={{fontSize:24,fontWeight:800,color,fontFamily:"'Syne',sans-serif",marginBottom:3}}>{value}</div>
      <div style={{fontSize:12,color:C.muted}}>{label}</div>
    </div>
  [span_124](start_span));[span_124](end_span)
}

function Toast({msg}) {
  return msg ? (
    <div style={{position:"fixed",top:20,right:20,background:"#10b981",color:"#fff",padding:"13px 22px",borderRadius:12,zIndex:9999,fontWeight:700,boxShadow:"0 8px 30px #00000055",fontSize:14,animation:"fadeIn 0.3s"}}>
      {msg}
    </div>
  [span_125](start_span)) : null;[span_125](end_span)
}

// ── LANDING ──────────────────────────────────────────────────

function Landing({onLogin,onRegister}) {
  const features=[
    {i:"🗺️",t:"Jornada 90 Dias",d:"Missões diárias progressivas, do zero ao portfólio completo."},
    {i:"🎮",t:"Gamificação Real",d:"XP, níveis, conquistas e streak para manter a motivação."},
    {i:"🐍",t:"Python para Dados",d:"Do básico ao pandas e automação com exercícios práticos."},
    {i:"🗄️",t:"SQL Completo",d:"SELECT ao avançado com sandbox SQL interativo no browser."},
    {i:"📊",t:"Power BI",d:"Dashboards, DAX e storytelling com dados corporativos."},
    {i:"🇺🇸",t:"Inglês Técnico",d:"Vocabulário para docs, entrevistas e ambiente tech."},
    {i:"📚",t:"Biblioteca Rica",d:"Cheatsheets, apostilas, datasets e glossário técnico."},
    [span_126](start_span){i:"🛠️",t:"Ferramentas",d:"Pomodoro, planner, notas e rastreador de hábitos."},[span_126](end_span)
    {i:"💼",t:"Portfólio & Currículo ATS",d:"Portfólio sólido e currículo otimizado para recrutamento."},
  [span_127](start_span)];[span_127](end_span)
  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Outfit',sans-serif"}}>
      <nav style={{padding:"16px 5%",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${C.surface}`,position:"sticky",top:0,background:C.bg+"ee",backdropFilter:"blur(12px)",zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:9,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>⚡</div>
          <span style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900,background:"linear-gradient(90deg,#6366f1,#8b5cf6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>DataPath</span>
        </div>
        <div style={{display:"flex",gap:9}}>
          <Btn v="ghost" onClick={onLogin} size="sm">Entrar</Btn>
          [span_128](start_span)<Btn onClick={onRegister} size="sm">Começar Grátis →</Btn>[span_128](end_span)
        </div>
      </nav>
      <section style={{textAlign:"center",padding:"80px 5% 64px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 80% 50% at 50% 0%,#6366f115,transparent)",pointerEvents:"none"}}/>
        <div style={{display:"inline-block",background:"#6366f118",border:"1px solid #6366f135",borderRadius:999,padding:"5px 16px",fontSize:12.5,color:"#818cf8",marginBottom:22,fontWeight:600}}>
          🚀 Jornada Gamificada de 90 Dias
        </div>
        <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(2rem,5.5vw,3.8rem)",fontWeight:900,lineHeight:1.1,margin:"0 0 20px",background:"linear-gradient(135deg,#f1f5f9 45%,#818cf8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
          [span_129](start_span)Do Zero ao Analista<br/>de Dados em 90 Dias[span_129](end_span)
        </h1>
        <p style={{fontSize:"clamp(1rem,2.2vw,1.18rem)",color:C.muted,maxWidth:600,margin:"0 auto 40px",lineHeight:1.75}}>
          [span_130](start_span)Aprenda Python, SQL, Power BI e Inglês técnico com missões diárias gamificadas, sandbox interativo, ferramentas integradas e construção completa de portfólio e currículo ATS.[span_130](end_span)
        </p>
        <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginBottom:56}}>
          <Btn onClick={onRegister} size="lg">🚀 Começar Minha Jornada</Btn>
          <Btn v="ghost" onClick={onLogin} size="lg">Já tenho conta</Btn>
        </div>
        <div style={{display:"flex",gap:44,justifyContent:"center",flexWrap:"wrap"}}>
          {[["2.000+","Alunos"],["90","Dias"],["4","Trilhas"],["500+","Exercícios"]].map(([n,l])=>(
            <div key={l} style={{textAlign:"center"}}>
              [span_131](start_span)<div style={{fontFamily:"'Syne',sans-serif",fontSize:30,fontWeight:900,color:C.accent}}>{n}</div>[span_131](end_span)
              <div style={{fontSize:12.5,color:C.muted}}>{l}</div>
            </div>
          ))}
        </div>
      </section>
      <section style={{padding:"56px 5%",background:C.surface}}>
        <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(1.4rem,3vw,2rem)",fontWeight:900,textAlign:"center",marginBottom:44}}>Tudo para virar Analista de Dados</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(268px,1fr))",gap:16}}>
          [span_132](start_span){features.map(f=>([span_132](end_span)
            <div key={f.t} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:22,transition:"all 0.2s",cursor:"default"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.transform="translateY(-3px)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform="none";}}>
              <div style={{fontSize:30,marginBottom:11}}>{f.i}</div>
              <h3 style={{fontFamily:"'Syne',sans-serif",fontSize:14.5,fontWeight:700,marginBottom:7,color:C.text}}>{f.t}</h3>
              <p style={{fontSize:13,color:C.muted,lineHeight:1.65,margin:0}}>{f.d}</p>
            [span_133](start_span)</div>[span_133](end_span)
          ))}
        </div>
      </section>
      <section style={{padding:"64px 5%",textAlign:"center"}}>
        <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(1.4rem,3vw,2rem)",fontWeight:900,marginBottom:16}}>Comece sua transformação hoje</h2>
        <p style={{color:C.muted,marginBottom:36,maxWidth:480,margin:"0 auto 36px",lineHeight:1.7}}>Sua jornada de 90 dias começa agora. [span_134](start_span)Gratuito, sem cartão de crédito.</p>[span_134](end_span)
        <Btn onClick={onRegister} size="lg">🚀 Criar Conta Gratuita</Btn>
      </section>
      <footer style={{borderTop:`1px solid ${C.surface}`,padding:"18px 5%",textAlign:"center",color:C.border2,fontSize:12.5}}>
        © 2024 DataPath · Plataforma de ensino gamificado para a área de dados
      </footer>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=Outfit:wght@400;500;600;700;800&display=swap');`}</style>
    </div>
  [span_135](start_span));[span_135](end_span)
}

// ── AUTH PAGE ─────────────────────────────────────────────────

function AuthPage({mode:initMode="login",onSuccess}) {
  const [mode,setMode]=useState(initMode);
  const [name,setName]=useState(""); const [email,setEmail]=useState(""); const [pw,setPw]=useState(""); const [pw2,setPw2]=useState("");
  [span_136](start_span)const [loading,setLoading]=useState(false);[span_136](end_span)
  [span_137](start_span)const [err,setErr]=useState(""); const [ok,setOk]=useState("");[span_137](end_span)
  [span_138](start_span)const {login,register,resetPassword}=useAuth();[span_138](end_span)

  const handle=async()=>{
    [span_139](start_span)setErr(""); setOk("");[span_139](end_span)
    [span_140](start_span)if(!email||!pw){setErr("Preencha todos os campos.");return;}[span_140](end_span)
    [span_141](start_span)setLoading(true);[span_141](end_span)
    if(mode==="login"){
      const r=await login(email,pw);
      [span_142](start_span)if(r.error) setErr(r.error);[span_142](end_span)
      [span_143](start_span)else onSuccess();[span_143](end_span)
    } else if(mode==="register"){
      [span_144](start_span)if(!name){setErr("Informe seu nome.");setLoading(false);return;}[span_144](end_span)
      [span_145](start_span)if(pw!==pw2){setErr("Senhas não coincidem.");setLoading(false);return;}[span_145](end_span)
      [span_146](start_span)const r=await register(name,email,pw);[span_146](end_span)
      [span_147](start_span)if(r.error) setErr(r.error); else onSuccess();[span_147](end_span)
    } else {
      const r=await resetPassword(email,pw);
      [span_148](start_span)if(r.error) setErr(r.error);[span_148](end_span)
      [span_149](start_span)else {setOk("Senha redefinida! Faça login.");setMode("login");}[span_149](end_span)
    }
    [span_150](start_span)setLoading(false);[span_150](end_span)
  };
  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Outfit',sans-serif"}}>
      <div style={{position:"fixed",inset:0,background:"radial-gradient(ellipse 80% 70% at 50% -10%,#6366f110,transparent)",pointerEvents:"none"}}/>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:"38px 34px",width:"100%",maxWidth:410,position:"relative"}}>
        <div style={{textAlign:"center",marginBottom:30}}>
          <div style={{width:50,height:50,borderRadius:14,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:25,marginBottom:14}}>⚡</div>
          <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:23,fontWeight:900,color:C.text,margin:0}}>DataPath</h1>
          <p style={{color:C.muted,fontSize:13.5,marginTop:7}}>
            {mode==="login"?"Entre na sua conta":mode==="register"?"Crie sua conta gratuita":"Recuperar senha"}
          [span_151](start_span)</p>[span_151](end_span)
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:13}}>
          {mode==="register"&&<Inp label="Nome completo" value={name} onChange={setName} placeholder="Seu nome completo" icon="👤"/>}
          <Inp label="Email" type="email" value={email} onChange={setEmail} placeholder="seu@email.com" icon="✉️"/>
          <Inp label={mode==="reset"?"Nova senha":"Senha"} type="password" value={pw} onChange={setPw} placeholder={mode==="reset"?"8+ chars, 1 maiúsc., 1 núm.":"Senha"} icon="🔒"/>
          [span_152](start_span){mode==="register"&&<Inp label="Confirmar senha" type="password" value={pw2} onChange={setPw2} placeholder="Confirme a senha" icon="🔒"/>}[span_152](end_span)
          <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 13px",fontSize:12,color:C.faint}}>
            {mode==="login"
              [span_153](start_span)?"🛡️ Proteção ativa: máx. 5 tentativas em 15 min (rate limiting)."[span_153](end_span)
              :mode==="register"
              [span_154](start_span)?"🔒 Senha: mín. 8 chars, 1 maiúscula, 1 número. Hash SHA-256 aplicado."[span_154](end_span)
              :"💡 A nova senha deve ter 8+ chars, 1 maiúscula, 1 número."}
          </div>
          {err&&<div style={{background:C.red+"18",border:`1px solid ${C.red}35`,borderRadius:8,padding:"9px 13px",color:C.red,fontSize:13}}>{err}</div>}
          {ok&&<div style={{background:C.green+"18",border:`1px solid ${C.green}35`,borderRadius:8,padding:"9px 13px",color:C.green,fontSize:13}}>{ok}</div>}
          <Btn onClick={handle} disabled={loading} sx={{width:"100%",justifyContent:"center"}}>
            [span_155](start_span){loading?"Processando...":{login:"Entrar",register:"Criar Conta",reset:"Redefinir Senha"}[mode]}[span_155](end_span)
          </Btn>
        </div>
        <div style={{textAlign:"center",marginTop:22,display:"flex",flexDirection:"column",gap:9}}>
          {mode==="login"&&(<>
            <button onClick={()=>setMode("reset")} style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>Esqueci minha senha</button>
            [span_156](start_span)<button onClick={()=>setMode("register")} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>Não tem conta? <span style={{color:C.accent}}>Cadastre-se grátis</span></button>[span_156](end_span)
          </>)}
          {mode==="register"&&<button onClick={()=>setMode("login")} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>Já tem conta? [span_157](start_span)<span style={{color:C.accent}}>Entrar</span></button>}[span_157](end_span)
          {mode==="reset"&&<button onClick={()=>setMode("login")} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>← Voltar ao login</button>}
        </div>
      </div>
    </div>
  [span_158](start_span));[span_158](end_span)
}

// ── APP SHELL ─────────────────────────────────────────────────

function AppShell() {
  const [page,setPage]=useState("dashboard");
  const {user,logout}=useAuth();
  const {progress}=useProgress();
  [span_159](start_span)const [open,setOpen]=useState(false);[span_159](end_span)
  const nav=[
    {id:"dashboard",i:"🏠",l:"Dashboard"},
    {id:"journey",i:"🗺️",l:"Jornada 90 Dias"},
    {id:"tracks",i:"🎓",l:"Trilhas"},
    {id:"tools",i:"🛠️",l:"Ferramentas"},
    {id:"library",i:"📚",l:"Biblioteca"},
    {id:"portfolio",i:"💼",l:"Portfólio"},
    {id:"resume",i:"📄",l:"Currículo ATS"},
    {id:"profile",i:"👤",l:"Perfil"},
  [span_160](start_span)];[span_160](end_span)
  [span_161](start_span)const go=(p)=>{setPage(p);setOpen(false);};[span_161](end_span)

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Outfit',sans-serif",display:"flex"}}>
      <aside style={{width:238,background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",position:"fixed",height:"100vh",zIndex:50,left:open?0:-238,transition:"left 0.28s",overflowY:"auto"}}>
        <div style={{padding:"20px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:31,height:31,borderRadius:8,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>⚡</div>
          <span style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,background:"linear-gradient(90deg,#6366f1,#8b5cf6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>DataPath</span>
        </div>
        {progress&&(
          [span_162](start_span)<div style={{padding:"13px 16px",borderBottom:`1px solid ${C.border}`}}>[span_162](end_span)
            <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:11}}>
              <div style={{width:34,height:34,borderRadius:999,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>👤</div>
              <div><div style={{fontSize:13,fontWeight:700,color:C.text}}>{user?.name?.split(" ")[0]}</div><div style={{fontSize:11,color:C.muted}}>Nível {progress.level}</div></div>
            </div>
            <XPBar xp={progress.xp} level={progress.level}/>
          </div>
        )}
        [span_163](start_span)<nav style={{flex:1,padding:"9px 9px"}}>[span_163](end_span)
          {nav.map(n=>(
            <button key={n.id} onClick={()=>go(n.id)}
              style={{width:"100%",display:"flex",alignItems:"center",gap:11,padding:"9px 11px",borderRadius:9,border:"none",cursor:"pointer",fontSize:13,fontWeight:page===n.id?700:500,background:page===n.id?"#6366f116":"transparent",color:page===n.id?C.accent:C.muted,marginBottom:2,transition:"all 0.15s",textAlign:"left",fontFamily:"inherit"}}>
              <span style={{fontSize:15}}>{n.i}</span>{n.l}
            [span_164](start_span)</button>[span_164](end_span)
          ))}
        </nav>
        <div style={{padding:"10px 9px",borderTop:`1px solid ${C.border}`}}>
          [span_165](start_span)<button onClick={logout} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 11px",borderRadius:9,border:"none",cursor:"pointer",fontSize:13,background:"transparent",color:C.muted,fontFamily:"inherit"}}>🚪 Sair</button>[span_165](end_span)
        </div>
      </aside>
      {open&&<div onClick={()=>setOpen(false)} style={{position:"fixed",inset:0,background:"#00000075",zIndex:40}}/>}
      <main style={{flex:1,minHeight:"100vh",display:"flex",flexDirection:"column"}}>
        <header style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"13px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:30}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <button onClick={()=>setOpen(!open)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:20,display:"flex",lineHeight:1}}>☰</button>
            <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14.5,color:C.text}}>{nav.find(n=>n.id===page)?.i} {nav.find(n=>n.id===page)?.l}</span>
          [span_166](start_span)</div>[span_166](end_span)
          {progress&&(
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:7,padding:"4px 11px",fontSize:12.5,fontWeight:700,color:C.yellow}}>🔥 {progress.streak}</div>
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:7,padding:"4px 11px",fontSize:12.5,fontWeight:700,color:C.accent}}>⚡ {progress.xp} XP</div>
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:7,padding:"4px 11px",fontSize:12.5,fontWeight:700,color:C.accent2}}>⭐ Nv.{progress.level}</div>
            [span_167](start_span)</div>[span_167](end_span)
          )}
        </header>
        <div style={{flex:1,padding:"20px",overflowY:"auto"}}>
          {page==="dashboard"&&<Dashboard go={go}/>}
          {page==="journey"&&<Journey/>}
          {page==="tracks"&&<Tracks/>}
          {page==="tools"&&<Tools/>}
          {page==="library"&&<LibraryPage/>}
          {page==="portfolio"&&<Portfolio/>}
          {page==="resume"&&<ResumePage/>}
          [span_168](start_span){page==="profile"&&<ProfilePage/>}[span_168](end_span)
        </div>
      </main>
      <style>{`
        @media(min-width:768px){aside{left:0!important}main{margin-left:238px!important}}
        *{box-sizing:border-box;margin:0;padding:0}
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=Outfit:wght@400;500;600;700;800&display=swap');
        [span_169](start_span)::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}[span_169](end_span)
        input:focus,textarea:focus,select:focus{outline:none!important;border-color:${C.accent}!important;box-shadow:0 0 0 3px ${C.accent}15}
        textarea{resize:vertical}
      `}</style>
    </div>
  [span_170](start_span));[span_170](end_span)
}

// ── DASHBOARD ────────────────────────────────────────────────

function Dashboard({go}) {
  [span_171](start_span)const {user}=useAuth();[span_171](end_span)
  [span_172](start_span)const {progress}=useProgress();[span_172](end_span)
  [span_173](start_span)if(!progress) return null;[span_173](end_span)
  [span_174](start_span)const dayNum=progress.completedDays.length+1;[span_174](end_span)
  [span_175](start_span)const pct=Math.round((progress.completedDays.length/90)*100);[span_175](end_span)
  [span_176](start_span)const phase=PHASES.find(p=>dayNum>=p.range[0]&&dayNum<=p.range[1])||PHASES[0];[span_176](end_span)
  [span_177](start_span)const today=DAY_DATA.find(d=>d.day===dayNum)||DAY_DATA[0];[span_177](end_span)
  [span_178](start_span)const earned=ACHIEVEMENTS.filter(a=>progress.achievements?.includes(a.id));[span_178](end_span)
  const tracks=[
    {n:"Python",i:"🐍",c:C.blue,p:progress.trackProgress?.python||0},
    {n:"SQL",i:"🗄️",c:C.green,p:progress.trackProgress?.sql||0},
    {n:"Power BI",i:"📊",c:C.yellow,p:progress.trackProgress?.powerbi||0},
    {n:"Inglês",i:"🇺🇸",c:C.accent2,p:progress.trackProgress?.english||0},
  [span_179](start_span)];[span_179](end_span)
  return (
    <div style={{maxWidth:1100,margin:"0 auto",display:"flex",flexDirection:"column",gap:20}}>
      <div style={{background:"linear-gradient(135deg,#1e1b4b,#1a2744)",border:"1px solid #6366f128",borderRadius:18,padding:"24px 26px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",right:-10,top:-10,fontSize:90,opacity:0.04,pointerEvents:"none"}}>⚡</div>
        [span_180](start_span)<h2 style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(1.1rem,3vw,1.45rem)",fontWeight:900,margin:"0 0 7px"}}>Olá, {user?.name?.split(" ")[0]}! 👋</h2>[span_180](end_span)
        <p style={{color:C.muted,margin:"0 0 16px",fontSize:13.5}}>{phase.icon} <strong style={{color:C.accent}}>Dia {dayNum}</strong> da jornada · {phase.name}</p>
        <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
          <Btn onClick={()=>go("journey")} size="sm">🗺️ Continuar Jornada</Btn>
          [span_181](start_span)<Btn v="secondary" onClick={()=>go("tools")} size="sm">🛠️ Ferramentas</Btn>[span_181](end_span)
          <Btn v="ghost" onClick={()=>go("tracks")} size="sm">🎓 Trilhas</Btn>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(145px,1fr))",gap:13}}>
        <Stat icon="📅" label="Dia da Jornada" value={`${dayNum}/90`} color={C.accent}/>
        <Stat icon="⚡" label="XP Total" value={progress.xp} color={C.accent2}/>
        <Stat icon="⭐" label="Nível" value={progress.level} color={C.yellow}/>
        [span_182](start_span)<Stat icon="🔥" label="Sequência" value={`${progress.streak}d`} color={C.red}/>[span_182](end_span)
        <Stat icon="🏆" label="Conquistas" value={earned.length} color={C.green}/>
        <Stat icon="📊" label="Progresso" value={`${pct}%`} color={C.blue}/>
      </div>
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
          <h3 style={{fontFamily:"'Syne',sans-serif",fontSize:14.5,fontWeight:800}}>Progresso de Nível</h3>
          <Badge text={`Nível ${progress.level}`} color={C.accent}/>
        </div>
        [span_183](start_span)<XPBar xp={progress.xp} level={progress.level}/>[span_183](end_span)
        <p style={{fontSize:11,color:C.faint,marginTop:7,textAlign:"right"}}>{xpForNext(progress.level)-progress.xp} XP para Nível {progress.level+1}</p>
      </Card>
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:10,fontSize:13}}>
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700}}>Jornada 90 Dias</span>
          <span style={{color:C.accent,fontWeight:700}}>{progress.completedDays.length} / 90 dias</span>
        </div>
        <div style={{background:C.border,borderRadius:999,height:11,overflow:"hidden"}}>
          [span_184](start_span)<div style={{width:`${pct}%`,background:"linear-gradient(90deg,#6366f1,#8b5cf6)",height:"100%",borderRadius:999,transition:"width 0.8s ease"}}/>[span_184](end_span)
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.faint,marginTop:6}}>
          {PHASES.map(p=><span key={p.id} style={{color:p.color}}>{p.icon} {p.name.split(":")[0]}</span>)}
        </div>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:18}}>
        <Card sx={{border:`1px solid ${C.accent}22`}}>
          <div style={{marginBottom:10}}><Badge text={`Dia {dayNum}`} color={C.accent}/></div>
          [span_185](start_span)<h4 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14.5,margin:"0 0 8px"}}>{today?.title}</h4>[span_185](end_span)
          <p style={{fontSize:13,color:C.muted,lineHeight:1.55,margin:"0 0 14px"}}>{today?.mission?.slice(0,110)}...</p>
          <Btn size="sm" onClick={()=>go("journey")}>Ver Missão →</Btn>
        </Card>
        <Card>
          <h4 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14.5,margin:"0 0 16px"}}>Progresso por Trilha</h4>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            [span_186](start_span){tracks.map(t=>([span_186](end_span)
              <div key={t.n}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}>
                  <span>{t.i} {t.n}</span><span style={{color:t.c,fontWeight:700}}>{t.p}%</span>
                </div>
                <div style={{background:C.border,borderRadius:999,height:5}}>
                  [span_187](start_span)<div style={{width:`${t.p}%`,background:t.c,height:"100%",borderRadius:999,transition:"width 0.8s"}}/>[span_187](end_span)
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      {earned.length>0&&(
        <Card>
          <h4 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14.5,margin:"0 0 14px"}}>🏆 Conquistas Desbloqueadas</h4>
          [span_188](start_span)<div style={{display:"flex",gap:10,flexWrap:"wrap"}}>[span_188](end_span)
            {earned.map(a=>(
              <div key={a.id} style={{background:C.surface,borderRadius:10,padding:"10px 15px",display:"flex",alignItems:"center",gap:9}}>
                <span style={{fontSize:22}}>{a.icon}</span>
                <div><div style={{fontSize:12.5,fontWeight:700}}>{a.name}</div><div style={{fontSize:11,color:C.muted}}>{a.desc}</div></div>
              </div>
            ))}
          [span_189](start_span)</div>[span_189](end_span)
        </Card>
      )}
    </div>
  [span_190](start_span));[span_190](end_span)
}

// ── JOURNEY ──────────────────────────────────────────────────

function Journey() {
  [span_191](start_span)const {progress,completeDay}=useProgress();[span_191](end_span)
  [span_192](start_span)const [selected,setSelected]=useState(null);[span_192](end_span)
  [span_193](start_span)const [busy,setBusy]=useState(false);[span_193](end_span)
  [span_194](start_span)const [toast,setToast]=useState("");[span_194](end_span)

  [span_195](start_span)const showToast=(m)=>{setToast(m);setTimeout(()=>setToast(""),3200);};[span_195](end_span)
  [span_196](start_span)const curDay=progress?progress.completedDays.length+1:1;[span_196](end_span)
  const finish=async(day)=>{
    [span_197](start_span)if(!progress||progress.completedDays.includes(day.day)) return;[span_197](end_span)
    [span_198](start_span)setBusy(true); await new Promise(r=>setTimeout(r,700));[span_198](end_span)
    [span_199](start_span)completeDay(day.day,day.xp);[span_199](end_span)
    [span_200](start_span)showToast(`🎉 Dia ${day.day} concluído! +${day.xp} XP`);[span_200](end_span)
    [span_201](start_span)setBusy(false); setSelected(null);[span_201](end_span)
  };

  if(selected) {
    [span_202](start_span)const done=progress?.completedDays.includes(selected.day);[span_202](end_span)
    [span_203](start_span)const ph=PHASES.find(p=>selected.day>=p.range[0]&&selected.day<=p.range[1])||PHASES[0];[span_203](end_span)
    return (
      <div style={{maxWidth:660,margin:"0 auto"}}>
        <Toast msg={toast}/>
        <button onClick={()=>setSelected(null)} style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:13,marginBottom:20,fontFamily:"inherit",display:"flex",alignItems:"center",gap:7}}>← Voltar à Jornada</button>
        <div style={{background:C.card,border:`1px solid ${ph.color}28`,borderRadius:20,padding:28,display:"flex",flexDirection:"column",gap:18}}>
          <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
            <div>
              <div style={{display:"flex",gap:7,marginBottom:9,flexWrap:"wrap"}}>
                [span_204](start_span)<Badge text={`Dia ${selected.day}`} color={ph.color}/>[span_204](end_span)
                <Badge text={ph.name} color={ph.color}/>
                <Badge text={selected.track?.toUpperCase()} color={C.faint}/>
              </div>
              <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(1.1rem,3vw,1.4rem)",fontWeight:900}}>{selected.title}</h2>
            </div>
            [span_205](start_span)<Badge text={`+${selected.xp} XP`} color={C.green}/>[span_205](end_span)
          </div>
          <div style={{background:C.surface,borderRadius:11,padding:18}}>
            <p style={{fontSize:12,color:C.muted,marginBottom:7,fontWeight:600}}>🎯 MISSÃO PRINCIPAL</p>
            <p style={{color:C.text,lineHeight:1.7,fontSize:14}}>{selected.mission}</p>
          </div>
          <div>
            <p style={{fontSize:12,color:C.muted,marginBottom:10,fontWeight:600}}>✅ MICROTAREFAS</p>
            [span_206](start_span)<div style={{display:"flex",flexDirection:"column",gap:8}}>[span_206](end_span)
              {selected.tasks.map((t,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:11,background:C.surface,borderRadius:9,padding:"10px 14px"}}>
                  <div style={{width:20,height:20,borderRadius:5,border:`2px solid ${done?C.green:C.accent}`,background:done?"#10b98118":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:11,color:done?C.green:C.accent}}>
                    {done?"✓":i+1}
                  </div>
                  [span_207](start_span)<span style={{fontSize:13.5,color:C.text}}>{t}</span>[span_207](end_span)
                </div>
              ))}
            </div>
          </div>
          <div style={{background:C.surface,borderRadius:11,padding:17}}>
            <p style={{fontSize:12,color:C.blue,marginBottom:6,fontWeight:600}}>🇺🇸 INGLÊS TÉCNICO</p>
            <p style={{fontSize:13.5,color:C.muted,lineHeight:1.6}}>{selected.english}</p>
          [span_208](start_span)</div>[span_208](end_span)
          <div style={{background:C.surface,borderRadius:11,padding:17}}>
            <p style={{fontSize:12,color:C.yellow,marginBottom:6,fontWeight:600}}>💻 PRÁTICA DO DIA</p>
            <p style={{fontSize:13.5,color:C.muted,lineHeight:1.6}}>{selected.practice}</p>
          </div>
          {!done
            [span_209](start_span)?<Btn onClick={()=>finish(selected)} disabled={busy} v="success" sx={{width:"100%",justifyContent:"center",fontSize:15}}>[span_209](end_span)
              {busy?"Salvando...":"✅ Concluir Dia ${selected.day} (+${selected.xp} XP)"}
            </Btn>
            :<div style={{background:"#10b98118",border:"1px solid #10b98135",borderRadius:11,padding:18,textAlign:"center",color:C.green,fontWeight:700,fontSize:15}}>
              ✅ Dia {selected.day} Concluído! Parabéns!
            [span_210](start_span)</div>[span_210](end_span)
          }
        </div>
      </div>
    [span_211](start_span));[span_211](end_span)
  }

  return (
    <div style={{maxWidth:1000,margin:"0 auto"}}>
      <Toast msg={toast}/>
      <div style={{marginBottom:26}}>
        <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(1.3rem,3vw,1.75rem)",fontWeight:900,margin:"0 0 7px"}}>🗺️ Jornada de 90 Dias</h2>
        <p style={{color:C.muted,fontSize:13.5}}>Dia atual: <strong style={{color:C.accent}}>{curDay}</strong> · {Math.round((progress?.completedDays.length||0)/90*100)}% concluído</p>
      [span_212](start_span)</div>[span_212](end_span)
      <Card sx={{marginBottom:26}}>
        <div style={{background:C.border,borderRadius:999,height:12,overflow:"hidden",marginBottom:8}}>
          [span_213](start_span)<div style={{width:`${(progress?.completedDays.length||0)/90*100}%`,background:"linear-gradient(90deg,#6366f1,#8b5cf6)",height:"100%",borderRadius:999,transition:"width 0.8s ease"}}/>[span_213](end_span)
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11.5,color:C.faint}}>
          <span>Dia 1</span><span style={{color:C.accent,fontWeight:700}}>{progress?.completedDays.length||0} dias completos</span><span>Dia 90</span>
        </div>
      </Card>
      {PHASES.map(ph=>{
        [span_214](start_span)const days=DAY_DATA.filter(d=>d.day>=ph.range[0]&&d.day<=ph.range[1]);[span_214](end_span)
        return (
          <div key={ph.id} style={{marginBottom:30}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <span style={{fontSize:22}}>{ph.icon}</span>
              <div>
                <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:15,color:ph.color,margin:0}}>{ph.name}</h3>
                [span_215](start_span)<span style={{fontSize:11.5,color:C.faint}}>Dias {ph.range[0]}–{ph.range[1]}</span>[span_215](end_span)
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:9}}>
              {days.map(day=>{
                const isDone=progress?.completedDays.includes(day.day);
                const isCur=day.day===curDay;
                [span_216](start_span)const locked=day.day>curDay;[span_216](end_span)
                return (
                  <button key={day.day} onClick={()=>!locked&&setSelected(day)}
                    style={{background:isDone?"#10b98110":isCur?"#6366f112":C.card,border:`1px solid ${isDone?"#10b98138":isCur?"#6366f150":C.border}`,borderRadius:11,padding:"13px 11px",cursor:locked?"not-allowed":"pointer",textAlign:"left",opacity:locked?0.38:1,transition:"all 0.18s",fontFamily:"inherit",outline:"none"}}
                    onMouseEnter={e=>!locked&&(e.currentTarget.style.borderColor=ph.color)}
                    [span_217](start_span)onMouseLeave={e=>!locked&&(e.currentTarget.style.borderColor=isDone?"#10b98138":isCur?"#6366f150":C.border)}>[span_217](end_span)
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                      <span style={{fontSize:10.5,color:C.faint}}>Dia {day.day}</span>
                      {isDone&&<span style={{color:C.green,fontSize:13}}>✅</span>}
                      [span_218](start_span){isCur&&!isDone&&<span style={{color:C.accent,fontSize:9.5,fontWeight:800}}>HOJE</span>}[span_218](end_span)
                      {locked&&<span style={{fontSize:11}}>🔒</span>}
                    </div>
                    <div style={{fontSize:11.5,fontWeight:600,color:C.text,lineHeight:1.35,marginBottom:6}}>{day.title.slice(0,42)}{day.title.length>42?"...":""}</div>
                    <Badge text={`${day.xp}xp`} color={isDone?C.green:C.accent}/>
                  [span_219](start_span)</button>[span_219](end_span)
                );
              })}
            </div>
          </div>
        [span_220](start_span));[span_220](end_span)
      })}
    </div>
  [span_221](start_span));[span_221](end_span)
}

// ── TRACKS ────────────────────────────────────────────────────

function Tracks() {
  [span_222](start_span)const [track,setTrack]=useState("python");[span_222](end_span)
  [span_223](start_span)const {addXP}=useProgress();[span_223](end_span)
  [span_224](start_span)const [doneEx,setDoneEx]=useState(()=>DB.g("doneEx")||[]);[span_224](end_span)
  [span_225](start_span)const [sqlQ,setSqlQ]=useState("SELECT * FROM produtos ORDER BY preco DESC;");[span_225](end_span)
  [span_226](start_span)const [sqlRes,setSqlRes]=useState(null);[span_226](end_span)
  [span_227](start_span)const [pyCode,setPyCode]=useState("# Escreva seu código Python aqui\nprint('Olá, DataPath! 🐍')\n\n# Exemplo: calculadora de IMC\npeso = 70\naltura = 1.75\nimc = peso / (altura ** 2)\nprint(f'IMC: {imc:.2f}')");[span_227](end_span)
  [span_228](start_span)const [toast,setToast]=useState("");[span_228](end_span)

  [span_229](start_span)const showToast=(m)=>{setToast(m);setTimeout(()=>setToast(""),2800);};[span_229](end_span)

  const markDone=(id,type,xp)=>{
    const key=`${type}_${id}`;
    [span_230](start_span)if(doneEx.includes(key)) return;[span_230](end_span)
    const u=[...doneEx,key]; setDoneEx(u); [span_231](start_span)DB.s("doneEx",u); addXP(xp);[span_231](end_span)
    [span_232](start_span)showToast(`✅ Exercício concluído! +${xp} XP`);[span_232](end_span)
  };

  const execSQL=()=>{
    [span_233](start_span)if(!sqlQ.trim()){setSqlRes({error:"Digite uma query."});return;}[span_233](end_span)
    [span_234](start_span)setSqlRes(runSQL(sqlQ));[span_234](end_span)
  };
  [span_235](start_span)const tabs=[{id:"python",i:"🐍",l:"Python"},{id:"sql",i:"🗄️",l:"SQL"},{id:"powerbi",i:"📊",l:"Power BI"},{id:"english",i:"🇺🇸",l:"Inglês"}];[span_235](end_span)

  const mods={
    python:[
      {n:"Fundamentos",t:["Variáveis","Tipos","Operadores","Condicionais","Laços"],done:35},
      {n:"Estruturas de Dados",t:["Listas","Tuplas","Dicionários","Sets"],done:20},
      {n:"Funções & Modularidade",t:["Funções","Lambdas","*args/**kwargs","Módulos"],done:10},
      {n:"Pandas & NumPy",t:["DataFrame","Filtros","GroupBy","Merge","Visualização"],done:0},
      {n:"Projetos Práticos",t:["Análise de Vendas","ETL Simples","Dashboard CLI","Relatório Auto"],done:0},
    ],
    sql:[
      {n:"Consultas Básicas",t:["SELECT","WHERE","ORDER BY","LIMIT"],done:50},
      {n:"Agregações",t:["COUNT","SUM","AVG","GROUP BY","HAVING"],done:30},
      {n:"JOINs",t:["INNER JOIN","LEFT JOIN","RIGHT JOIN","SELF JOIN"],done:10},
      {n:"SQL Avançado",t:["Subqueries","CTEs","Window Functions","Índices"],done:0},
      [span_236](start_span){n:"Análise de Dados",t:["Análise de Vendas","Cohort","Funil","RFM"],done:0},[span_236](end_span)
    ],
    powerbi:[
      {n:"Introdução",t:["Interface","Power Query","Conectar Dados","Tipos"],done:55},
      {n:"Modelagem",t:["Relacionamentos","Esquema Estrela","Hierarquias"],done:20},
      {n:"DAX",t:["Medidas","Colunas Calc.","CALCULATE","FILTER","ALL"],done:8},
      {n:"Visualizações",t:["Gráficos","Slicers","Tooltips","Drillthrough"],done:0},
      {n:"Projetos",t:["Dashboard Vendas","KPIs Financeiros","Storytelling"],done:0},
    ],
    english:[
      {n:"Vocabulário Essencial",t:["Data terms","Python terms","SQL terms","BI terms"],done:40},
      {n:"Documentação",t:["README","Comments","Docstrings","Reports"],done:15},
      {n:"Comunicação",t:["Meetings","Presentations","Emails","Slack"],done:5},
      [span_237](start_span){n:"Entrevistas",t:["Tech interviews","Behavioral","Case studies","Salary Negotiation"],done:0},[span_237](end_span)
    ],
  };
  const enTerms=[
    {t:"Dataset",p:"Conjunto de dados",ex:"The dataset contains 1M rows."},
    {t:"Pipeline",p:"Fluxo de dados/ETL",ex:"We built an ETL pipeline for sales data."},
    {t:"Query",p:"Consulta ao banco",ex:"Run this SQL query to get the results."},
    {t:"Dashboard",p:"Painel de controle visual",ex:"The dashboard shows real-time KPIs."},
    [span_238](start_span){t:"Insight",p:"Visão analítica",ex:"The analysis revealed key business insights."},[span_238](end_span)
    {t:"Data-driven",p:"Orientado a dados",ex:"We make data-driven decisions."},
    {t:"Stakeholder",p:"Parte interessada",ex:"Present the findings to stakeholders."},
    {t:"ETL",p:"Extrair, Transformar, Carregar",ex:"The ETL process runs nightly at midnight."},
    [span_239](start_span){t:"KPI",p:"Indicador Chave de Desempenho",ex:"Revenue growth is our primary KPI."},[span_239](end_span)
    {t:"Data Warehouse",p:"Armazém de dados",ex:"All historical data lives in the data warehouse."},
    {t:"Feature Engineering",p:"Engenharia de atributos",ex:"Feature engineering improved the model accuracy."},
    [span_240](start_span){t:"Outlier",p:"Valor discrepante",ex:"Remove outliers before training the model."},[span_240](end_span)
  ];
  [span_241](start_span)const colors={python:C.blue,sql:C.green,powerbi:C.yellow,english:C.accent2};[span_241](end_span)

  return (
    <div style={{maxWidth:1000,margin:"0 auto"}}>
      <Toast msg={toast}/>
      <div style={{display:"flex",gap:9,marginBottom:26,flexWrap:"wrap"}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTrack(t.id)}
            style={{padding:"9px 18px",borderRadius:9,border:`2px solid ${track===t.id?colors[t.id]:C.border}`,background:track===t.id?colors[t.id]+"1a":C.card,color:track===t.id?colors[t.id]:C.muted,cursor:"pointer",fontWeight:700,fontSize:13.5,transition:"all 0.18s",fontFamily:"inherit"}}>
            {t.i} {t.l}
          [span_242](start_span)</button>[span_242](end_span)
        ))}
      </div>

      <div style={{marginBottom:28}}>
        <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:17,marginBottom:18}}>Módulos — {tabs.find(t=>t.id===track)?.l}</h3>
        <div style={{display:"flex",flexDirection:"column",gap:11}}>
          {(mods[track]||[]).map((m,mi)=>(
            <Card key={mi}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:11,flexWrap:"wrap",gap:8}}>
                [span_243](start_span)<h4 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14.5,color:C.text}}>{m.n}</h4>[span_243](end_span)
                <Badge text={m.done>0?`${m.done}% concluído`:"Não iniciado"} color={m.done>60?C.green:m.done>0?C.yellow:C.faint}/>
              </div>
              <div style={{background:C.border,borderRadius:999,height:4,marginBottom:11}}>
                [span_244](start_span)<div style={{width:`${m.done}%`,background:colors[track],height:"100%",borderRadius:999,transition:"width 0.7s"}}/>[span_244](end_span)
              </div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                [span_245](start_span){m.t.map(tp=><Badge key={tp} text={tp} color={C.faint}/>)}[span_245](end_span)
              </div>
            </Card>
          ))}
        </div>
      </div>

      {track==="python"&&(
        <>
          <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:17,marginBottom:18}}>💻 Exercícios Python</h3>
          [span_246](start_span)<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(275px,1fr))",gap:13,marginBottom:26}}>[span_246](end_span)
            {PYTHON_EX.map(ex=>{
              [span_247](start_span)const key=`python_${ex.id}`, done=doneEx.includes(key);[span_247](end_span)
              [span_248](start_span)const lc={Iniciante:C.green,Intermediário:C.yellow,Avançado:C.red};[span_248](end_span)
              return (
                <Card key={ex.id} sx={{border:`1px solid ${done?"#10b98130":C.border}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:9,flexWrap:"wrap",gap:6}}>
                    <Badge text={ex.level} color={lc[ex.level]}/>
                    [span_249](start_span)<Badge text={`+${ex.xp} XP`} color={C.accent}/>[span_249](end_span)
                  </div>
                  <h4 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,margin:"0 0 7px"}}>{ex.title}</h4>
                  <p style={{fontSize:12.5,color:C.muted,marginBottom:10,lineHeight:1.55}}>{ex.desc}</p>
                  [span_250](start_span)<div style={{fontSize:12,color:C.faint,background:C.surface,borderRadius:7,padding:"7px 11px",marginBottom:11}}>💡 {ex.hint}</div>[span_250](end_span)
                  {!done
                    [span_251](start_span)?<Btn size="sm" v="secondary" onClick={()=>markDone(ex.id,"python",ex.xp)}>Marcar Concluído</Btn>[span_251](end_span)
                    :<span style={{color:C.green,fontSize:13,fontWeight:700}}>✅ Concluído!</span>
                  }
                </Card>
              [span_252](start_span));[span_252](end_span)
            })}
          </div>
          <Card sx={{border:`1px solid ${C.blue}28`}}>
            <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:15,color:C.blue,marginBottom:8}}>🐍 Editor Python — Prática Livre</h3>
            <p style={{color:C.muted,fontSize:12.5,marginBottom:14}}>Escreva e salve seu código. [span_253](start_span)Gratuito, sem cartão de crédito.</p>[span_253](end_span)
            <textarea value={pyCode} onChange={e=>setPyCode(e.target.value)} rows={10}
              [span_254](start_span)style={{width:"100%",background:"#050d1a",border:`1px solid ${C.border}`,borderRadius:9,color:"#60a5fa",fontSize:13,padding:15,fontFamily:"'Courier New',monospace",resize:"vertical",boxSizing:"border-box"}}/>[span_254](end_span)
            <div style={{display:"flex",gap:9,marginTop:12,flexWrap:"wrap"}}>
              <Btn size="sm" sx={{background:C.blue}} onClick={()=>{addXP(10);showToast("Código salvo! +10 XP 🐍");}}>💾 Salvar (+10 XP)</Btn>
              [span_255](start_span)<Btn size="sm" v="secondary" onClick={()=>setPyCode("# Escreva seu código Python aqui\nprint('Olá, DataPath! 🐍')")}>🔄 Limpar</Btn>[span_255](end_span)
            </div>
          </Card>
        </>
      )}

      {track==="sql"&&(
        <>
          <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:17,marginBottom:18}}>🗄️ Exercícios SQL</h3>
          [span_256](start_span)<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(275px,1fr))",gap:13,marginBottom:26}}>[span_256](end_span)
            {SQL_EX.map(ex=>{
              [span_257](start_span)const key=`sql_${ex.id}`, done=doneEx.includes(key);[span_257](end_span)
              [span_258](start_span)const lc={Iniciante:C.green,Intermediário:C.yellow,Avançado:C.red};[span_258](end_span)
              return (
                <Card key={ex.id} sx={{border:`1px solid ${done?"#10b98130":C.border}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:9,flexWrap:"wrap",gap:6}}>
                    <Badge text={ex.level} color={lc[ex.level]}/>
                    [span_259](start_span)<Badge text={`+${ex.xp} XP`} color={C.accent}/>[span_259](end_span)
                  </div>
                  <h4 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,margin:"0 0 7px"}}>{ex.title}</h4>
                  <p style={{fontSize:12.5,color:C.muted,marginBottom:10,lineHeight:1.55}}>{ex.desc}</p>
                  [span_260](start_span)<div style={{fontSize:12,color:C.faint,background:C.surface,borderRadius:7,padding:"7px 11px",marginBottom:11}}>💡 {ex.hint}</div>[span_260](end_span)
                  {!done
                    [span_261](start_span)?<Btn size="sm" v="secondary" onClick={()=>markDone(ex.id,"sql",ex.xp)}>Marcar Concluído</Btn>[span_261](end_span)
                    :<span style={{color:C.green,fontSize:13,fontWeight:700}}>✅ Concluído!</span>
                  }
                </Card>
              [span_262](start_span));[span_262](end_span)
            })}
          </div>
          <Card sx={{border:`1px solid ${C.green}28`}}>
            <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:15,color:C.green,marginBottom:7}}>🗄️ SQL Sandbox Interativo</h3>
            <p style={{color:C.muted,fontSize:12.5,marginBottom:14}}>
              Tabelas disponíveis: <strong style={{color:C.text}}>produtos</strong>, <strong style={{color:C.text}}>vendas</strong>, <strong style={{color:C.text}}>clientes</strong>
            [span_263](start_span)</p>[span_263](end_span)
            <textarea value={sqlQ} onChange={e=>setSqlQ(e.target.value)} rows={4}
              [span_264](start_span)style={{width:"100%",background:"#020d0a",border:`1px solid ${C.border}`,borderRadius:9,color:"#34d399",fontSize:13.5,padding:14,fontFamily:"'Courier New',monospace",resize:"vertical",boxSizing:"border-box"}}/>[span_264](end_span)
            <div style={{display:"flex",gap:9,marginTop:11,flexWrap:"wrap"}}>
              <Btn v="success" onClick={execSQL}>▶ Executar Query</Btn>
              [span_265](start_span)<Btn v="ghost" size="sm" onClick={()=>setSqlQ("SELECT * FROM produtos ORDER BY preco DESC;")}>Exemplo 1</Btn>[span_265](end_span)
              <Btn v="ghost" size="sm" onClick={()=>setSqlQ("SELECT categoria, SUM(valor) as total, COUNT(*) as qtd FROM vendas GROUP BY categoria ORDER BY total DESC;")}>Exemplo 2</Btn>
              [span_266](start_span)<Btn v="ghost" size="sm" onClick={()=>setSqlQ("SELECT * FROM produtos WHERE preco > 300 AND categoria = 'Tech';")}>Exemplo 3</Btn>[span_266](end_span)
            </div>
            {sqlRes&&(
              [span_267](start_span)<div style={{marginTop:16}}>[span_267](end_span)
                {sqlRes.error
                  ?<div style={{background:C.red+"18",border:`1px solid ${C.red}30`,borderRadius:8,padding:12,color:C.red,fontSize:13}}>{sqlRes.error}</div>
                  :<div>
                    <p style={{fontSize:12,color:C.muted,marginBottom:9}}>{sqlRes.count} registro(s) retornado(s)</p>
                    [span_268](start_span)<div style={{overflowX:"auto",borderRadius:9,border:`1px solid ${C.border}`}}>[span_268](end_span)
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                        <thead>
                          <tr>
                            [span_269](start_span){Object.keys(sqlRes.rows[0]||{}).map(col=>([span_269](end_span)
                              <th key={col} style={{background:C.surface,padding:"8px 14px",textAlign:"left",color:C.muted,fontWeight:600,whiteSpace:"nowrap",borderBottom:`1px solid ${C.border}`}}>{col}</th>
                            ))}
                          [span_270](start_span)</tr>[span_270](end_span)
                        </thead>
                        <tbody>
                          {sqlRes.rows.map((row,i)=>(
                            [span_271](start_span)<tr key={i} style={{borderBottom:`1px solid ${C.border}`,background:i%2===0?C.card:C.surface}}>[span_271](end_span)
                              {Object.values(row).map((val,j)=>(
                                <td key={j} style={{padding:"8px 14px",color:C.text,whiteSpace:"nowrap"}}>{String(val)}</td>
                              [span_272](start_span)))}[span_272](end_span)
                            </tr>
                          ))}
                        </tbody>
                      [span_273](start_span)</table>[span_273](end_span)
                    </div>
                  </div>
                }
              </div>
            )}
          </Card>
        </>
      )}

      {track==="powerbi"&&(
        <Card sx={{border:`1px solid ${C.yellow}28`}}>
          [span_274](start_span)<h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:15,color:C.yellow,marginBottom:14}}>📊 Power BI — Roteiro de Estudo</h3>[span_274](end_span)
          {[
            [span_275](start_span){t:"1. Introdução",d:"Instale o Power BI Desktop, conecte-se a um CSV e explore a interface. Crie seu primeiro relatório."},[span_275](end_span)
            [span_276](start_span){t:"2. Power Query",d:"Limpe e transforme dados: remova nulos, renomeie colunas, mude tipos, filtre linhas e faça merge de tabelas."},[span_276](end_span)
            [span_277](start_span){t:"3. Modelagem",d:"Crie relacionamentos entre tabelas. Use esquema estrela com tabela fato e dimensões."},[span_277](end_span)
            [span_278](start_span){t:"4. DAX Básico",d:"Crie medidas com SUM, AVERAGE, COUNT. Use CALCULATE para filtros dinâmicos. Aprenda SUMX e RELATED."},[span_278](end_span)
            [span_279](start_span){t:"5. Visualizações",d:"Use gráficos de barras, linhas, pizza e mapas. Adicione slicers e crie drillthrough para detalhamento."},[span_279](end_span)
            [span_280](start_span){t:"6. Projeto Final",d:"Dashboard executivo de vendas com: KPIs, tendências mensais, top produtos e filtros por período/região."},[span_280](end_span)
          ].map((s,i)=>(
            <div key={i} style={{background:C.surface,borderRadius:10,padding:"14px 16px",marginBottom:10}}>
              <h4 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:C.yellow,marginBottom:6,fontSize:13.5}}>{s.t}</h4>
              <p style={{fontSize:13,color:C.muted,lineHeight:1.6,margin:0}}>{s.d}</p>
            [span_281](start_span)</div>[span_281](end_span)
          ))}
          <a href="https://powerbi.microsoft.com/pt-br/downloads/" target="_blank" rel="noreferrer" style={{textDecoration:"none"}}>
            <Btn v="yellow" size="sm">⬇️ Baixar Power BI Desktop</Btn>
          </a>
        </Card>
      )}

      {track==="english"&&(
        <>
          <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:17,marginBottom:18}}>🇺🇸 Vocabulário Técnico</h3>
          [span_282](start_span)<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:13,marginBottom:26}}>[span_282](end_span)
            {enTerms.map(term=>(
              <Card key={term.t} sx={{border:`1px solid ${C.accent2}25`}}>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:18,color:C.accent2,marginBottom:4}}>{term.t}</div>
                <div style={{fontSize:13,color:C.muted,marginBottom:9,fontWeight:600}}>{term.p}</div>
                <div style={{fontSize:12,color:C.faint,background:C.surface,borderRadius:7,padding:"8px 12px",fontStyle:"italic"}}>"{term.ex}"</div>
              [span_283](start_span)</Card>[span_283](end_span)
            ))}
          </div>
          <Card sx={{border:`1px solid ${C.accent2}25`}}>
            <h4 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:C.accent2,marginBottom:14,fontSize:15}}>🎤 Frases para Entrevistas em Inglês</h4>
            {["I'm proficient in Python and SQL for data analysis and reporting.",
              [span_284](start_span)"I have hands-on experience building dashboards in Power BI with DAX measures.",[span_284](end_span)
              "In my projects, I worked with ETL pipelines and data modeling using star schema.",
              "I'm comfortable reading and writing technical documentation in English.",
              "My experience includes exploratory data analysis using pandas and matplotlib.",
              [span_285](start_span)"I can present data insights clearly to both technical and non-technical stakeholders.",[span_285](end_span)
              "I follow best practices for code documentation, version control with Git, and clean code.",
            ].map((phrase,i)=>(
              <div key={i} style={{padding:"10px 14px",background:C.surface,borderRadius:8,marginBottom:8,fontSize:13.5,color:C.text,borderLeft:`3px solid ${C.accent2}`,lineHeight:1.5}}>{phrase}</div>
            ))}
          </Card>
        </>
      )}
    </div>
  [span_286](start_span));[span_286](end_span)
}

// ── TOOLS ─────────────────────────────────────────────────────

function Tools() {
  [span_287](start_span)const {user}=useAuth();[span_287](end_span)
  [span_288](start_span)const {addXP}=useProgress();[span_288](end_span)
  [span_289](start_span)const [tool,setTool]=useState("pomodoro");[span_289](end_span)
  [span_290](start_span)const [pomTime,setPomTime]=useState(25*60); const [pomActive,setPomActive]=useState(false);[span_290](end_span)
  [span_291](start_span)const [pomType,setPomType]=useState("work");[span_291](end_span)
  [span_292](start_span)const timerRef=useRef(null);[span_292](end_span)
  [span_293](start_span)const [notes,setNotes]=useState(()=>DB.notes(user?.id));[span_293](end_span)
  [span_294](start_span)const [ntitle,setNtitle]=useState(""); const [ntext,setNtext]=useState("");[span_294](end_span)
  [span_295](start_span)const [goals,setGoals]=useState(()=>DB.goals(user?.id));[span_295](end_span)
  [span_296](start_span)const [gtxt,setGtxt]=useState("");[span_296](end_span)
  [span_297](start_span)const [habits,setHabits]=useState(()=>DB.habits(user?.id));[span_297](end_span)
  [span_298](start_span)const [checks,setChecks]=useState(()=>DB.checklist(user?.id));[span_298](end_span)
  [span_299](start_span)const [ctxt,setCtxt]=useState("");[span_299](end_span)
  [span_300](start_span)const [toast,setToast]=useState("");[span_300](end_span)

  [span_301](start_span)const showToast=(m)=>{setToast(m);setTimeout(()=>setToast(""),2500);};[span_301](end_span)
  useEffect(()=>{
    if(pomActive) {
      timerRef.current=setInterval(()=>{
        setPomTime(t=>{
          if(t<=1){
            clearInterval(timerRef.current); setPomActive(false);
            if(pomType==="work"){ addXP(20); showToast("🍅 Sessão concluída! +20 XP"); }
            const next=pomType==="work"?"break":"work";
            setPomType(next); return next==="break"?5*60:25*60;
          [span_302](start_span)}
          return t-1;
        });
      },1000);
    } else clearInterval(timerRef.current);
    return ()=>clearInterval(timerRef.current);
  },[pomActive]);[span_302](end_span)
  [span_303](start_span)const fmt=s=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;[span_303](end_span)
  [span_304](start_span)const pct=(1-(pomTime/(pomType==="work"?1500:300)))*100;[span_304](end_span)

  const saveNote=()=>{
    if(!ntext.trim()) return;
    const u=[{id:Date.now(),title:ntitle||"Nota",text:ntext,date:new Date().toLocaleDateString("pt-BR")},...notes];
    setNotes(u); [span_305](start_span)DB.setNotes(user?.id,u); setNtitle(""); setNtext("");[span_305](end_span)
    [span_306](start_span)showToast("📝 Nota salva!");[span_306](end_span)
  };
  const addGoal=()=>{
    if(!gtxt.trim()) return;
    const u=[{id:Date.now(),text:gtxt,done:false,date:new Date().toLocaleDateString("pt-BR")},...goals];
    setGoals(u); [span_307](start_span)DB.setGoals(user?.id,u); setGtxt("");[span_307](end_span)
  };
  [span_308](start_span)const toggleGoal=id=>{const u=goals.map(g=>g.id===id?{...g,done:!g.done}:g);setGoals(u);DB.setGoals(user?.id,u);};[span_308](end_span)
  const toggleHabit=id=>{
    const u=habits.map(h=>h.id===id?{...h,done:!h.done,streak:!h.done?h.streak+1:h.streak}:h);
    setHabits(u); [span_309](start_span)DB.setHabits(user?.id,u); addXP(5); showToast("🔁 Hábito marcado! +5 XP");[span_309](end_span)
  };
  const addCheck=()=>{
    if(!ctxt.trim()) return;
    const u=[...checks,{id:Date.now(),text:ctxt,done:false}]; setChecks(u); [span_310](start_span)DB.setChecklist(user?.id,u); setCtxt("");[span_310](end_span)
  };
  [span_311](start_span)const toggleCheck=id=>{const u=checks.map(c=>c.id===id?{...c,done:!c.done}:c);setChecks(u);DB.setChecklist(user?.id,u);};[span_311](end_span)
  [span_312](start_span)const delNote=id=>{const u=notes.filter(n=>n.id!==id);setNotes(u);DB.setNotes(user?.id,u);};[span_312](end_span)
  [span_313](start_span)const delGoal=id=>{const u=goals.filter(g=>g.id!==id);setGoals(u);DB.setGoals(user?.id,u);};[span_313](end_span)
  [span_314](start_span)const delCheck=id=>{const u=checks.filter(c=>c.id!==id);setChecks(u);DB.setChecklist(user?.id,u);};[span_314](end_span)

  [span_315](start_span)const toolTabs=[{id:"pomodoro",i:"⏱️",l:"Pomodoro"},{id:"checklist",i:"✅",l:"Checklist"},{id:"notes",i:"📝",l:"Notas"},{id:"goals",i:"🎯",l:"Metas"},{id:"habits",i:"🔁",l:"Hábitos"},{id:"planner",i:"📅",l:"Planner"}];[span_315](end_span)

  return (
    <div style={{maxWidth:900,margin:"0 auto"}}>
      <Toast msg={toast}/>
      <div style={{display:"flex",gap:8,marginBottom:26,flexWrap:"wrap"}}>
        {toolTabs.map(t=>(
          <button key={t.id} onClick={()=>setTool(t.id)}
            style={{padding:"8px 16px",borderRadius:9,border:`2px solid ${tool===t.id?C.accent:C.border}`,background:tool===t.id?"#6366f116":C.card,color:tool===t.id?C.accent:C.muted,cursor:"pointer",fontWeight:600,fontSize:13,transition:"all 0.18s",fontFamily:"inherit"}}>
            {t.i} {t.l}
          [span_316](start_span)</button>[span_316](end_span)
        ))}
      </div>

      {tool==="pomodoro"&&(
        <div style={{maxWidth:380,margin:"0 auto"}}>
          <Card sx={{textAlign:"center",padding:36}}>
            <div style={{marginBottom:14}}><Badge text={pomType==="work"?"🍅 Foco":"☕ Pausa"} color={pomType==="work"?C.red:C.green}/></div>
            <div style={{fontSize:76,fontFamily:"'Syne',sans-serif",fontWeight:900,color:pomType==="work"?C.red:C.green,letterSpacing:-2,margin:"18px 0 6px"}}>{fmt(pomTime)}</div>
            <div style={{width:200,margin:"0 auto 24px",background:C.border,borderRadius:999,height:7,overflow:"hidden"}}>
              [span_317](start_span)<div style={{width:`${pct}%`,background:pomType==="work"?C.red:C.green,height:"100%",borderRadius:999,transition:"width 1s linear"}}/>[span_317](end_span)
            </div>
            <div style={{display:"flex",gap:11,justifyContent:"center",flexWrap:"wrap",marginBottom:16}}>
              <Btn onClick={()=>setPomActive(!pomActive)} v={pomActive?"danger":"success"}>{pomActive?"⏸ Pausar":"▶ Iniciar"}</Btn>
              [span_318](start_span)<Btn v="secondary" onClick={()=>{setPomActive(false);setPomTime(25*60);setPomType("work");}}>🔄 Reset</Btn>[span_318](end_span)
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
              [span_319](start_span){[["25min",1500,"work"],["5min",300,"break"],["15min",900,"break"]].map(([l,s,tp])=>([span_319](end_span)
                <button key={l} onClick={()=>{setPomTime(s);setPomType(tp);setPomActive(false);}}
                  style={{padding:"5px 13px",borderRadius:7,border:`1px solid ${C.border}`,background:C.surface,color:C.muted,cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>{l}</button>
              ))}
            </div>
            [span_320](start_span)<p style={{fontSize:11.5,color:C.faint,marginTop:18}}>+20 XP por sessão de 25min concluída</p>[span_320](end_span)
          </Card>
        </div>
      )}

      {tool==="checklist"&&(
        <Card>
          <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,marginBottom:18,fontSize:16}}>✅ Checklist Diário</h3>
          <div style={{display:"flex",gap:9,marginBottom:18}}>
            <input value={ctxt} onChange={e=>setCtxt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCheck()} placeholder="Adicionar tarefa do dia..."
              style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 14px",color:C.text,fontSize:13.5,fontFamily:"inherit"}}/>
            [span_321](start_span)<Btn onClick={addCheck} size="sm">+ Adicionar</Btn>[span_321](end_span)
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {checks.length===0&&<p style={{color:C.faint,fontSize:13.5,textAlign:"center",padding:"24px 0"}}>Nenhuma tarefa ainda. [span_322](start_span)Adicione suas atividades do dia!</p>}[span_322](end_span)
            {checks.map(c=>(
              <div key={c.id} style={{display:"flex",alignItems:"center",gap:11,padding:"11px 14px",background:C.surface,borderRadius:9,opacity:c.done?0.6:1}}>
                <div onClick={()=>toggleCheck(c.id)} style={{width:20,height:20,borderRadius:5,border:`2px solid ${c.done?C.green:C.accent}`,background:c.done?"#10b98118":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",fontSize:11,color:c.done?C.green:C.accent}}>
                  {c.done&&"✓"}
                [span_323](start_span)</div>[span_323](end_span)
                <span style={{flex:1,fontSize:13.5,color:C.text,textDecoration:c.done?"line-through":"none"}}>{c.text}</span>
                [span_324](start_span)<button onClick={()=>delCheck(c.id)} style={{background:"none",border:"none",color:C.faint,cursor:"pointer",fontSize:16,lineHeight:1}}>×</button>[span_324](end_span)
              </div>
            ))}
          </div>
          {checks.length>0&&(
            <p style={{fontSize:12,color:C.muted,marginTop:14,textAlign:"right"}}>
              [span_325](start_span){checks.filter(c=>c.done).length}/{checks.length} tarefas concluídas[span_325](end_span)
            </p>
          )}
        </Card>
      )}

      {tool==="notes"&&(
        <div>
          <Card sx={{marginBottom:18}}>
            <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,marginBottom:16,fontSize:16}}>📝 Nova Anotação</h3>
            [span_326](start_span)<div style={{display:"flex",flexDirection:"column",gap:12}}>[span_326](end_span)
              <Inp label="Título (opcional)" value={ntitle} onChange={setNtitle} placeholder="Título da nota"/>
              [span_327](start_span)<Inp label="Anotação" value={ntext} onChange={setNtext} placeholder="Escreva sua anotação, dúvida ou aprendizado..." rows={4}/>[span_327](end_span)
              <Btn onClick={saveNote}>💾 Salvar Nota</Btn>
            </div>
          </Card>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(255px,1fr))",gap:13}}>
            [span_328](start_span){notes.map(n=>([span_328](end_span)
              <Card key={n.id}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:8}}>
                  <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,color:C.text}}>{n.title}</span>
                  [span_329](start_span)<button onClick={()=>delNote(n.id)} style={{background:"none",border:"none",color:C.faint,cursor:"pointer",fontSize:18,lineHeight:1,marginLeft:8}}>×</button>[span_329](end_span)
                </div>
                <p style={{fontSize:13,color:C.muted,lineHeight:1.6,whiteSpace:"pre-wrap",marginBottom:9}}>{n.text.slice(0,200)}{n.text.length>200?"...":""}</p>
                [span_330](start_span)<span style={{fontSize:11,color:C.faint}}>{n.date}</span>[span_330](end_span)
              </Card>
            ))}
          </div>
        </div>
      )}

      {tool==="goals"&&(
        <Card>
          [span_331](start_span)<h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,marginBottom:18,fontSize:16}}>🎯 Organizador de Metas</h3>[span_331](end_span)
          <div style={{display:"flex",gap:9,marginBottom:18}}>
            <input value={gtxt} onChange={e=>setGtxt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addGoal()} placeholder="Adicionar nova meta..."
              style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 14px",color:C.text,fontSize:13.5,fontFamily:"inherit"}}/>
            [span_332](start_span)<Btn onClick={addGoal} size="sm">+ Meta</Btn>[span_332](end_span)
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            [span_333](start_span){goals.map(g=>([span_333](end_span)
              <div key={g.id} style={{display:"flex",alignItems:"center",gap:11,padding:"13px 15px",background:C.surface,borderRadius:9}}>
                <div onClick={()=>toggleGoal(g.id)} style={{width:22,height:22,borderRadius:999,border:`2px solid ${g.done?C.green:C.accent}`,background:g.done?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",fontSize:12,color:"#fff"}}>
                  {g.done&&"✓"}
                [span_334](start_span)</div>[span_334](end_span)
                <span style={{flex:1,fontSize:13.5,color:C.text,textDecoration:g.done?"line-through":"none"}}>{g.text}</span>
                <span style={{fontSize:11,color:C.faint,marginRight:8}}>{g.date}</span>
                [span_335](start_span)<button onClick={()=>delGoal(g.id)} style={{background:"none",border:"none",color:C.faint,cursor:"pointer",fontSize:18,lineHeight:1}}>×</button>[span_335](end_span)
              </div>
            ))}
            {goals.length===0&&<p style={{color:C.faint,fontSize:13.5,textAlign:"center",padding:"24px 0"}}>Nenhuma meta ainda. [span_336](start_span)Defina suas metas de aprendizado!</p>}[span_336](end_span)
          </div>
        </Card>
      )}

      {tool==="habits"&&(
        <Card>
          <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,marginBottom:8,fontSize:16}}>🔁 Rastreador de Hábitos</h3>
          [span_337](start_span)<p style={{color:C.muted,fontSize:13,marginBottom:18}}>Marque os hábitos de hoje. +5 XP por hábito concluído.</p>[span_337](end_span)
          <div style={{display:"flex",flexDirection:"column",gap:11}}>
            [span_338](start_span){habits.map(h=>([span_338](end_span)
              <div key={h.id} onClick={()=>toggleHabit(h.id)}
                style={{display:"flex",alignItems:"center",gap:15,padding:"15px 18px",background:h.done?h.color+"12":C.surface,border:`1px solid ${h.done?h.color+"35":C.border}`,borderRadius:11,cursor:"pointer",transition:"all 0.2s"}}>
                <div style={{width:26,height:26,borderRadius:999,border:`2px solid ${h.color}`,background:h.done?h.color:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:13,color:"#fff"}}>
                  {h.done&&"✓"}
                [span_339](start_span)</div>[span_339](end_span)
                <span style={{flex:1,fontSize:14,fontWeight:600,color:C.text}}>{h.name}</span>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:20,fontFamily:"'Syne',sans-serif",fontWeight:900,color:h.color}}>{h.streak}</div>
                  <div style={{fontSize:10,color:C.faint}}>dias</div>
                [span_340](start_span)</div>[span_340](end_span)
              </div>
            ))}
          </div>
        </Card>
      )}

      {tool==="planner"&&(
        <Card>
          <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,marginBottom:18,fontSize:16}}>📅 Planner Semanal</h3>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:8}}>
            [span_341](start_span){["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map((d,i)=>([span_341](end_span)
              <div key={d} style={{background:C.surface,borderRadius:9,padding:11,minHeight:90}}>
                [span_342](start_span)<div style={{fontSize:11.5,fontWeight:700,color:C.muted,marginBottom:8,textAlign:"center"}}>{d}</div>[span_342](end_span)
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  <div style={{fontSize:10,background:C.accent+"1a",color:C.accent,borderRadius:4,padding:"3px 6px",textAlign:"center"}}>
                    {["Python","SQL","Power BI","Inglês","Revisão","Projeto","Descanso"][i]}
                  [span_343](start_span)</div>[span_343](end_span)
                </div>
              </div>
            ))}
          </div>
          [span_344](start_span)<p style={{fontSize:12,color:C.faint,marginTop:14,textAlign:"center"}}>Personalize o planner com seus tópicos de estudo diários</p>[span_344](end_span)
        </Card>
      )}
    </div>
  [span_345](start_span));[span_345](end_span)
}

// ── LIBRARY ──────────────────────────────────────────────────

function LibraryPage() {
  [span_346](start_span)const [search,setSearch]=useState("");[span_346](end_span)
  [span_347](start_span)const [cat,setCat]=useState("Todos");[span_347](end_span)
  [span_348](start_span)const cats=["Todos","Python","SQL","Power BI","Inglês","Datasets","Carreira"];[span_348](end_span)
  [span_349](start_span)const filtered=LIBRARY.filter(i=>(cat==="Todos"||i.cat===cat)&&(i.title.toLowerCase().includes(search.toLowerCase())||i.tags.some(t=>t.includes(search.toLowerCase()))));[span_349](end_span)
  return (
    <div style={{maxWidth:1000,margin:"0 auto"}}>
      <div style={{marginBottom:24}}>
        <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(1.3rem,3vw,1.75rem)",fontWeight:900,margin:"0 0 7px"}}>📚 Biblioteca</h2>
        <p style={{color:C.muted,fontSize:13.5}}>Materiais, cheatsheets, apostilas e recursos para sua jornada.</p>
      [span_350](start_span)</div>[span_350](end_span)
      <div style={{display:"flex",gap:11,marginBottom:18,flexWrap:"wrap",alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Buscar por título ou tag..."
          style={{flex:"1 1 200px",background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 15px",color:C.text,fontSize:13.5,fontFamily:"inherit"}}/>
        [span_351](start_span)<div style={{display:"flex",gap:7,flexWrap:"wrap"}}>[span_351](end_span)
          {cats.map(c=>(
            <button key={c} onClick={()=>setCat(c)}
              style={{padding:"7px 13px",borderRadius:7,border:`1px solid ${cat===c?C.accent:C.border}`,background:cat===c?"#6366f116":C.card,color:cat===c?C.accent:C.muted,cursor:"pointer",fontSize:12,fontWeight:600,transition:"all 0.18s",fontFamily:"inherit"}}>
              {c}
            [span_352](start_span)</button>[span_352](end_span)
          ))}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(255px,1fr))",gap:14}}>
        [span_353](start_span){filtered.map(item=>([span_353](end_span)
          <Card key={item.id} sx={{transition:"all 0.2s",cursor:"default"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.transform="translateY(-2px)";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform="none";}}>
            <div style={{fontSize:30,marginBottom:11}}>{item.icon}</div>
            <div style={{display:"flex",gap:6,marginBottom:9,flexWrap:"wrap"}}>
              <Badge text={item.cat} color={C.accent}/>
              [span_354](start_span)<Badge text={item.type} color={C.faint}/>[span_354](end_span)
            </div>
            <h4 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,margin:"0 0 7px",color:C.text}}>{item.title}</h4>
            <p style={{fontSize:12.5,color:C.muted,lineHeight:1.55,margin:"0 0 12px"}}>{item.desc}</p>
            <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:13}}>
              [span_355](start_span){item.tags.map(t=><span key={t} style={{fontSize:10,color:C.faint,background:C.surface,borderRadius:4,padding:"2px 7px"}}>#{t}</span>)}[span_355](end_span)
            </div>
            <a href={item.url} target="_blank" rel="noopener noreferrer" style={{textDecoration:"none"}}>
              [span_356](start_span)<Btn size="sm" v="secondary" sx={{width:"100%",justifyContent:"center"}}>📖 Acessar</Btn>[span_356](end_span)
            </a>
          </Card>
        ))}
      </div>
      {filtered.length===0&&<p style={{textAlign:"center",color:C.faint,padding:40}}>Nenhum material encontrado.</p>}
    </div>
  [span_357](start_span));[span_357](end_span)
}

// ── PORTFOLIO ────────────────────────────────────────────────

function Portfolio() {
  [span_358](start_span)const {user}=useAuth();[span_358](end_span)
  [span_359](start_span)const {addXP,save}=useProgress();[span_359](end_span)
  [span_360](start_span)const [projs,setProjs]=useState(()=>DB.portfolio(user?.id));[span_360](end_span)
  [span_361](start_span)const [showForm,setShowForm]=useState(false);[span_361](end_span)
  [span_362](start_span)const [form,setForm]=useState({title:"",desc:"",tech:"",github:"",demo:"",level:"Iniciante"});[span_362](end_span)
  [span_363](start_span)const [toast,setToast]=useState("");[span_363](end_span)
  [span_364](start_span)const showToast=(m)=>{setToast(m);setTimeout(()=>setToast(""),2800);};[span_364](end_span)

  const saveProj=()=>{
    [span_365](start_span)if(!form.title) return;[span_365](end_span)
    [span_366](start_span)const u=[{id:Date.now(),...form,date:new Date().toLocaleDateString("pt-BR")},...projs];[span_366](end_span)
    setProjs(u); [span_367](start_span)DB.setPortfolio(user?.id,u);[span_367](end_span)
    [span_368](start_span)addXP(50); save({portfolioCount:(DB.progress(user?.id).portfolioCount||0)+1});[span_368](end_span)
    [span_369](start_span)setForm({title:"",desc:"",tech:"",github:"",demo:"",level:"Iniciante"});[span_369](end_span)
    [span_370](start_span)setShowForm(false);[span_370](end_span)
    [span_371](start_span)showToast("🚀 Projeto adicionado! +50 XP");[span_371](end_span)
  };

  const ideas=[
    [span_372](start_span){t:"Análise de Vendas E-commerce",tech:"Python, Pandas, Matplotlib",lvl:"Iniciante",d:"Analise vendas, identifique padrões e crie visualizações com insights de negócio."},[span_372](end_span)
    [span_373](start_span){t:"Dashboard KPIs no Power BI",tech:"Power BI, DAX",lvl:"Iniciante",d:"Dashboard executivo com indicadores de uma empresa fictícia."},[span_373](end_span)
    [span_374](start_span){t:"Análise de Churn de Clientes",tech:"Python, SQL, Pandas",lvl:"Intermediário",d:"Identifique padrões de cancelamento e proponha ações de retenção."},[span_374](end_span)
    [span_375](start_span){t:"ETL Pipeline com Python",tech:"Python, SQLite, Pandas",lvl:"Intermediário",d:"Pipeline que extrai, transforma e carrega dados de múltiplas fontes."},[span_375](end_span)
    [span_376](start_span){t:"Relatório de Mercado SQL",tech:"SQL, Power BI",lvl:"Intermediário",d:"Análise de mercado com queries avançadas visualizadas no Power BI."},[span_376](end_span)
    [span_377](start_span){t:"Sistema de Recomendação",tech:"Python, Pandas, NumPy",lvl:"Avançado",d:"Recomendação baseada em filtragem colaborativa por similaridade."},[span_377](end_span)
  ];
  return (
    <div style={{maxWidth:1000,margin:"0 auto"}}>
      <Toast msg={toast}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:26,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(1.3rem,3vw,1.75rem)",fontWeight:900,margin:"0 0 7px"}}>💼 Portfólio</h2>
          <p style={{color:C.muted,fontSize:13.5}}>Construa e gerencie seu portfólio de dados.</p>
        [span_378](start_span)</div>[span_378](end_span)
        <Btn onClick={()=>setShowForm(!showForm)}>+ Projeto (+50 XP)</Btn>
      </div>

      {showForm&&(
        <Card sx={{border:`1px solid ${C.accent}28`,marginBottom:24}}>
          [span_379](start_span)<h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,marginBottom:18,fontSize:16}}>📁 Novo Projeto</h3>[span_379](end_span)
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            [span_380](start_span)<div style={{gridColumn:"1/-1"}}><Inp label="Título do Projeto" value={form.title} onChange={v=>setForm({...form,title:v})} placeholder="Ex: Análise de Vendas E-commerce"/></div>[span_380](end_span)
            [span_381](start_span)<div style={{gridColumn:"1/-1"}}><Inp label="Descrição" value={form.desc} onChange={v=>setForm({...form,desc:v})} placeholder="Problema resolvido, tecnologias e resultados..." rows={3}/></div>[span_381](end_span)
            <Inp label="Tecnologias" value={form.tech} onChange={v=>setForm({...form,tech:v})} placeholder="Python, Pandas, SQL..."/>
            <div>
              <label style={{color:C.muted,fontSize:12.5,fontWeight:600,display:"block",marginBottom:5}}>Nível</label>
              <select value={form.level} onChange={e=>setForm({...form,level:e.target.value})}
                style={{width:"100%",padding:"11px 13px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,color:C.text,fontSize:13.5,fontFamily:"inherit"}}>
                [span_382](start_span){["Iniciante","Intermediário","Avançado"].map(l=><option key={l}>{l}</option>)}[span_382](end_span)
              </select>
            </div>
            [span_383](start_span)<Inp label="GitHub" value={form.github} onChange={v=>setForm({...form,github:v})} placeholder="https://github.com/..." icon="🔗"/>[span_383](end_span)
            <Inp label="Demo (opcional)" value={form.demo} onChange={v=>setForm({...form,demo:v})} placeholder="https://..." icon="🌐"/>
          </div>
          <div style={{display:"flex",gap:10,marginTop:16}}>
            <Btn onClick={saveProj}>💾 Salvar</Btn>
            [span_384](start_span)<Btn v="secondary" onClick={()=>setShowForm(false)}>Cancelar</Btn>[span_384](end_span)
          </div>
        </Card>
      )}

      {projs.length>0&&(
        <div style={{marginBottom:36}}>
          <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,marginBottom:16,fontSize:15}}>Meus Projetos ({projs.length})</h3>
          [span_385](start_span)<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(275px,1fr))",gap:14}}>[span_385](end_span)
            {projs.map(p=>(
              <Card key={p.id}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                  [span_386](start_span)<Badge text={p.level} color={C.accent}/>[span_386](end_span)
                  <span style={{fontSize:11,color:C.faint}}>{p.date}</span>
                </div>
                <h4 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14.5,margin:"0 0 8px"}}>{p.title}</h4>
                [span_387](start_span)<p style={{fontSize:13,color:C.muted,lineHeight:1.55,marginBottom:11}}>{p.desc}</p>[span_387](end_span)
                <div style={{fontSize:12,color:C.faint,background:C.surface,borderRadius:6,padding:"6px 10px",marginBottom:12}}>🔧 {p.tech}</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  [span_388](start_span){p.github&&<a href={p.github} target="_blank" rel="noreferrer" style={{textDecoration:"none"}}><Btn size="sm" v="secondary">🔗 GitHub</Btn></a>}[span_388](end_span)
                  {p.demo&&<a href={p.demo} target="_blank" rel="noreferrer" style={{textDecoration:"none"}}><Btn size="sm" v="ghost">🌐 Demo</Btn></a>}
                </div>
              [span_389](start_span)</Card>[span_389](end_span)
            ))}
          </div>
        </div>
      )}

      <div style={{marginBottom:32}}>
        <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,marginBottom:16,fontSize:15}}>📋 Guia de Portfólio para Dados</h3>
        [span_390](start_span)<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(255px,1fr))",gap:12}}>[span_390](end_span)
          {[
            [span_391](start_span){n:"1",t:"Organize o GitHub",d:"Repositórios limpos, README completo, descrição clara e instruções de uso."},[span_391](end_span)
            [span_392](start_span){n:"2",t:"Projetos Python",d:"Análise exploratória, automação, web scraping, dashboard com Streamlit."},[span_392](end_span)
            [span_393](start_span){n:"3",t:"Projetos SQL",d:"Análise de vendas, segmentação, relatórios de performance, modelagem."},[span_393](end_span)
            [span_394](start_span){n:"4",t:"Power BI",d:"Dashboard de vendas, KPIs financeiros, análise de marketing."},[span_394](end_span)
            [span_395](start_span){n:"5",t:"Documente Tudo",d:"README com: problema, solução, tecnologias, como rodar e screenshots."},[span_395](end_span)
            [span_396](start_span){n:"6",t:"Publique e Compartilhe",d:"LinkedIn, GitHub Pages. Mostre resultados e impacto gerado pelos projetos."},[span_396](end_span)
          ].map(g=>(
            <Card key={g.n}>
              <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:9}}>
                <span style={{width:26,height:26,borderRadius:999,background:C.accent,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12.5,fontWeight:800,flexShrink:0}}>{g.n}</span>
                <h4 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13.5}}>{g.t}</h4>
              [span_397](start_span)</div>[span_397](end_span)
              <p style={{fontSize:13,color:C.muted,lineHeight:1.55}}>{g.d}</p>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,marginBottom:16,fontSize:15}}>💡 Ideias de Projetos para Portfólio</h3>
        [span_398](start_span)<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:12}}>[span_398](end_span)
          {ideas.map((p,i)=>(
            [span_399](start_span)<Card key={i}>[span_399](end_span)
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:9,flexWrap:"wrap",gap:6}}>
                <Badge text={p.lvl} color={p.lvl==="Iniciante"?C.green:p.lvl==="Intermediário"?C.yellow:C.red}/>
              [span_400](start_span)</div>[span_400](end_span)
              <h4 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13.5,margin:"0 0 7px"}}>{p.t}</h4>
              <p style={{fontSize:12.5,color:C.muted,lineHeight:1.55,marginBottom:8}}>{p.d}</p>
              [span_401](start_span)<div style={{fontSize:11.5,color:C.faint}}>🔧 {p.tech}</div>[span_401](end_span)
            </Card>
          ))}
        </div>
      </div>
    </div>
  [span_402](start_span));[span_402](end_span)
}

// ── RESUME ────────────────────────────────────────────────────

function ResumePage() {
  [span_403](start_span)const {user}=useAuth();[span_403](end_span)
  [span_404](start_span)const {addXP}=useProgress();[span_404](end_span)
  [span_405](start_span)const [cv,setCv]=useState(()=>DB.resume(user?.id));[span_405](end_span)
  [span_406](start_span)const [sec,setSec]=useState("info");[span_406](end_span)
  [span_407](start_span)const [saved,setSaved]=useState(false);[span_407](end_span)
  [span_408](start_span)const [toast,setToast]=useState("");[span_408](end_span)
  [span_409](start_span)const showToast=(m)=>{setToast(m);setTimeout(()=>setToast(""),2500);};[span_409](end_span)
  [span_410](start_span)const upd=(f,v)=>setCv(p=>({...p,[f]:v}));[span_410](end_span)
  [span_411](start_span)const save=()=>{DB.setResume(user?.id,cv);addXP(15);setSaved(true);setTimeout(()=>setSaved(false),2000);showToast("💾 Currículo salvo! +15 XP");};[span_411](end_span)
  const checks=[
    [span_412](start_span){l:"Nome completo",done:!!cv.name},{l:"Email profissional",done:!!cv.email},[span_412](end_span)
    {l:"LinkedIn",done:!!cv.linkedin},{l:"GitHub com projetos",done:!!cv.github},
    {l:"Resumo profissional",done:!!cv.summary},{l:"Habilidades listadas",done:cv.skills?.length>0},
    {l:"Projetos com resultados",done:cv.projects?.length>0},
    {l:"Palavras-chave de dados",done:cv.summary?.toLowerCase().includes("dados")||cv.summary?.toLowerCase().includes("python")||false},
  [span_413](start_span)];[span_413](end_span)
  [span_414](start_span)const score=Math.round((checks.filter(c=>c.done).length/checks.length)*100);[span_414](end_span)

  [span_415](start_span)const tabs=[{id:"info",l:"📋 Info"},{id:"summary",l:"📝 Resumo"},{id:"skills",l:"🔧 Skills"},{id:"projects",l:"🚀 Projetos"},{id:"preview",l:"👁️ Preview"}];[span_415](end_span)

  return (
    <div style={{maxWidth:880,margin:"0 auto"}}>
      <Toast msg={toast}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(1.3rem,3vw,1.75rem)",fontWeight:900,margin:"0 0 7px"}}>📄 Currículo ATS</h2>
          <p style={{color:C.muted,fontSize:13.5}}>Monte seu currículo otimizado para sistemas de recrutamento automático.</p>
        [span_416](start_span)</div>[span_416](end_span)
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <div style={{background:score>70?"#10b98118":"#f59e0b18",border:`1px solid ${score>70?C.green:C.yellow}30`,borderRadius:10,padding:"8px 14px",textAlign:"center"}}>
            <div style={{fontSize:20,fontWeight:900,color:score>70?C.green:C.yellow}}>{score}%</div>
            <div style={{fontSize:10.5,color:C.muted}}>ATS Score</div>
          [span_417](start_span)</div>[span_417](end_span)
          <Btn onClick={save} v={saved?"success":"primary"}>{saved?"✅ Salvo!":"💾 Salvar"}</Btn>
        </div>
      </div>

      <Card sx={{marginBottom:20}}>
        <h4 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,marginBottom:11,fontSize:13.5}}>✅ Checklist ATS</h4>
        [span_418](start_span)<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:7}}>[span_418](end_span)
          {checks.map((c,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:7,fontSize:13}}>
              <span style={{color:c.done?C.green:C.faint}}>{c.done?"✅":"⬜"}</span>
              <span style={{color:c.done?C.text:C.faint}}>{c.l}</span>
            [span_419](start_span)</div>[span_419](end_span)
          ))}
        </div>
      </Card>

      <div style={{display:"flex",gap:7,marginBottom:20,flexWrap:"wrap"}}>
        [span_420](start_span){tabs.map(t=>([span_420](end_span)
          <button key={t.id} onClick={()=>setSec(t.id)}
            style={{padding:"7px 14px",borderRadius:8,border:`1px solid ${sec===t.id?C.accent:C.border}`,background:sec===t.id?"#6366f116":C.card,color:sec===t.id?C.accent:C.muted,cursor:"pointer",fontSize:12.5,fontWeight:600,transition:"all 0.18s",fontFamily:"inherit"}}>
            {t.l}
          [span_421](start_span)</button>[span_421](end_span)
        ))}
      </div>

      <Card>
        {sec==="info"&&(
          [span_422](start_span)<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>[span_422](end_span)
            <div style={{gridColumn:"1/-1"}}><Inp label="Nome Completo" value={cv.name} onChange={v=>upd("name",v)} placeholder="João Silva"/></div>
            [span_423](start_span)<Inp label="Título Profissional" value={cv.title} onChange={v=>upd("title",v)} placeholder="Analista de Dados | Python & SQL"/>[span_423](end_span)
            <Inp label="Email" type="email" value={cv.email} onChange={v=>upd("email",v)} placeholder="joao@email.com"/>
            <Inp label="Telefone" value={cv.phone} onChange={v=>upd("phone",v)} placeholder="(11) 99999-9999"/>
            <Inp label="LinkedIn" value={cv.linkedin} onChange={v=>upd("linkedin",v)} placeholder="linkedin.com/in/joaosilva" icon="🔗"/>
            [span_424](start_span)<Inp label="GitHub" value={cv.github} onChange={v=>upd("github",v)} placeholder="github.com/joaosilva" icon="🐙"/>[span_424](end_span)
          </div>
        )}
        {sec==="summary"&&(
          <div>
            <Inp label="Resumo Profissional (2-3 linhas, otimizado para ATS)" value={cv.summary} onChange={v=>upd("summary",v)} rows={4}
              [span_425](start_span)placeholder="Analista de Dados com experiência em Python, SQL e Power BI. Especialista em transformar dados em insights estratégicos. Projetos de análise de vendas, automação e dashboards executivos com resultados mensuráveis."/>[span_425](end_span)
            <div style={{marginTop:14,background:C.surface,borderRadius:9,padding:14}}>
              [span_426](start_span)<p style={{fontSize:12.5,color:C.muted,marginBottom:9,fontWeight:600}}>💡 Palavras-chave recomendadas para ATS:</p>[span_426](end_span)
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                {["Python","SQL","Power BI","Pandas","ETL","Análise de dados","Dashboard","KPI","DAX","Data-driven","Visualização","Excel","NumPy","Git","Tableau"].map(k=>(
                  <span key={k} style={{fontSize:11,background:C.accent+"1a",color:C.accent,borderRadius:5,padding:"3px 9px"}}>{k}</span>
                ))}
              </div>
            </div>
          </div>
        )}
        {sec==="skills"&&(
          <div>
            <Inp label="Habilidades técnicas (separadas por vírgula)" value={cv.skills?.join(", ")||""} onChange={v=>upd("skills",v.split(",").map(s=>s.trim()).filter(Boolean))} rows={3}
              placeholder="Python, Pandas, NumPy, SQL, Power BI, Excel, DAX, ETL, Git, Matplotlib, Seaborn, Tableau"/>
            {cv.skills?.length>0&&(
              <div style={{display:"flex",gap:7,flexWrap:"wrap",marginTop:12}}>
                {cv.skills.map(s=><Badge key={s} text={s} color={C.accent}/>)}
              </div>
            )}
          </div>
        )}
        {sec==="projects"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <h4 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14}}>Projetos no Currículo</h4>
              <Btn size="sm" onClick={()=>upd("projects",[...(cv.projects||[]),{title:"",desc:"",tech:"",link:""}])}>+ Adicionar</Btn>
            </div>
            {(cv.projects||[]).map((p,i)=>(
              <div key={i} style={{background:C.surface,borderRadius:10,padding:16,marginBottom:12}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                  <input value={p.title} onChange={e=>{const ps=[...cv.projects];ps[i].title=e.target.value;upd("projects",ps);}} placeholder="Nome do projeto"
                    style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 13px",color:C.text,fontSize:13,fontFamily:"inherit"}}/>
                  <input value={p.tech} onChange={e=>{const ps=[...cv.projects];ps[i].tech=e.target.value;upd("projects",ps);}} placeholder="Tecnologias"
                    style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 13px",color:C.text,fontSize:13,fontFamily:"inherit"}}/>
                </div>
                <textarea value={p.desc} onChange={e=>{const ps=[...cv.projects];ps[i].desc=e.target.value;upd("projects",ps);}} rows={2}
                  placeholder="Ex: Desenvolvi dashboard de vendas que reduziu o tempo de análise em 60%..."
                  style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:13,padding:11,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}}/>
              </div>
            ))}
          </div>
        )}
        {sec==="preview"&&(
          <div style={{background:"#fff",color:"#1a1a1a",borderRadius:10,padding:"36px 40px",fontFamily:"Arial,sans-serif",fontSize:13,lineHeight:1.65}}>
            <div style={{borderBottom:"3px solid #6366f1",paddingBottom:18,marginBottom:18}}>
              <h1 style={{fontSize:22,fontWeight:900,margin:"0 0 5px",color:"#1a1a1a"}}>{cv.name||"Seu Nome"}</h1>
              <p style={{fontSize:14,color:"#6366f1",fontWeight:700,margin:"0 0 9px"}}>{cv.title||"Analista de Dados"}</p>
              <div style={{display:"flex",gap:18,flexWrap:"wrap",fontSize:12,color:"#555"}}>
                {cv.email&&<span>✉️ {cv.email}</span>}
                {cv.phone&&<span>📱 {cv.phone}</span>}
                {cv.linkedin&&<span>🔗 {cv.linkedin}</span>}
                {cv.github&&<span>🐙 {cv.github}</span>}
              </div>
            </div>
            {cv.summary&&<div style={{marginBottom:18}}>
              <h2 style={{fontSize:12,fontWeight:800,color:"#6366f1",textTransform:"uppercase",letterSpacing:1,marginBottom:7}}>Perfil Profissional</h2>
              <p style={{color:"#333",lineHeight:1.7,margin:0}}>{cv.summary}</p>
            </div>}
            {cv.skills?.length>0&&<div style={{marginBottom:18}}>
              <h2 style={{fontSize:12,fontWeight:800,color:"#6366f1",textTransform:"uppercase",letterSpacing:1,marginBottom:7}}>Competências Técnicas</h2>
              <p style={{margin:0,color:"#333"}}>{cv.skills.join(" · ")}</p>
            </div>}
            {cv.projects?.filter(p=>p.title).length>0&&<div>
              <h2 style={{fontSize:12,fontWeight:800,color:"#6366f1",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Projetos</h2>
              {cv.projects.filter(p=>p.title).map((p,i)=>(
                <div key={i} style={{marginBottom:11}}>
                  <strong>{p.title}</strong>{p.tech&&<em style={{color:"#555",fontSize:12}}> — {p.tech}</em>}
                  {p.desc&&<p style={{fontSize:12,color:"#444",margin:"4px 0 0",lineHeight:1.5}}>{p.desc}</p>}
                </div>
              ))}
            </div>}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── PROFILE ──────────────────────────────────────────────────

function ProfilePage() {
  const {user}=useAuth();
  const {progress}=useProgress();
  if(!progress) return null;
  const earned=ACHIEVEMENTS.filter(a=>progress.achievements?.includes(a.id));
  const all=ACHIEVEMENTS.filter(a=>!progress.achievements?.includes(a.id));
  return (
    <div style={{maxWidth:700,margin:"0 auto",display:"flex",flexDirection:"column",gap:20}}>
      <div style={{background:"linear-gradient(135deg,#1e1b4b,#1a2744)",border:"1px solid #6366f128",borderRadius:18,padding:"28px 30px",textAlign:"center",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",right:-10,top:-10,fontSize:80,opacity:0.04}}>⚡</div>
        <div style={{width:72,height:72,borderRadius:999,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:32,marginBottom:14}}>👤</div>
        <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900,margin:"0 0 5px"}}>{user?.name}</h2>
        <p style={{color:C.muted,fontSize:13.5,margin:"0 0 14px"}}>{user?.email}</p>
        <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
          <Badge text={`Nível ${progress.level}`} color={C.accent}/>
          <Badge text={`${progress.xp} XP`} color={C.accent2}/>
          <Badge text={`🔥 ${progress.streak} dias`} color={C.red}/>
          <Badge text={`Dia ${(progress.completedDays.length||0)+1}/90`} color={C.green}/>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(145px,1fr))",gap:12}}>
        <Stat icon="📅" label="Dias Completos" value={progress.completedDays.length} color={C.accent}/>
        <Stat icon="⚡" label="XP Total" value={progress.xp} color={C.accent2}/>
        <Stat icon="🔥" label="Streak" value={`${progress.streak}d`} color={C.red}/>
        <Stat icon="🏆" label="Conquistas" value={earned.length} color={C.green}/>
      </div>
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:13}}>
          <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14.5}}>Progresso de Nível</h3>
          <Badge text={`Nível ${progress.level}`} color={C.accent}/>
        </div>
        <XPBar xp={progress.xp} level={progress.level}/>
        <p style={{fontSize:11.5,color:C.faint,marginTop:7,textAlign:"right"}}>{xpForNext(progress.level)-progress.xp} XP para Nível {progress.level+1}</p>
      </Card>
      {earned.length>0&&(
        <Card>
          <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14.5,margin:"0 0 14px"}}>🏆 Conquistas Desbloqueadas ({earned.length})</h3>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(195px,1fr))",gap:10}}>
            {earned.map(a=>(
              <div key={a.id} style={{background:C.surface,borderRadius:9,padding:"10px 14px",display:"flex",alignItems:"center",gap:9}}>
                <span style={{fontSize:22}}>{a.icon}</span>
                <div><div style={{fontSize:13,fontWeight:700}}>{a.name}</div><div style={{fontSize:11,color:C.muted}}>{a.desc}</div></div>
              </div>
            ))}
          </div>
        </Card>
      )}
      {all.length>0&&(
        <Card>
          <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14.5,margin:"0 0 14px"}}>🔒 Conquistas Bloqueadas</h3>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(195px,1fr))",gap:10}}>
            {all.map(a=>(
              <div key={a.id} style={{background:C.surface,borderRadius:9,padding:"10px 14px",display:"flex",alignItems:"center",gap:9,opacity:0.45}}>
                <span style={{fontSize:22}}>🔒</span>
                <div><div style={{fontSize:13,fontWeight:700}}>{a.name}</div><div style={{fontSize:11,color:C.muted}}>{a.desc}</div></div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Card>
        <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14.5,margin:"0 0 14px"}}>🔒 Segurança da Conta</h3>
        {[
          ["✅ Hash de senha SHA-256 aplicado",C.green],
          ["✅ JWT com expiração de 24 horas",C.green],
          ["✅ Rate limiting: máx. 5 tentativas em 15 min",C.green],
          ["✅ Sanitização de inputs (XSS prevention)",C.green],
          ["✅ Dados isolados por usuário (user isolation)",C.green],
          ["✅ Sessão via sessionStorage (não persiste)",C.green],
        ].map(([t,c])=>(
          <div key={t} style={{fontSize:13,color:c,display:"flex",alignItems:"center",gap:7,marginBottom:7}}>{t}</div>
        ))}
        <div style={{marginTop:14,background:C.surface,borderRadius:8,padding:"10px 13px"}}>
          <p style={{fontSize:11.5,color:C.faint,margin:0}}>
            ⚠️ <strong style={{color:C.text}}>Em produção:</strong> use HTTPS obrigatório, bcrypt/argon2 para hash real, PostgreSQL com queries parametrizadas, variáveis de ambiente seguras (.env), headers de segurança (Helmet.js), CORS configurado e refresh tokens.
          </p>
        </div>
      </Card>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────

function AppRoot() {
  const [page,setPage]=useState("landing");
  const {user,loading}=useAuth();

  useEffect(()=>{
    if(!loading&&user) setPage("app");
    else if(!loading&&!user&&page==="app") setPage("landing");
  },[user,loading]);
  if(loading) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Outfit',sans-serif"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:50,height:50,borderRadius:14,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:26,marginBottom:14}}>⚡</div>
        <p style={{color:C.muted,fontSize:14}}>Carregando DataPath...</p>
      </div>
    </div>
  );
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=Outfit:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:${C.bg};font-family:'Outfit',sans-serif}
      `}</style>
      {page==="landing"&&<Landing onLogin={()=>setPage("login")} onRegister={()=>setPage("register")}/>}
      {page==="login"&&<AuthPage mode="login" onSuccess={()=>setPage("app")}/>}
      {page==="register"&&<AuthPage mode="register" onSuccess={()=>setPage("app")}/>}
      {page==="app"&&user&&(
        <ProgressProvider>
          <AppShell/>
        </ProgressProvider>
      )}
    </>
  );
}

export default function DataPath() {
  return (
    <AuthProvider>
      <AppRoot/>
    </AuthProvider>
  );
}

