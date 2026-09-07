import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import usersApiPlugin from './database/apiPlugin.js';

export default defineConfig({
  plugins: [react(), usersApiPlugin()],
  base: './',
});
