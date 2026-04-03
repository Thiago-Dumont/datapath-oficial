import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Validação de QA: Inicialização do React 18 com StrictMode para garantir 
// que a renderização do Sandbox SQL e as lógicas de XP ocorram sem bugs de memória.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
