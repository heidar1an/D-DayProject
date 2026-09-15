import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import usersApiPlugin from './database/apiPlugin.js';
import contentApiPlugin from './database/adminApiPlugin.js';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), usersApiPlugin(), contentApiPlugin(), tailwindcss()],
  base: './',
});
