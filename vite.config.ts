import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  plugins: [{
    name:'central-protocol-preact', enforce:'pre',
    async resolveId(source,importer) {
      if(importer && /\/(?:vendor\/openmouse|protocol|node_modules\/lucide-react)\//.test(importer.replaceAll('\\','/')) && /^(?:react|react-dom)(?:\/|$)/.test(source)) {
        return this.resolve(source.replace(/^react-dom|^react/,'preact/compat'),importer,{skipSelf:true});
      }
    },
  },react({exclude:/vendor\/openmouse|protocol\//})],
  clearScreen: false,
  server: { watch: { ignored: ['**/src-tauri/**'] } },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  define: { __APP_VERSION__: JSON.stringify('0.0.4'), __BUILD_CHANNEL__: JSON.stringify('stable'), __BUILD_ID__: JSON.stringify('Central Hub') },
  build: { target: 'es2022', sourcemap: false, reportCompressedSize: true, rollupOptions: { input: { main:fileURLToPath(new URL('./index.html',import.meta.url)), protocol:fileURLToPath(new URL('./protocol/index.html',import.meta.url)) } } },
});
