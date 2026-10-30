var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    server: {
        // локальная разработка ходит за распознаванием на прод-сервер;
        // WHISPER_DIRECT=http://localhost:8089 — напрямую в whisper-server (например, через ssh-туннель)
        proxy: __assign(__assign({ '/api/transcribe': process.env.WHISPER_DIRECT
                ? { target: process.env.WHISPER_DIRECT, rewrite: function () { return '/inference'; } }
                : { target: 'https://languagedrilling.com', changeOrigin: true } }, (process.env.API_DIRECT ? { '/api/': { target: process.env.API_DIRECT } } : {})), { '/api': { target: 'https://languagedrilling.com', changeOrigin: true } }),
    },
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
    },
});
