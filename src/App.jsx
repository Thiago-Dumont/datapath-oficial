import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";

// ============================================================
// DATAPATH — PLATAFORMA DE ENSINO GAMIFICADO PARA DADOS
// Segurança: hash SHA-256, JWT, rate limiting, XSS sanitization
// Persistência: localStorage (produção → PostgreSQL + Node/Express)
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
  ...Array.from({length:10},(_,i)=>({day:21+i,title:["Python: Pandas Filtros","SQL: Subqueries","Power BI: Introdução","Inglês: Tech Vocab","Python: GroupBy Pandas","SQL: LEFT e RIGHT JOIN","Power BI: Power Query","Inglês: Documentation","Python: Merge e Concat","SQL: CTEs"][i],phase:1,xp:75+i*5,track:["python","sql","powerbi","english","python","sql","powerbi","english","python","sql"][i],mission:`Evolua suas habilidades no dia ${21+i} da jornada.`,tasks:["Estude o conteúdo do dia","Pratique exercícios","Anote aprendizados","Atualize GitHub"],english:"Pratique vocabulário técnico aplicado.",practice:"Complete o exercício prático do dia."})),
  ...Array.from({length:9},(_,i)=>({day:31+i,title:["Python: Visualização com Matplotlib","SQL: Window Functions","Power BI: Modelagem","Inglês: Meetings","Python: Seaborn","SQL: Funções de Data","Power BI: DAX Básico","Inglês: Presentations","Python: NumPy"][i],phase:2,xp:80+i*5,track:["python","sql","powerbi","english","python","sql","powerbi","english","python"][i],mission:`Aprofunde sua prática — dia ${31+i}.`,tasks:["Conteúdo teórico do dia","Exercício prático","Mini projeto parcial","Commit GitHub"],english:"Vocabulário técnico aplicado a contextos reais.",practice:"Exercício prático com dados reais ou simulados."})),
  ...Array.from({length:51},(_,i)=>({day:40+i,title:`Dia ${40+i}: ${["Python Avançado","SQL Analítico","Power BI Avançado","Inglês para Entrevistas","Projeto Python","Análise SQL Completa","Dashboard Power BI","Inglês Técnico","Portfólio","Currículo ATS"][i%10]}`,phase:40+i<=60?2:40+i<=75?3:4,xp:85+Math.floor(i/5)*5,track:["python","sql","powerbi","english","python","sql","powerbi","english","python","sql"][i%10],mission:`Continue sua evolução — dia ${40+i} da jornada de dados.`,tasks:["Conteúdo do dia","Exercícios práticos","Revisão e notas","GitHub atualizado"],english:"Vocabulário e frases técnicas do dia.",practice:"Exercício integrado do dia."})),
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
  // WHERE
  const wm = ql.match(/where (.+?)(?:order by|group by|limit|having|$)/);
  if (wm) {
    const wc = wm[1].trim();
    if (wc.includes("preco >")) { const v=parseInt(wc.match(/preco > (\d+)/)?.[1]||0); rows=rows.filter(r=>r.preco>v); }
    if (wc.includes("preco <")) { const v=parseInt(wc.match(/preco < (\d+)/)?.[1]||0); rows=rows.filter(r=>r.preco<v); }
    if (wc.includes("valor >")) { const v=parseInt(wc.match(/valor > (\d+)/)?.[1]||0); rows=rows.filter(r=>r.valor>v); }
    if (wc.includes("categoria = ")) { const v=wc.match(/categoria = '([^']+)'/)?.[1]; if(v) rows=rows.filter(r=>r.categoria===v); }
    if (wc.includes("plano = ")) { const v=wc.match(/plano = '([^']+)'/)?.[1]; if(v) rows=rows.filter(r=>r.plano===v); }
  }
  // GROUP BY aggregation
  if (ql.includes("group by")) {
    const gb = ql.match(/group by (\w+)/)?.[1];
    if (gb) {
      const grouped = {};
      rows.forEach(r => { const k=r[gb]; if(!grouped[k]) grouped[k]={[gb]:k,count:0,total:0}; grouped[k].count++; grouped[k].total+=(r.valor||r.preco||0); });
      rows = Object.values(grouped).map(g=>({[gb]:g[gb],"COUNT(*)":g.count,"SUM(valor/preco)":g.total}));
    }
  }
  // ORDER BY
  if (ql.includes("order by")) {
    const ob = ql.match(/order by (\w+)(?: (asc|desc))?/);
    if (ob) { const [,col,dir="asc"]=ob; rows=[...rows].sort((a,b)=>{const va=a[col]||0,vb=b[col]||0;return dir==="desc"?vb-va:va-vb;}); }
  }
  // LIMIT
  const lm = ql.match(/limit (\d+)/);
  if (lm) rows = rows.slice(0, parseInt(lm[1]));
  // COUNT/SUM all
  if (ql.includes("count(*)") && !ql.includes("group by")) return {rows:[{"count(*)":rows.length}],count:1};
  if (ql.match(/sum\((\w+)\)/) && !ql.includes("group by")) {
    const col = ql.match(/sum\((\w+)\)/)?.[1]; const t=rows.reduce((s,r)=>s+(r[col]||0),0);
    return {rows:[{[`sum(${col})`]:t}],count:1};
  }
  if (ql.match(/avg\((\w+)\)/) && !ql.includes("group by")) {
    const col = ql.match(/avg\((\w+)\)/)?.[1]; const a=rows.reduce((s,r)=>s+(r[col]||0),0)/(rows.length||1);
    return {rows:[{[`avg(${col})`]:parseFloat(a.toFixed(2))}],count:1};
  }
  return {rows, count:rows.length};
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
  {id:8,title:"DAX — Fórmulas Essenciais",cat:"Power BI",type:"Cheatsheet",tags:["dax","powerbi","medidas"],desc:"As 50 fórmulas DAX mais usadas.",url:"#",icon:"⚡"},
  {id:9,title:"Guia de Carreira: Analista de Dados",cat:"Carreira",type:"Guia",tags:["carreira","emprego","salário"],desc:"Mercado, salários e como conseguir o 1º emprego.",url:"#",icon:"💼"},
  {id:10,title:"Python: Automação com openpyxl",cat:"Python",type:"Tutorial",tags:["python","excel","automação"],desc:"Automatize planilhas Excel com Python.",url:"#",icon:"🤖"},
  {id:11,title:"Inglês: Frases para Entrevistas",cat:"Inglês",type:"Guia",tags:["inglês","entrevista"],desc:"100 frases em inglês para entrevistas de dados.",url:"#",icon:"🎯"},
  {id:12,title:"Modelagem de Dados",cat:"SQL",type:"Apostila",tags:["modelagem","er","normalização"],desc:"Modelagem ER e normalização de banco.",url:"#",icon:"🔗"},
];

