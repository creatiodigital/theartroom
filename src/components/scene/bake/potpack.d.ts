// AR-161: three ships potpack (examples/jsm/libs) without type declarations.
declare module 'three/examples/jsm/libs/potpack.module.js' {
  export function potpack<T extends { w: number; h: number; x: number; y: number }>(
    boxes: T[],
  ): { w: number; h: number; fill: number }
}
