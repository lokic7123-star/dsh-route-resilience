import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, dirname, relative, resolve as resolvePath, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { transform } from 'lightningcss'
import type { UserConfig } from 'tsdown'

const PACKAGE_NAME = 'dsh-route-resilience'
const CSS_PREFIX = '\0dsh-css:'
const CSS_SUFFIX = '.mjs'
const ROOT = fileURLToPath(new URL('.', import.meta.url))
const EXTERNALS = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
  '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react', '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-schema-form', '@deepseek-ai/dsh-client-runtime/client',
]

function assetPath(source: string, importer: string): string {
  const emitted = resolvePath(dirname(importer), source)
  if (existsSync(emitted)) return emitted
  const marker = `${sep}lib${sep}types${sep}`
  const index = emitted.indexOf(marker)
  return index < 0 ? emitted : resolvePath(emitted.slice(0, index), 'src', emitted.slice(index + marker.length))
}

const config: UserConfig[] = [{
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2024',
  dts: false,
  sourcemap: true,
  clean: false,
  external: EXTERNALS,
  noExternal: (id: string) => (EXTERNALS.includes(id) ? undefined : true),
  plugins: [{
    name: 'dsh-css-modules-inline',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.module.css')) return null
      return CSS_PREFIX + (importer === undefined ? source : assetPath(source, importer)) + CSS_SUFFIX
    },
    async load(id: string) {
      if (!id.startsWith(CSS_PREFIX)) return null
      const file = id.slice(CSS_PREFIX.length, -CSS_SUFFIX.length)
      const { code, exports } = transform({ filename: file, code: await readFile(file), cssModules: { pattern: '[hash]_[local]' }, minify: true })
      const names: Record<string, string> = {}
      for (const [name, value] of Object.entries(exports ?? {})) names[name] = value.name
      const tag = `${PACKAGE_NAME}/${basename(file)}`
      return `const css=${JSON.stringify(code.toString())};const tag=${JSON.stringify(tag)};if(typeof document!=="undefined"&&!document.querySelector("style[data-plugin-css='"+tag+"']")){const node=document.createElement("style");node.dataset.plugin=${JSON.stringify(PACKAGE_NAME)};node.dataset.pluginCss=tag;node.textContent=css;document.head.appendChild(node)};export default ${JSON.stringify(names)};`
    },
  }],
  outputOptions: {
    entryFileNames: 'client.js',
    sourcemapPathTransform: source => source.startsWith('.') ? relative(ROOT, source).split(sep).join('/') : source,
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_NAME)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}]

export default config
