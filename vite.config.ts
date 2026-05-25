import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ManualChunksOption } from 'rollup';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

if (process.env.RENDER_EXTERNAL_URL && !process.env.VITE_WS_BACKEND_URL) {
  process.env.VITE_WS_BACKEND_URL = process.env.RENDER_EXTERNAL_URL;
}

function copyFolderSync(from: string, to: string) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from).forEach((element) => {
    const fromPath = path.join(from, element);
    const toPath = path.join(to, element);
    const stat = fs.lstatSync(fromPath);
    if (stat.isFile()) {
      fs.copyFileSync(fromPath, toPath);
    } else if (stat.isDirectory()) {
      copyFolderSync(fromPath, toPath);
    }
  });
}

function cmsPlugin() {
  return {
    name: 'cms-plugin',
    closeBundle() {
      // Copy translinkconfig to dist/src/translinkconfig for static copy fallbacks in production preview
      const srcDir = path.resolve(__dirname, 'src', 'translinkconfig');
      const destDir = path.resolve(__dirname, 'dist', 'src', 'translinkconfig');
      try {
        copyFolderSync(srcDir, destDir);
        console.log('[CMS Plugin] Successfully copied translinkconfig files to dist/src/translinkconfig');
      } catch (err: any) {
        console.error('[CMS Plugin] Failed to copy translinkconfig to dist:', err.message);
      }
    },
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = new URL(req.url || '', 'http://localhost');
        const pathname = url.pathname;

        if (
          pathname === '/api/config/language' || 
          pathname === '/api/config/mesh/behavior' || 
          pathname === '/api/config/mesh/material' || 
          pathname === '/api/config/camera' ||
          pathname === '/api/config/voice' ||
          pathname === '/api/config/knowledge' ||
          pathname === '/api/config/knowledge-md'
        ) {
          let filename = 'language_config.json';
          let requiredKey: string | null = 'languages';
          let subDir = '';
          
          if (pathname === '/api/config/mesh/behavior') {
            filename = 'mesh_behavior_config.json';
            requiredKey = 'meshes';
          } else if (pathname === '/api/config/mesh/material') {
            filename = 'mesh_material_config.json';
            requiredKey = 'materials';
          } else if (pathname === '/api/config/camera') {
            filename = 'camera_config.json';
            requiredKey = 'cameraKeyframesDesktop';
          } else if (pathname === '/api/config/voice') {
            filename = 'voice_config.json';
            subDir = 'live-voice';
            requiredKey = 'voiceMetadata';
          } else if (pathname === '/api/config/knowledge') {
            filename = 'knowledge_config.json';
            subDir = 'live-voice';
            requiredKey = 'sync_engine';
          } else if (pathname === '/api/config/knowledge-md') {
            filename = 'knowledge.md';
            subDir = 'live-voice';
            requiredKey = null;
          }
          
          const configPath = subDir 
            ? path.resolve(__dirname, 'src', 'translinkconfig', subDir, filename)
            : path.resolve(__dirname, 'src', 'translinkconfig', filename);
          const backupPath = subDir
            ? path.resolve(__dirname, 'src', 'translinkconfig', subDir, filename.replace('.json', '.backup.json').replace('.md', '.backup.md'))
            : path.resolve(__dirname, 'src', 'translinkconfig', filename.replace('.json', '.backup.json'));

          if (req.method === 'GET') {
            try {
              if (!fs.existsSync(configPath)) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: `Config file not found: ${filename}` }));
                return;
              }
              const raw = fs.readFileSync(configPath, 'utf8');
              res.statusCode = 200;
              if (requiredKey !== null) {
                res.setHeader('Content-Type', 'application/json');
              } else {
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
              }
              res.end(raw);
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
            return;
          }

          if (req.method === 'POST') {
            try {
              let body = '';
              req.on('data', (chunk: any) => { body += chunk; });
              req.on('end', () => {
                try {
                  if (requiredKey !== null) {
                    const payload = JSON.parse(body);
                    if (!payload || typeof payload !== 'object' || !payload[requiredKey]) {
                      res.statusCode = 400;
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify({ error: `Invalid config payload: missing key '${requiredKey}'` }));
                      return;
                    }
                    
                    // Backup
                    if (fs.existsSync(configPath)) {
                      fs.copyFileSync(configPath, backupPath);
                    }
                    
                    // Save
                    fs.writeFileSync(configPath, JSON.stringify(payload, null, 2), 'utf8');
                  } else {
                    // Backup
                    if (fs.existsSync(configPath)) {
                      fs.copyFileSync(configPath, backupPath);
                    }
                    
                    // Save
                    fs.writeFileSync(configPath, body, 'utf8');
                  }
                  
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ status: 'ok', message: `${filename} saved successfully` }));
                } catch (e: any) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: `Failed to parse or write config: ${e.message}` }));
                }
              });
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
            return;
          }
        }
        next();
      });
    }
  };
}

