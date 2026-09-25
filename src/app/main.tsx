import './zod-config';
import '@fontsource/alegreya/latin-400.css';
import '@fontsource/alegreya/latin-700.css';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import '@fontsource/opendyslexic/latin-400.css';
import '@fontsource/opendyslexic/latin-700.css';
import './styles/app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ServicesProvider } from '@/features/common/services';
import { registerServiceWorker } from '@/infrastructure/pwa/register-sw';
import { App } from './App';
import { createAppServices } from './services';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');
const root = createRoot(container);

createAppServices()
  .then(async (services) => {
    const pwa = await registerServiceWorker({
      logger: services.logger,
      onUpdateAvailable: () => services.notices.setState((n) => ({ ...n, updateAvailable: true })),
      onOfflineReady: () => services.notices.setState((n) => ({ ...n, offlineReady: true })),
    });
    const ready = { ...services, applyUpdate: pwa ? pwa.applyUpdate : null };
    root.render(
      <StrictMode>
        <ServicesProvider services={ready}>
          <App services={ready} />
        </ServicesProvider>
      </StrictMode>,
    );
  })
  .catch((error: unknown) => {
    console.error('[witness] startup failed', error);
    container.innerHTML =
      '<main class="screen error-screen"><h1>The game could not start</h1><p>Please reload the page. If this keeps happening, try another browser.</p></main>';
  });
