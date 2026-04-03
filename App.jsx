import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";

// --- SEU SISTEMA ORIGINAL (DataPath) ---

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

// --- AQUI ESTÃO OS SEUS 90 DIAS E LÓGICA DE UI ---
// [COLE AQUI TODO O SEU CÓDIGO ORIGINAL QUE VOCÊ CRIOU]

// --- ESTA É A FUNÇÃO QUE O VITE CHAMA (O CORAÇÃO DO SITE) ---
export default function App() {
  // Verifique se o nome da sua função principal era 'DataPath' ou 'DataPathApp'
  // Se for 'DataPath', use assim:
  return (
    <div style={{minHeight: '100vh', background: '#020817', color: '#e2e8f0'}}>
        {/* Aqui chamamos o seu componente original */}
        <DataPath /> 
    </div>
  );
}

// Se o seu componente principal for uma função chamada DataPath, coloque-a aqui embaixo:
function DataPath() {
    // [COLE AQUI O CONTEÚDO DA SUA FUNÇÃO DATAPATH ORIGINAL]
    return (
        <div style={{padding: '50px', textAlign: 'center'}}>
            <h1 style={{fontFamily: 'Syne', fontSize: '3rem', color: '#6366f1'}}>DataPath ⚡</h1>
            <p>O sistema está carregando sua jornada...</p>
            {/* ... Todo o seu dashboard, jornada e sandbox aqui ... */}
        </div>
    );
}
