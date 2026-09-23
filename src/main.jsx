import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import favicon from '../images/pictures/600ppi/logo-mark.webp';
import './styles.css';

const faviconLink = document.querySelector('link[rel="icon"]') || document.createElement('link');
faviconLink.rel = 'icon';
faviconLink.type = 'image/webp';
faviconLink.href = favicon;
document.head.appendChild(faviconLink);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
