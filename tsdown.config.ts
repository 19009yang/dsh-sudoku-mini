import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    entry: { index: 'src/index.ts' }, outDir: 'lib', format: 'esm',
    platform: 'node', target: 'es2022', dts: false, clean: false,
    fixedExtension: false,
  },
  {
    entry: { client: 'src/client/index.ts' }, outDir: 'lib', format: 'cjs',
    platform: 'browser', target: 'es2022', dts: false, clean: false,
    fixedExtension: false, minify: true,
    deps: { neverBundle: ['react', 'react/jsx-runtime', '@deepseek-ai/cordis'] },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({id:"dsh-sudoku-mini",factory:(require)=>{',
      intro: 'var module={exports:{}};var exports=module.exports;',
      footer: 'return module.exports;}});',
    },
  },
]);
