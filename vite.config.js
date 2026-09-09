import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import usersApiPlugin from './database/apiPlugin.js';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), usersApiPlugin(),tailwindcss()],
  base: './',
});
