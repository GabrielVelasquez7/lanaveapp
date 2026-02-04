import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const plugins: any[] = [react()];
  
  // Solo incluir lovable-tagger en desarrollo y si está disponible
  // En producción o si no está instalado, simplemente no se incluye
  if (mode === 'development') {
    try {
      // Intentar importar lovable-tagger solo si está disponible
      const lovableTagger = require("lovable-tagger");
      if (lovableTagger?.componentTagger) {
        plugins.push(lovableTagger.componentTagger());
      }
    } catch (e) {
      // Si lovable-tagger no está disponible, continuar sin él
      // Esto es normal si no estás usando Lovable
    }
  }

  return {
    server: {
      host: "::",
      port: 8080,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    },
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // Configuración optimizada para producción con cache busting
    build: {
      outDir: 'dist',
      sourcemap: false,
      // Hashing automático de archivos para cache busting
      rollupOptions: {
        output: {
          // Hash basado en contenido para cache busting efectivo
          entryFileNames: 'assets/[name].[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name?.split('.') || [];
            const ext = info[info.length - 1];
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext || '')) {
              return `assets/images/[name].[hash].[ext]`;
            }
            if (/woff2?|eot|ttf|otf/i.test(ext || '')) {
              return `assets/fonts/[name].[hash].[ext]`;
            }
            return `assets/[name].[hash].[ext]`;
          },
          // Manual chunk splitting para mejor caching
          manualChunks: (id) => {
            // Separar vendor chunks
            if (id.includes('node_modules')) {
              if (id.includes('@supabase')) {
                return 'vendor-supabase';
              }
              if (id.includes('@tanstack')) {
                return 'vendor-react-query';
              }
              if (id.includes('react') || id.includes('react-dom')) {
                return 'vendor-react';
              }
              return 'vendor';
            }
          },
        },
      },
      // Chunk size warnings más permisivos para mejor splitting
      chunkSizeWarningLimit: 1000,
    },
    // Preview server con headers de cache para testing
    preview: {
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    },
  };
});