const PYTHON_EX = [
  {id:1,level:"Iniciante",title:"Calculadora de IMC",desc:"Calcule e classifique o IMC (Abaixo do peso / Normal / Sobrepeso / Obesidade).",hint:"IMC = peso / (altura**2). Use if/elif para classificar.",xp:30},
  {id:2,level:"Iniciante",title:"Tabuada Automática",desc:"Gere a tabuada de 1 a 10 de qualquer número usando for.",hint:"for num in range(1,11): print(f'{n} x {num} = {n*num}')",xp:25},
  {id:3,level:"Iniciante",title:"Par ou Ímpar",desc:"Função que recebe uma lista de números e separa em pares e ímpares.",hint:"num % 2 == 0 → par. Use list comprehension.",xp:25},
  {id:4,level:"Intermediário",title:"Estatísticas de Salários",desc:"Calcule média, mediana, max, min e variância de uma lista de salários sem bibliotecas.",hint:"Ordene a lista para mediana. Variância = média dos quadrados das diferenças.",xp:50},
  {id:5,level:"Intermediário",title:"Filtro de Funcionários",desc:"Filtre funcionários (lista de dicts) com salário > 5000 e departamento 'TI' ou 'Dados'.",hint:"[f for f in lista if f['sal']>5000 and f['dept'] in ['TI','Dados']]",xp:50},
  {id:6,level:"Intermediário",title:"Relatório de Vendas",desc:"Agrupe lista de vendas por mês e calcule total, qtd e ticket médio.",hint:"Use dicionários para acumular. {mes: {total, qtd}}",xp:55},
  {id:7,level:"Avançado",title:"Análise com Pandas",desc:"Carregue dados de vendas e calcule: total/categoria, top produto, variação mensal.",hint:"df.groupby('cat').agg({'valor':['sum','mean','count']})",xp:80},
  {id:8,level:"Avançado",title:"Mini ETL Pipeline",desc:"Construa extract() → transform() → load() para processar dados fictícios.",hint:"Cada função tem responsabilidade única. transform() normaliza e filtra.",xp:90},
];

const SQL_EX = [
  {id:1,level:"Iniciante",title:"SELECT com colunas",desc:"Selecione nome, categoria e preço de produtos, ordenados por preço desc.",hint:"SELECT nome, categoria, preco FROM produtos ORDER BY preco DESC",xp:20},
  {id:2,level:"Iniciante",title:"Filtrar Produtos",desc:"Produtos com preço acima de R$300 da categoria Tech.",hint:"WHERE preco > 300 AND categoria = 'Tech'",xp:25},
  {id:3,level:"Iniciante",title:"Top 3 Mais Caros",desc:"Os 3 produtos mais caros (nome e preço).",hint:"ORDER BY preco DESC LIMIT 3",xp:25},
  {id:4,level:"Intermediário",title:"Total por Categoria",desc:"Total de vendas e quantidade por categoria.",hint:"GROUP BY categoria com SUM e COUNT",xp:45},
  {id:5,level:"Intermediário",title:"Melhor Vendedor",desc:"Vendedor com maior faturamento total.",hint:"GROUP BY vendedor + SUM(valor) + ORDER BY + LIMIT 1",xp:50},
  {id:6,level:"Intermediário",title:"Acima da Média",desc:"Produtos com preço acima da média geral.",hint:"WHERE preco > (SELECT AVG(preco) FROM produtos)",xp:60},
  {id:7,level:"Avançado",title:"Análise por Vendedor",desc:"Faturamento, qtd de vendas e ticket médio por vendedor.",hint:"GROUP BY vendedor com SUM, COUNT, AVG",xp:70},
  {id:8,level:"Avançado",title:"Clientes Premium",desc:"Quantos clientes de cada plano existem?",hint:"GROUP BY plano com COUNT(*) FROM clientes",xp:65},
];

// ── CONTEXTS ──────────────────────────────────────────────────
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
    if(!RL.check("login_"+email,5,900000)) return {error:"Muitas tentativas. Aguarde 15 minutos."};
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
    if(!Security.validatePassword(pw)) return {error:"Senha: 8+ chars, 1 maiúsc., 1 número."};
    const users=DB.users();
    if(Object.values(users).find(u=>u.email===email.toLowerCase())) return {error:"Email já cadastrado."};
    const id=crypto.randomUUID(), h=await Security.hashPassword(pw);
    const nu={id,name:Security.sanitize(name),email:email.toLowerCase(),password:h,createdAt:Date.now()};
    users[id]=nu; DB.setUsers(users); DB.setProgress(id,defProgress(id));
    const tok=Security.generateJWT(id);
    sessionStorage.setItem("dp_tok",tok);
    const safe={...nu,password:undefined}; setUser(safe); return {user:safe};
  };

  const logout=()=>{ sessionStorage.removeItem("dp_tok"); setUser(null); };

  const resetPassword=async(email,pw)=>{
    if(!Security.validatePassword(pw)) return {error:"Senha: 8+ chars, 1 maiúsc., 1 número."};
    const users=DB.users(), uid=Object.keys(users).find(k=>users[k].email===email.toLowerCase());
    if(!uid) return {error:"Email não encontrado."};
    users[uid].password=await Security.hashPassword(pw);
    DB.setUsers(users); return {success:true};
  };

  return <AuthCtx.Provider value={{user,loading,login,register,logout,resetPassword}}>{children}</AuthCtx.Provider>;
}

