import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'matchfun',
      fileName: (format) => `matchfun.${format}.js`,
      formats: ['es', 'umd', 'cjs']
    },
    outDir: 'dist',
    rollupOptions: {
      // Make sure to externalize dependencies that shouldn't be bundled
      // into your library
      external: [],
      output: {
        // Provide global variables to use in the UMD build
        // for externalized dependencies
        globals: {},
        exports: 'named'
      }
    },
    sourcemap: true,
    minify: 'terser'
  }
}); 