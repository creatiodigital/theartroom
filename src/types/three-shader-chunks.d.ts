// three ships its shader chunks as plain JS modules without typings. The photo views import the
// stock shadow chunk directly (see printPresentation/photoViews/stockShadows.ts).
declare module 'three/src/renderers/shaders/ShaderChunk/shadowmap_pars_fragment.glsl.js' {
  const chunk: string
  export default chunk
}
