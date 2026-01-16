import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 3001,
        host: true, // Allow external access (needed for ngrok)
        allowedHosts: true // Allow all hosts (needed for ngrok tunnels)
    },
    resolve: {
        alias: {
            '@': '/src'
        }
    }
});
