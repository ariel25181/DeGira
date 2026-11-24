import {createRoot} from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import {ErrorBoundary} from './components/ErrorBoundary.tsx';
import { setupServiceWorkerAutoUpdate } from './utils/pwaUpdate.ts';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  setupServiceWorkerAutoUpdate({ registerFn: registerSW });
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
