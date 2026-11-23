import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { ChakraProvider } from '@chakra-ui/react'
import '@fontsource/montserrat/400.css'
import '@fontsource/montserrat/600.css'
import '@fontsource/montserrat/700.css'
import '@fontsource/crimson-pro/500.css'
import '@fontsource/crimson-pro/600.css'
import App from './App'
import theme from './theme'
import Login from './pages/Login'
import { LojaProvider } from './contexts/LojaContext'
import { ConfirmarProvider } from './components/Comum'
import { token } from './utils/api'

// Sem login (token guardado no aparelho), mostra só a tela de entrada.
function Raiz() {
  const [logado, setLogado] = useState(Boolean(token()))
  if (!logado) return <Login onEntrar={() => setLogado(true)} />
  return (
    <LojaProvider>
      <ConfirmarProvider>
        <App />
      </ConfirmarProvider>
    </LojaProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ChakraProvider theme={theme} toastOptions={{ defaultOptions: { position: 'top', duration: 3000, isClosable: true } }}>
      <Raiz />
    </ChakraProvider>
  </React.StrictMode>
)
