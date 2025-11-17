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
    },
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // Configuración para Vercel
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
