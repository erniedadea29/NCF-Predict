import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {AppAlertHost, installAppAlert} from './components/AppAlert.tsx';
import './index.css';

// Every alert(...) in the app shows the styled in-app box instead of the browser popup.
installAppAlert();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <AppAlertHost />
  </StrictMode>,
);
