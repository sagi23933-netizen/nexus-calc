import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Stamps dist/sw.js with a per-build version and the list of public-site chunks to precache,
 * so the installed PWA works offline and picks up new releases.
 * Admin/dashboard-only chunks and charts are left to runtime caching.
 */
function pwaPrecache(): Plugin {
  let outDir = 'dist';
  const files: string[] = [];
  return {
    name: 'buldeal-pwa-precache',
    apply: 'build',
    configResolved(cfg) {
      outDir = path.resolve(cfg.root, cfg.build.outDir);
    },
    generateBundle(_opts, bundle) {
      for (const [file, out] of Object.entries(bundle)) {
        if (!/\.(js|css)$/.test(file)) continue;
        if (out.type === 'chunk') {
          const ids = out.moduleIds.length ? out.moduleIds : [out.facadeModuleId ?? ''];
          const privateOnly = ids.every((id) => /\/src\/(admin|dashboard)\//.test(id));
          if (privateOnly || out.name === 'charts') continue;
        }
        files.push(`/${file}`);
      }
    },
    closeBundle() {
      const sw = path.join(outDir, 'sw.js');
      if (!fs.existsSync(sw)) return;
      const version = createHash('sha256').update(files.sort().join('|')).digest('hex').slice(0, 10);
      const src = fs
        .readFileSync(sw, 'utf8')
        .replace("const VERSION = 'dev';", `const VERSION = '${version}';`)
        .replace('const BUILD_ASSETS = [];', `const BUILD_ASSETS = ${JSON.stringify(files)};`);
      fs.writeFileSync(sw, src);
    },
  };
}

export default defineConfig({
  plugins: [react(), pwaPrecache()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3101', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3101', changeOrigin: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) return 'charts';
          if (id.includes('node_modules/framer-motion') || id.includes('node_modules/motion-')) return 'motion';
          return undefined;
        },
      },
    },
  },
});