function geminiVoicePlugin() {
  return {
    name: 'gemini-voice-plugin',
    configureServer(server: any) {
      const apiKey = process.env.GEMINI_API_KEY || "";
      if (!apiKey) {
        console.warn('[Vite Live Voice] Warning: GEMINI_API_KEY is not defined in .env!');
      }

      const wss = new WebSocketServer({
        noServer: true,
        perMessageDeflate: {
          zlibDeflateOptions: {
            chunkSize: 1024,
            memLevel: 7,
            level: 3,
          },
          zlibInflateOptions: {
            chunkSize: 10 * 1024
          },
          clientNoContextTakeover: true,
          serverNoContextTakeover: true,
          serverMaxWindowBits: 10,
          concurrencyLimit: 10,
          threshold: 1024,
        }
      });

      server.httpServer?.on('upgrade', (request: any, socket: any, head: any) => {
        const url = new URL(request.url, 'http://localhost');
        if (url.pathname === '/ws/live') {
          wss.handleUpgrade(request, socket, head, (ws: any) => {
            wss.emit('connection', ws, request);
          });
        }
      });

      wss.on('connection', async (clientWs: any, request: any) => {
        console.log('[Vite Live Voice] Client connected to WebSocket');

        // Parse query parameters
        let lang = 'en';
        let welcome = true;
        let visitorName = '';
        try {
          const url = new URL(request.url, 'http://localhost');
          const rawLang = url.searchParams.get('lang') || 'en';
          lang = rawLang.toLowerCase();
          if (lang !== 'en' && lang !== 'am' && lang !== 'ar') {
            lang = 'en';
          }
          const rawWelcome = url.searchParams.get('welcome');
          if (rawWelcome === 'false') {
            welcome = false;
          }
          visitorName = url.searchParams.get('visitorName') || '';
        } catch (e) {
          console.error('[Vite Live Voice] Error parsing request URL:', e);
        }

        let selectedVoice = "Zephyr";
        try {
          const configPath = path.resolve(__dirname, 'src/translinkconfig/live-voice/voice_config.json');
          if (fs.existsSync(configPath)) {
            const raw = fs.readFileSync(configPath, 'utf8');
            const voiceConfig = JSON.parse(raw);
            const langConfig = voiceConfig[lang] || voiceConfig['en'];
            if (langConfig) {
              if (langConfig.activeVoice) selectedVoice = langConfig.activeVoice;
              else if (langConfig.voices) {
                const active = Object.keys(langConfig.voices).find(k => langConfig.voices[k] === 1);
                if (active) selectedVoice = active;
              }
            }
          }
        } catch (err) {
          console.error('[Vite Live Voice] Error reading voice config:', err);
        }

        try {
          // --- Phase 3: Modular Architecture Integration ---
          // Offload all heavy lifting to the new modular server directory!
          const { GeminiLiveService } = await import('./server/services/GeminiLiveService.ts');
          const service = new GeminiLiveService(apiKey);
          await service.handleConnection(clientWs, lang, selectedVoice, welcome, visitorName);
        } catch (err) {
          console.error('[Vite Live Voice] Failed to instantiate modular GeminiLiveService:', err);
          clientWs.close();
        }
      });
    }
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';

/**
 * P-01: Page-Level Code Splitting
 * 
 * Each page compiles into its own deterministic chunk graph:
 * - Isolated entry point per page
 * - Isolated dependency tree
 * - Lazy-loaded heavy GPU/math pipelines
 * - Zero cross-page leakage
 * - Minimal cold-start payload
 */

/**
 * Manual chunk splitting strategy
 * Ensures shared dependencies are extracted into common chunks
 * while page-specific code remains isolated
 */
const manualChunks: ManualChunksOption = (id: string) => {
  // Voice/Robot agent: keep outside initial 3D loading path and group cohesively.
  // Satisfies readiness validation checklist contracts: "voice/voice-client" and "voice/robot-agent"
  if (
    id.includes('/src/translink/components/TranslinkVoiceManager') ||
    id.includes('/src/translink/components/audio-utils') ||
    id.includes('/src/translink/components/TranslinkEasterEggFriend') ||
    id.includes('/src/translink/components/TranslinkAIBrain') ||
    id.includes('/src/translink/components/companion/')
  ) {
    return 'voice/robot-agent';
  }

  // Vendor: Three.js core (shared across all 3D pages)
  if (id.includes('node_modules/three/build')) {
    return 'vendor/three-core';
  }

  // Vendor: Three.js addons (loaders, controls - lazy loaded)
  if (id.includes('node_modules/three/examples') || id.includes('three/addons')) {
    return 'vendor/three-addons';
  }

  // Vendor: Animation libraries (GSAP + Lenis)
  if (id.includes('node_modules/gsap') || id.includes('node_modules/lenis')) {
    return 'vendor/animation';
  }

  // Vendor: Vector/math utilities
  if (id.includes('node_modules/flubber')) {
    return 'vendor/vector-math';
  }

  // Vendor: 3D text rendering
  if (id.includes('node_modules/troika')) {
    return 'vendor/troika-text';
  }

  // Shared: Translink core controllers / shared components
  if (id.includes('/src/translink/controllers/') || id.includes('/src/translink/components/')) {
    return 'shared/translink-core';
  }

  // Shared: Per-section chunks (S1–S10)
  const sectionMatch = id.match(/\/src\/translink\/(translinkS\d+)\//i);
  if (sectionMatch) {
    return `sections/${sectionMatch[1].toLowerCase()}`;
  }

  // Shared: CSS tokens
  if (id.includes('/src/translink/styles/')) {
    return 'shared/styles';
  }


  // Let Rollup handle remaining modules
  return undefined;
};

export default defineConfig({
  root: '.',
  base: '/',
  publicDir: 'public',
  plugins: [react(), geminiVoicePlugin(), cmsPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@assets': path.resolve(__dirname, './src/assets'),
      '@styles': path.resolve(__dirname, './src/translink/styles'),
      '@components': path.resolve(__dirname, './src/components')
    }
  },
  css: {
    postcss: './postcss.config.js',
    devSourcemap: !isProduction
  },
  esbuild: {
    pure: isProduction ? ['console.log'] : [],
    legalComments: 'none'
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: !isProduction,
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 600, // Three.js core is ~520KB
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, 'index.html'),
        cms: path.resolve(__dirname, 'cms.html'),
      },
      output: {
        manualChunks,
        // Deterministic chunk naming for cache optimization
        chunkFileNames: (chunkInfo) => {
          const name = chunkInfo.name || 'chunk';
          // Preserve directory structure in output
          if (name.includes('/')) {
            return `assets/js/${name}-[hash].js`;
          }
          return `assets/js/${name}-[hash].js`;
        },
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || '';
          if (/\.css$/.test(name)) {
            return 'assets/css/[name]-[hash][extname]';
          }
          if (/\.(png|jpe?g|gif|svg|webp|ico)$/.test(name)) {
            return 'assets/images/[name]-[hash][extname]';
          }
          if (/\.(woff2?|eot|ttf|otf)$/.test(name)) {
            return 'assets/fonts/[name]-[hash][extname]';
          }
          if (/\.(glb|gltf|hdr|exr)$/.test(name)) {
            return 'assets/models/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      },
      treeshake: {
        moduleSideEffects: 'no-external',
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false
      }
    },
    target: 'es2020',
    minify: 'esbuild',
    reportCompressedSize: true
  },
  server: {
    port: 3001,
    open: '/',
    host: false
  },
  preview: {
    port: 3002,
    open: true
  },
  define: {
    __DEV__: JSON.stringify(!isProduction),
    __PROD__: JSON.stringify(isProduction)
  }
});