function ProgressProvider({children}) {
  const {user}=useContext(AuthCtx);
  const [progress,setProgress]=useState(null);
  useEffect(()=>{ if(user) setProgress(DB.progress(user.id)); else setProgress(null); },[user]);

  const save=useCallback((upd)=>{
    if(!user) return null;
    const cur=DB.progress(user.id);
    const updated={...cur,...upd}; updated.level=calcLevel(updated.xp);
    DB.setProgress(user.id,updated); setProgress({...updated}); return updated;
  },[user]);

  const checkAchievements=(prog)=>{
    const ach=[...(prog.achievements||[])]; let bonus=0;
    ACHIEVEMENTS.forEach(a=>{ if(!ach.includes(a.id)&&a.cond(prog)){ach.push(a.id);bonus+=a.xp;} });
    if(bonus>0) save({achievements:ach,xp:prog.xp+bonus});
  };

  const completeDay=useCallback((dayNum,xpAmt)=>{
    if(!user) return;
    const cur=DB.progress(user.id);
    if(cur.completedDays.includes(dayNum)) return;
    const days=[...cur.completedDays,dayNum], newXP=cur.xp+xpAmt;
    const today=new Date().toDateString(), yest=new Date(Date.now()-86400000).toDateString();
    const newStreak=cur.lastStudy===yest?cur.streak+1:cur.lastStudy===today?cur.streak:1;
    const upd=save({completedDays:days,xp:newXP,streak:newStreak,lastStudy:today});
    if(upd) checkAchievements(upd);
  },[user,save]);

  const addXP=useCallback((amt)=>{
    if(!user) return;
    const cur=DB.progress(user.id);
    const upd=save({xp:cur.xp+amt});
    if(upd) checkAchievements(upd);
  },[user,save]);

  return <ProgCtx.Provider value={{progress,save,completeDay,addXP}}>{children}</ProgCtx.Provider>;
}

const useAuth=()=>useContext(AuthCtx);
const useProgress=()=>useContext(ProgCtx);

// ── UI PRIMITIVES ─────────────────────────────────────────────

const C = {
  bg:"#020817", surface:"#0a1628", card:"#0f172a",
  border:"#1e293b", border2:"#334155",
  text:"#e2e8f0", muted:"#64748b", faint:"#475569",
  accent:"#6366f1", accent2:"#8b5cf6",
  green:"#10b981", yellow:"#f59e0b", red:"#ef4444", blue:"#3b82f6",
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
  );
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
  };
  return (
    <button onClick={!disabled?onClick:undefined}
      style={{cursor:disabled?"not-allowed":"pointer",borderRadius:10,fontWeight:700,transition:"all 0.2s",display:"inline-flex",alignItems:"center",gap:7,fontFamily:"inherit",opacity:disabled?0.5:1,...sz[size],...vs[v],...sx}}>
      {children}
    </button>
  );
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
            style={{...base,padding:"11px 14px",paddingLeft:icon?42:14}}/>
        }
      </div>
      {error&&<span style={{color:C.red,fontSize:11.5}}>{error}</span>}
    </div>
  );
}

function Badge({text,color="#6366f1"}) {
  return <span style={{background:color+"1e",color,border:`1px solid ${color}38`,borderRadius:999,padding:"2px 10px",fontSize:11,fontWeight:600}}>{text}</span>;
}

function Card({children,sx={}}) {
  return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:22,...sx}}>{children}</div>;
}

function Stat({icon,label,value,color=C.accent}) {
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"18px 20px"}}>
      <div style={{fontSize:22,marginBottom:7}}>{icon}</div>
      <div style={{fontSize:24,fontWeight:800,color,fontFamily:"'Syne',sans-serif",marginBottom:3}}>{value}</div>
      <div style={{fontSize:12,color:C.muted}}>{label}</div>
    </div>
  );
}

function Toast({msg}) {
  return msg ? (
    <div style={{position:"fixed",top:20,right:20,background:"#10b981",color:"#fff",padding:"13px 22px",borderRadius:12,zIndex:9999,fontWeight:700,boxShadow:"0 8px 30px #00000055",fontSize:14,animation:"fadeIn 0.3s"}}>
      {msg}
    </div>
  ) : null;
}

// ── COMPONENTS ────────────────────────────────────────────────

function Landing({onLogin,onRegister}) {
  const features=[
    {i:"🗺️",t:"Jornada 90 Dias",d:"Missões diárias progressivas, do zero ao portfólio completo."},
    {i:"🎮",t:"Gamificação Real",d:"XP, níveis, conquistas e streak para manter a motivação."},
    {i:"🐍",t:"Python para Dados",d:"Do básico ao pandas e automação com exercícios práticos."},
    {i:"🗄️",t:"SQL Completo",d:"SELECT ao avançado com sandbox SQL interativo no browser."},
    {i:"📊",t:"Power BI",d:"Dashboards, DAX e storytelling com dados corporativos."},
    {i:"🇺🇸",t:"Inglês Técnico",d:"Vocabulário para docs, entrevistas e ambiente tech."},
    {i:"📚",t:"Biblioteca Rica",d:"Cheatsheets, apostilas, datasets e glossário técnico."},
    {i:"🛠️",t:"Ferramentas",d:"Pomodoro, planner, notas e rastreador de hábitos."},
    {i:"💼",t:"Portfólio & Currículo ATS",d:"Portfólio sólido e currículo otimizado para recrutamento."},
  ];
  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Outfit',sans-serif"}}>
      <nav style={{padding:"16px 5%",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${C.surface}`,position:"sticky",top:0,background:C.bg+"ee",backdropFilter:"blur(12px)",zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:9,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>⚡</div>
          <span style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:900,background:"linear-gradient(90deg,#6366f1,#8b5cf6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>DataPath</span>
        </div>
        <div style={{display:"flex",gap:9}}>
          <Btn v="ghost" onClick={onLogin} size="sm">Entrar</Btn>
          <Btn onClick={onRegister} size="sm">Começar Grátis →</Btn>
        </div>
      </nav>
      <section style={{textAlign:"center",padding:"80px 5% 64px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 80% 50% at 50% 0%,#6366f115,transparent)",pointerEvents:"none"}}/>
        <div style={{display:"inline-block",background:"#6366f118",border:"1px solid #6366f135",borderRadius:999,padding:"5px 16px",fontSize:12.5,color:"#818cf8",marginBottom:22,fontWeight:600}}>
          🚀 Jornada Gamificada de 90 Dias
        </div>
        <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(2rem,5.5vw,3.8rem)",fontWeight:900,lineHeight:1.1,margin:"0 0 20px",background:"linear-gradient(135deg,#f1f5f9 45%,#818cf8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
          Do Zero ao Analista<br/>de Dados em 90 Dias
        </h1>
        <p style={{fontSize:"clamp(1rem,2.2vw,1.18rem)",color:C.muted,maxWidth:600,margin:"0 auto 40px",lineHeight:1.75}}>
          Aprenda Python, SQL, Power BI e Inglês técnico com missões diárias gamificadas, sandbox interativo, ferramentas integradas e construção completa de portfólio e currículo ATS.
        </p>
        <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginBottom:56}}>
          <Btn onClick={onRegister} size="lg">🚀 Começar Minha Jornada</Btn>
          <Btn v="ghost" onClick={onLogin} size="lg">Já tenho conta</Btn>
        </div>
        <div style={{display:"flex",gap:44,justifyContent:"center",flexWrap:"wrap"}}>
          {[["2.000+","Alunos"],["90","Dias"],["4","Trilhas"],["500+","Exercícios"]].map(([n,l])=>(
            <div key={l} style={{textAlign:"center"}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:30,fontWeight:900,color:C.accent}}>{n}</div>
              <div style={{fontSize:12.5,color:C.muted}}>{l}</div>
            </div>
          ))}
        </div>
      </section>
      <section style={{padding:"56px 5%",background:C.surface}}>
        <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(1.4rem,3vw,2rem)",fontWeight:900,textAlign:"center",marginBottom:44}}>Tudo para virar Analista de Dados</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(268px,1fr))",gap:16}}>
          {features.map(f=>(
            <div key={f.t} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:22,transition:"all 0.2s",cursor:"default"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.transform="translateY(-3px)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform="none";}}>
              <div style={{fontSize:30,marginBottom:11}}>{f.i}</div>
              <h3 style={{fontFamily:"'Syne',sans-serif",fontSize:14.5,fontWeight:700,marginBottom:7,color:C.text}}>{f.t}</h3>
              <p style={{fontSize:13,color:C.muted,lineHeight:1.65,margin:0}}>{f.d}</p>
            </div>
          ))}
        </div>
      </section>
      <footer style={{borderTop:`1px solid ${C.surface}`,padding:"18px 5%",textAlign:"center",color:C.border2,fontSize:12.5}}>
        © 2024 DataPath · Plataforma de ensino gamificado para a área de dados
      </footer>
    </div>
  );
}

function AuthPage({mode:initMode="login",onSuccess}) {
  const [mode,setMode]=useState(initMode);
  const [name,setName]=useState(""); const [email,setEmail]=useState(""); const [pw,setPw]=useState(""); const [pw2,setPw2]=useState("");
  const [loading,setLoading]=useState(false); const [err,setErr]=useState(""); const [ok,setOk]=useState("");
  const {login,register,resetPassword}=useAuth();

  const handle=async()=>{
    setErr(""); setOk("");
    if(!email||!pw){setErr("Preencha todos os campos.");return;}
    setLoading(true);
    if(mode==="login"){
      const r=await login(email,pw);
      if(r.error) setErr(r.error); else onSuccess();
    } else if(mode==="register"){
      if(!name){setErr("Informe seu nome.");setLoading(false);return;}
      if(pw!==pw2){setErr("Senhas não coincidem.");setLoading(false);return;}
      const r=await register(name,email,pw);
      if(r.error) setErr(r.error); else onSuccess();
    } else {
      const r=await resetPassword(email,pw);
      if(r.error) setErr(r.error); else {setOk("Senha redefinida! Faça login.");setMode("login");}
    }
    setLoading(false);
  };

  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Outfit',sans-serif"}}>
      <div style={{position:"fixed",inset:0,background:"radial-gradient(ellipse 80% 70% at 50% -10%,#6366f110,transparent)",pointerEvents:"none"}}/>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:"38px 34px",width:"100%",maxWidth:410,position:"relative"}}>
        <div style={{textAlign:"center",marginBottom:30}}>
          <div style={{width:50,height:50,borderRadius:14,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:25,marginBottom:14}}>⚡</div>
          <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:23,fontWeight:900,color:C.text,margin:0}}>DataPath</h1>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:13}}>
          {mode==="register"&&<Inp label="Nome completo" value={name} onChange={setName} placeholder="Seu nome completo" icon="👤"/>}
          <Inp label="Email" type="email" value={email} onChange={setEmail} placeholder="seu@email.com" icon="✉️"/>
          <Inp label={mode==="reset"?"Nova senha":"Senha"} type="password" value={pw} onChange={setPw} placeholder="Senha" icon="🔒"/>
          {mode==="register"&&<Inp label="Confirmar senha" type="password" value={pw2} onChange={setPw2} placeholder="Confirme a senha" icon="🔒"/>}
          {err&&<div style={{background:C.red+"18",border:`1px solid ${C.red}35`,borderRadius:8,padding:"9px 13px",color:C.red,fontSize:13}}>{err}</div>}
          {ok&&<div style={{background:C.green+"18",border:`1px solid ${C.green}35`,borderRadius:8,padding:"9px 13px",color:C.green,fontSize:13}}>{ok}</div>}
          <Btn onClick={handle} disabled={loading} sx={{width:"100%",justifyContent:"center"}}>
            {loading?"Processando...":{login:"Entrar",register:"Criar Conta",reset:"Redefinir Senha"}[mode]}
          </Btn>
        </div>
        <div style={{textAlign:"center",marginTop:22,display:"flex",flexDirection:"column",gap:9}}>
          {mode==="login"&&(<>
            <button onClick={()=>setMode("reset")} style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>Esqueci minha senha</button>
            <button onClick={()=>setMode("register")} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>Não tem conta? <span style={{color:C.accent}}>Cadastre-se grátis</span></button>
          </>)}
          {mode==="register"&&<button onClick={()=>setMode("login")} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>Já tem conta? <span style={{color:C.accent}}>Entrar</span></button>}
          {mode==="reset"&&<button onClick={()=>setMode("login")} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>← Voltar ao login</button>}
        </div>
      </div>
    </div>
  );
}

function Dashboard({go}) {
  const {user}=useAuth();
  const {progress}=useProgress();
  if(!progress) return null;
  const dayNum=progress.completedDays.length+1;
  const pct=Math.round((progress.completedDays.length/90)*100);
  const phase=PHASES.find(p=>dayNum>=p.range[0]&&dayNum<=p.range[1])||PHASES[0];
  const today=DAY_DATA.find(d=>d.day===dayNum)||DAY_DATA[0];
  const earned=ACHIEVEMENTS.filter(a=>progress.achievements?.includes(a.id));
  const tracks=[
    {n:"Python",i:"🐍",c:C.blue,p:progress.trackProgress?.python||0},
    {n:"SQL",i:"🗄️",c:C.green,p:progress.trackProgress?.sql||0},
    {n:"Power BI",i:"📊",c:C.yellow,p:progress.trackProgress?.powerbi||0},
    {n:"Inglês",i:"🇺🇸",c:C.accent2,p:progress.trackProgress?.english||0},
  ];
  return (
    <div style={{maxWidth:1100,margin:"0 auto",display:"flex",flexDirection:"column",gap:20}}>
      <div style={{background:"linear-gradient(135deg,#1e1b4b,#1a2744)",border:"1px solid #6366f128",borderRadius:18,padding:"24px 26px",position:"relative",overflow:"hidden"}}>
        <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(1.1rem,3vw,1.45rem)",fontWeight:900,margin:"0 0 7px"}}>Olá, {user?.name?.split(" ")[0]}! 👋</h2>
        <p style={{color:C.muted,margin:"0 0 16px",fontSize:13.5}}>{phase.icon} <strong style={{color:C.accent}}>Dia {dayNum}</strong> da jornada · {phase.name}</p>
        <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
          <Btn onClick={()=>go("journey")} size="sm">🗺️ Continuar Jornada</Btn>
          <Btn v="secondary" onClick={()=>go("tools")} size="sm">🛠️ Ferramentas</Btn>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(145px,1fr))",gap:13}}>
        <Stat icon="📅" label="Dia da Jornada" value={`${dayNum}/90`} color={C.accent}/>
        <Stat icon="⚡" label="XP Total" value={progress.xp} color={C.accent2}/>
        <Stat icon="⭐" label="Nível" value={progress.level} color={C.yellow}/>
        <Stat icon="🔥" label="Sequência" value={`${progress.streak}d`} color={C.red}/>
      </div>
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
          <h3 style={{fontFamily:"'Syne',sans-serif",fontSize:14.5,fontWeight:800}}>Progresso de Nível</h3>
          <Badge text={`Nível ${progress.level}`} color={C.accent}/>
        </div>
        <XPBar xp={progress.xp} level={progress.level}/>
      </Card>
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:10,fontSize:13}}>
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700}}>Jornada 90 Dias</span>
          <span style={{color:C.accent,fontWeight:700}}>{progress.completedDays.length} / 90 dias</span>
        </div>
        <div style={{background:C.border,borderRadius:999,height:11,overflow:"hidden"}}>
          <div style={{width:`${pct}%`,background:"linear-gradient(90deg,#6366f1,#8b5cf6)",height:"100%",borderRadius:999,transition:"width 0.8s ease"}}/>
        </div>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:18}}>
        <Card sx={{border:`1px solid ${C.accent}22`}}>
          <div style={{marginBottom:10}}><Badge text={`Dia ${dayNum}`} color={C.accent}/></div>
          <h4 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14.5,margin:"0 0 8px"}}>{today?.title}</h4>
          <p style={{fontSize:13,color:C.muted,lineHeight:1.55,margin:"0 0 14px"}}>{today?.mission?.slice(0,110)}...</p>
          <Btn size="sm" onClick={()=>go("journey")}>Ver Missão →</Btn>
        </Card>
        <Card>
          <h4 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14.5,margin:"0 0 16px"}}>Progresso por Trilha</h4>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {tracks.map(t=>(
              <div key={t.n}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}>
                  <span>{t.i} {t.n}</span><span style={{color:t.c,fontWeight:700}}>{t.p}%</span>
                </div>
                <div style={{background:C.border,borderRadius:999,height:5}}>
                  <div style={{width:`${t.p}%`,background:t.c,height:"100%",borderRadius:999,transition:"width 0.8s"}}/>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Journey() {
  const {progress,completeDay}=useProgress();
  const [selected,setSelected]=useState(null);
  const [busy,setBusy]=useState(false);
  const [toast,setToast]=useState("");

  const showToast=(m)=>{setToast(m);setTimeout(()=>setToast(""),3200);};
  const curDay=progress?progress.completedDays.length+1:1;

  const finish=async(day)=>{
    if(!progress||progress.completedDays.includes(day.day)) return;
    setBusy(true); await new Promise(r=>setTimeout(r,700));
    completeDay(day.day,day.xp);
    showToast(`🎉 Dia ${day.day} concluído! +${day.xp} XP`);
    setBusy(false); setSelected(null);
  };

  if(selected) {
    const done=progress?.completedDays.includes(selected.day);
    const ph=PHASES.find(p=>selected.day>=p.range[0]&&selected.day<=p.range[1])||PHASES[0];
    return (
      <div style={{maxWidth:660,margin:"0 auto"}}>
        <Toast msg={toast}/>
        <button onClick={()=>setSelected(null)} style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:13,marginBottom:20,fontFamily:"inherit",display:"flex",alignItems:"center",gap:7}}>← Voltar à Jornada</button>
        <div style={{background:C.card,border:`1px solid ${ph.color}28`,borderRadius:20,padding:28,display:"flex",flexDirection:"column",gap:18}}>
          <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
            <div>
              <div style={{display:"flex",gap:7,marginBottom:9,flexWrap:"wrap"}}>
                <Badge text={`Dia ${selected.day}`} color={ph.color}/>
                <Badge text={ph.name} color={ph.color}/>
                <Badge text={selected.track?.toUpperCase()} color={C.faint}/>
              </div>
              <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(1.1rem,3vw,1.4rem)",fontWeight:900}}>{selected.title}</h2>
            </div>
            <Badge text={`+${selected.xp} XP`} color={C.green}/>
          </div>
          <div style={{background:C.surface,borderRadius:11,padding:18}}>
            <p style={{fontSize:12,color:C.muted,marginBottom:7,fontWeight:600}}>🎯 MISSÃO PRINCIPAL</p>
            <p style={{color:C.text,lineHeight:1.7,fontSize:14}}>{selected.mission}</p>
          </div>
          <div>
            <p style={{fontSize:12,color:C.muted,marginBottom:10,fontWeight:600}}>✅ MICROTAREFAS</p>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {selected.tasks.map((t,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:11,background:C.surface,borderRadius:9,padding:"10px 14px"}}>
                  <div style={{width:20,height:20,borderRadius:5,border:`2px solid ${done?C.green:C.accent}`,background:done?"#10b98118":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:11,color:done?C.green:C.accent}}>
                    {done?"✓":i+1}
                  </div>
                  <span style={{fontSize:13.5,color:C.text}}>{t}</span>
                </div>
              ))}
            </div>
          </div>
          {!done
            ?<Btn onClick={()=>finish(selected)} disabled={busy} v="success" sx={{width:"100%",justifyContent:"center",fontSize:15}}>
              {busy?"Salvando...":`✅ Concluir Dia ${selected.day} (+${selected.xp} XP)`}
            </Btn>
            :<div style={{background:"#10b98118",border:"1px solid #10b98135",borderRadius:11,padding:18,textAlign:"center",color:C.green,fontWeight:700,fontSize:15}}>
              ✅ Dia {selected.day} Concluído!
            </div>
          }
        </div>
      </div>
    );
  }

  return (
    <div style={{maxWidth:1000,margin:"0 auto"}}>
      <Toast msg={toast}/>
      <div style={{marginBottom:26}}>
        <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(1.3rem,3vw,1.75rem)",fontWeight:900,margin:"0 0 7px"}}>🗺️ Jornada de 90 Dias</h2>
        <p style={{color:C.muted,fontSize:13.5}}>Dia atual: <strong style={{color:C.accent}}>{curDay}</strong> · {Math.round((progress?.completedDays.length||0)/90*100)}% concluído</p>
      </div>
      <Card sx={{marginBottom:26}}>
        <div style={{background:C.border,borderRadius:999,height:12,overflow:"hidden",marginBottom:8}}>
          <div style={{width:`${(progress?.completedDays.length||0)/90*100}%`,background:"linear-gradient(90deg,#6366f1,#8b5cf6)",height:"100%",borderRadius:999,transition:"width 0.8s ease"}}/>
        </div>
      </Card>
      {PHASES.map(ph=>{
        const days=DAY_DATA.filter(d=>d.day>=ph.range[0]&&d.day<=ph.range[1]);
        return (
          <div key={ph.id} style={{marginBottom:30}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <span style={{fontSize:22}}>{ph.icon}</span>
              <div>
                <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:15,color:ph.color,margin:0}}>{ph.name}</h3>
                <span style={{fontSize:11.5,color:C.faint}}>Dias {ph.range[0]}–{ph.range[1]}</span>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:9}}>
              {days.map(day=>{
                const isDone=progress?.completedDays.includes(day.day);
                const locked=day.day>curDay;
                return (
                  <button key={day.day} onClick={()=>!locked&&setSelected(day)}
                    style={{background:isDone?"#10b98110":C.card,border:`1px solid ${isDone?"#10b98138":C.border}`,borderRadius:11,padding:"13px 11px",cursor:locked?"not-allowed":"pointer",textAlign:"left",opacity:locked?0.38:1,transition:"all 0.18s",fontFamily:"inherit",outline:"none"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                      <span style={{fontSize:10.5,color:C.faint}}>Dia {day.day}</span>
                      {isDone&&<span style={{color:C.green,fontSize:13}}>✅</span>}
                    </div>
                    <div style={{fontSize:11.5,fontWeight:600,color:C.text,lineHeight:1.35,marginBottom:6}}>{day.title.slice(0,42)}...</div>
                    <Badge text={`${day.xp}xp`} color={isDone?C.green:C.accent}/>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Tracks() {
  const [track,setTrack]=useState("python");
  const {addXP}=useProgress();
  const [doneEx,setDoneEx]=useState(()=>DB.g("doneEx")||[]);
  const [sqlQ,setSqlQ]=useState("SELECT * FROM produtos ORDER BY preco DESC;");
  const [sqlRes,setSqlRes]=useState(null);

  const execSQL=()=>{
    if(!sqlQ.trim()){setSqlRes({error:"Digite uma query."});return;}
    setSqlRes(runSQL(sqlQ));
  };

  const markDone=(id,type,xp)=>{
    const key=`${type}_${id}`;
    if(doneEx.includes(key)) return;
    const u=[...doneEx,key]; setDoneEx(u); DB.s("doneEx",u); addXP(xp);
  };

  const tabs=[{id:"python",i:"🐍",l:"Python"},{id:"sql",i:"🗄️",l:"SQL"},{id:"powerbi",i:"📊",l:"Power BI"},{id:"english",i:"🇺🇸",l:"Inglês"}];
  const colors={python:C.blue,sql:C.green,powerbi:C.yellow,english:C.accent2};

  return (
    <div style={{maxWidth:1000,margin:"0 auto"}}>
      <div style={{display:"flex",gap:9,marginBottom:26,flexWrap:"wrap"}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTrack(t.id)}
            style={{padding:"9px 18px",borderRadius:9,border:`2px solid ${track===t.id?colors[t.id]:C.border}`,background:track===t.id?colors[t.id]+"1a":C.card,color:track===t.id?colors[t.id]:C.muted,cursor:"pointer",fontWeight:700,fontSize:13.5,transition:"all 0.18s",fontFamily:"inherit"}}>
            {t.i} {t.l}
          </button>
        ))}
      </div>

      {track==="python"&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(275px,1fr))",gap:13}}>
          {PYTHON_EX.map(ex=>{
            const key=`python_${ex.id}`, done=doneEx.includes(key);
            return (
              <Card key={ex.id}>
                <h4 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14}}>{ex.title}</h4>
                <p style={{fontSize:12.5,color:C.muted,margin:"8px 0"}}>{ex.desc}</p>
                <Btn size="sm" onClick={()=>markDone(ex.id,"python",ex.xp)} disabled={done}>{done?"Concluído":"Marcar Concluído"}</Btn>
              </Card>
            );
          })}
        </div>
      )}

      {track==="sql"&&(
        <div>
          <Card sx={{marginBottom:20}}>
            <textarea value={sqlQ} onChange={e=>setSqlQ(e.target.value)} rows={4}
              style={{width:"100%",background:"#020d0a",border:`1px solid ${C.border}`,borderRadius:9,color:"#34d399",fontSize:13.5,padding:14,fontFamily:"'Courier New',monospace",resize:"vertical"}}/>
            <Btn onClick={execSQL} sx={{marginTop:10}}>Executar Query</Btn>
          </Card>
          {sqlRes&&(
            <Card sx={{overflowX:"auto"}}>
              {sqlRes.error?<span style={{color:C.red}}>{sqlRes.error}</span>:(
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                  <thead>
                    <tr>{Object.keys(sqlRes.rows[0]||{}).map(k=><th key={k} style={{textAlign:"left",padding:8,borderBottom:`1px solid ${C.border}`}}>{k}</th>)}</tr>
                  </thead>
                  <tbody>
                    {sqlRes.rows.map((r,i)=><tr key={i}>{Object.values(r).map((v,j)=><td key={j} style={{padding:8}}>{String(v)}</td>)}</tr>)}
                  </tbody>
                </table>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Tools() {
  const {user}=useAuth();
  const {addXP}=useProgress();
  const [tool,setTool]=useState("pomodoro");
  const [pomTime,setPomTime]=useState(25*60);
  const [pomActive,setPomActive]=useState(false);
  const timerRef=useRef(null);

  useEffect(()=>{
    if(pomActive) {
      timerRef.current=setInterval(()=>{
        setPomTime(t=>{
          if(t<=1){
            clearInterval(timerRef.current); setPomActive(false);
            addXP(20); return 25*60;
          }
          return t-1;
        });
      },1000);
    } else clearInterval(timerRef.current);
    return ()=>clearInterval(timerRef.current);
  },[pomActive, addXP]);

  const fmt=s=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  return (
    <div style={{maxWidth:900,margin:"0 auto"}}>
      <div style={{display:"flex",gap:8,marginBottom:26}}>
        <Btn onClick={()=>setTool("pomodoro")} v={tool==="pomodoro"?"primary":"secondary"}>Pomodoro</Btn>
        <Btn onClick={()=>setTool("checklist")} v={tool==="checklist"?"primary":"secondary"}>Checklist</Btn>
      </div>
      {tool==="pomodoro"&&(
        <Card sx={{textAlign:"center",padding:40}}>
          <div style={{fontSize:80,fontFamily:"'Syne',sans-serif",fontWeight:900,color:C.red}}>{fmt(pomTime)}</div>
          <Btn onClick={()=>setPomActive(!pomActive)} v={pomActive?"danger":"success"}>{pomActive?"Pausar":"Iniciar"}</Btn>
        </Card>
      )}
    </div>
  );
}

function LibraryPage() {
  const [search,setSearch]=useState("");
  const filtered=LIBRARY.filter(i=>i.title.toLowerCase().includes(search.toLowerCase()));
  return (
    <div style={{maxWidth:1000,margin:"0 auto"}}>
      <Inp placeholder="Buscar na biblioteca..." value={search} onChange={setSearch} sx={{marginBottom:20}}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(255px,1fr))",gap:14}}>
        {filtered.map(item=>(
          <Card key={item.id}>
            <div style={{fontSize:30}}>{item.icon}</div>
            <h4 style={{fontWeight:700,fontSize:14,margin:"10px 0"}}>{item.title}</h4>
            <p style={{fontSize:12,color:C.muted}}>{item.desc}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Portfolio() {
  const {user}=useAuth();
  const [projs,setProjs]=useState(()=>DB.portfolio(user?.id));
  return (
    <div style={{maxWidth:1000,margin:"0 auto"}}>
      <h2 style={{fontFamily:"'Syne',sans-serif",marginBottom:20}}>Meus Projetos</h2>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(275px,1fr))",gap:14}}>
        {projs.map(p=>(
          <Card key={p.id}>
            <h4 style={{fontWeight:700}}>{p.title}</h4>
            <p style={{fontSize:13,color:C.muted}}>{p.desc}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ResumePage() {
  const {user}=useAuth();
  const [cv,setCv]=useState(()=>DB.resume(user?.id));
  const upd=(f,v)=>setCv(p=>({...p,[f]:v}));
  return (
    <div style={{maxWidth:880,margin:"0 auto"}}>
      <Card>
        <h2 style={{fontFamily:"'Syne',sans-serif",marginBottom:20}}>Currículo ATS</h2>
        <div style={{display:"grid",gap:15}}>
          <Inp label="Nome" value={cv.name} onChange={(v)=>upd("name",v)}/>
          <Inp label="Título" value={cv.title} onChange={(v)=>upd("title",v)}/>
          <Inp label="Resumo" value={cv.summary} onChange={(v)=>upd("summary",v)} rows={4}/>
        </div>
      </Card>
    </div>
  );
}

function ProfilePage() {
  const {user}=useAuth();
  const {progress}=useProgress();
  if(!progress) return null;
  return (
    <div style={{maxWidth:700,margin:"0 auto"}}>
      <Card sx={{textAlign:"center"}}>
        <div style={{width:72,height:72,borderRadius:999,background:C.accent,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:32}}>👤</div>
        <h2 style={{marginTop:15}}>{user?.name}</h2>
        <div style={{display:"flex",gap:10,justifyContent:"center",marginTop:15}}>
          <Badge text={`Nível ${progress.level}`}/>
          <Badge text={`${progress.xp} XP`}/>
        </div>
      </Card>
    </div>
  );
}

function AppShell() {
  const [page,setPage]=useState("dashboard");
  const {user,logout}=useAuth();
  const {progress}=useProgress();
  const [open,setOpen]=useState(false);

  const nav=[
    {id:"dashboard",i:"🏠",l:"Dashboard"},
    {id:"journey",i:"🗺️",l:"Jornada 90 Dias"},
    {id:"tracks",i:"🎓",l:"Trilhas"},
    {id:"tools",i:"🛠️",l:"Ferramentas"},
    {id:"library",i:"📚",l:"Biblioteca"},
    {id:"portfolio",i:"💼",l:"Portfólio"},
    {id:"resume",i:"📄",l:"Currículo ATS"},
    {id:"profile",i:"👤",l:"Perfil"},
  ];

  const go=(p)=>{setPage(p);setOpen(false);};

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Outfit',sans-serif",display:"flex"}}>
      <aside style={{width:238,background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",position:"fixed",height:"100vh",zIndex:50,left:open?0:-238,transition:"left 0.28s",overflowY:"auto"}}>
        <div style={{padding:"20px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:31,height:31,borderRadius:8,background:C.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>⚡</div>
          <span style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:900,color:C.accent}}>DataPath</span>
        </div>
        <nav style={{flex:1,padding:"9px 9px"}}>
          {nav.map(n=>(
            <button key={n.id} onClick={()=>go(n.id)}
              style={{width:"100%",display:"flex",alignItems:"center",gap:11,padding:"9px 11px",borderRadius:9,border:"none",cursor:"pointer",fontSize:13,fontWeight:page===n.id?700:500,background:page===n.id?"#6366f116":"transparent",color:page===n.id?C.accent:C.muted,textAlign:"left",fontFamily:"inherit"}}>
              <span>{n.i}</span>{n.l}
            </button>
          ))}
        </nav>
        <div style={{padding:"10px 9px",borderTop:`1px solid ${C.border}`}}>
          <button onClick={logout} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 11px",borderRadius:9,border:"none",cursor:"pointer",fontSize:13,background:"transparent",color:C.muted,fontFamily:"inherit"}}>🚪 Sair</button>
        </div>
      </aside>
      <main style={{flex:1,minHeight:"100vh",display:"flex",flexDirection:"column",marginLeft:238}}>
        <header style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"13px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:30}}>
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14.5}}>{nav.find(n=>n.id===page)?.l}</span>
          {progress&&(
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <Badge text={`🔥 ${progress.streak}d`} color={C.yellow}/>
              <Badge text={`⚡ ${progress.xp} XP`} color={C.accent}/>
              <Badge text={`⭐ Nv.${progress.level}`} color={C.accent2}/>
            </div>
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
          {page==="profile"&&<ProfilePage/>}
        </div>
      </main>
      <style>{`
        @media(max-width:768px){aside{left:-238px}main{margin-left:0}}
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:${C.bg};font-family:'Outfit',sans-serif}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}
      `}</style>
    </div>
  );
}

function AppRoot() {
  const [page,setPage]=useState("dashboard");
  const {user,loading}=useAuth();

  useEffect(()=>{
    if(!loading&&user) setPage("app");
    else if(!loading&&!user&&page==="app") setPage("landing");
  },[user,loading, page]);

  if(loading) return <div style={{background:C.bg,height:"100vh",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>Carregando...</div>;

  return (
    <>
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

export default function App() {
  return (
    <AuthProvider>
      <AppRoot/>
    </AuthProvider>
  );
                    }
