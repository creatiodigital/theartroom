/**
 * ⚠️ AR-161 — the light baker's shaders (`LightBaker`).
 *
 * Receivers are rendered in TEXTURE space (gl_Position = uv): every fragment is one lightmap
 * texel, lit at its real world position and normal. Output is IRRADIANCE E in three's units,
 * so a white Lambert surface's radiance is E/π — exactly what MeshBasicMaterial's
 * `lightMap × 1/π × albedo` and MeshStandardMaterial's `irradiance × albedo/π` expect.
 *
 * Two-sided: walls/ceiling/floor are single planes whose normals are not guaranteed to face
 * the room, so irradiance uses |N·L| and the lit side is recorded (signed alpha in the grid)
 * for the bounce emitters.
 *
 * Alpha: `uAlphaMode` 0 = coverage (1 per write, used for dilation), 1 = signed luminance
 * (which side of the surface the light arrived on).
 */

export const UV_SPACE_VERTEX = /* glsl */ `
  uniform mat3 uNormalWorld;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    vWorldNormal = normalize(uNormalWorld * normal);
    gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
  }
`

const OUTPUT = /* glsl */ `
  uniform int uAlphaMode;
  vec4 bakeOutput(vec3 E, float ndl) {
    float lum = dot(E, vec3(0.2126, 0.7152, 0.0722));
    return vec4(E, uAlphaMode == 0 ? 1.0 : lum * sign(ndl));
  }
`

/**
 * One spot lamp, exactly three's SpotLight model, with a distance-map shadow (3×3 PCF).
 *
 * Narrow (lensed) heads use a perspective shadow map. Wide diffusers use a CUBE map
 * (`uCubeShadow`): a 170° perspective map has huge, uneven texels where its light grazes the
 * walls, and the depth test flipped on and off across them in horizontal bands (shadow acne).
 * The cube's 90° faces keep texels small and even; its bias grows with the texel's size at
 * that distance and with the grazing angle (slope-scaled), plus a matching normal offset.
 */
export const SPOT_FRAGMENT = /* glsl */ `
  uniform samplerCube uShadowCube;
  uniform float uCubeShadow;
  // A diffuser's exact cosine (Lambertian) emission, I(θ) = I₀·cosθ, instead of three's
  // smoothstep falloff — same flux (both integrate to π·I₀), more light toward the horizon.
  uniform float uLambert;
  // 1: light only the room side of a surface (the sun): the side facing uRoomCenter.
  uniform float uOneSided;
  uniform vec3 uRoomCenter;
  // 1: the light enters only through a window (the sun): the ray from the surface to the light
  // must cross the glass rectangle (centre, half-extent axes in its plane).
  uniform float uPortal;
  uniform vec3 uPortalCenter;
  uniform vec3 uPortalU;
  uniform vec3 uPortalV;
  // 1: write the light's DIRECTION weighted by its luminance (directional lightmap), not E.
  uniform int uDirMode;
  uniform float uCubeTexel; // one cube texel's angle, radians
  uniform vec3 uLightPos;
  uniform vec3 uLightDir;
  uniform vec3 uLightColor;
  uniform float uConeCos;
  uniform float uPenumbraCos;
  uniform float uDecay;
  uniform float uCutoff;
  uniform sampler2D uShadowMap;
  uniform mat4 uShadowMatrix;
  uniform vec2 uShadowTexel;
  uniform float uBias;
  uniform float uWeight;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  ${OUTPUT}

  float visibility(vec3 p, float distToLight) {
    vec4 sc = uShadowMatrix * vec4(p, 1.0);
    if (sc.w <= 0.0) return 0.0;
    vec2 suv = sc.xy / sc.w * 0.5 + 0.5;
    if (suv.x < 0.0 || suv.y < 0.0 || suv.x > 1.0 || suv.y > 1.0) return 0.0;
    float vis = 0.0;
    for (int x = -1; x <= 1; x++) {
      for (int y = -1; y <= 1; y++) {
        float inv = texture2D(uShadowMap, suv + vec2(float(x), float(y)) * uShadowTexel).r;
        float occluder = inv > 0.0 ? 1.0 / inv : 1e9;
        vis += distToLight - uBias > occluder ? 0.0 : 1.0;
      }
    }
    return vis / 9.0;
  }

  // The bias is sized to the depth error a texel actually has on this surface (texel × tanθ,
  // doubled for the PCF taps one texel away) instead of a blanket ~3 cm — which swallowed the
  // shadow of a frame hung 2.5 cm off the wall.
  float cubeVisibility(vec3 n, float ndl) {
    float texelWorld = uCubeTexel * length(uLightPos - vWorldPos) * 1.7; // ≤ √3 at face corners
    float c = max(abs(ndl), 0.05);
    float tanTheta = min(sqrt(1.0 - c * c) / c, 10.0);
    vec3 p = vWorldPos + n * sign(ndl) * texelWorld;
    vec3 fromLight = p - uLightPos;
    float dp = length(fromLight);
    vec3 dir = fromLight / dp;
    vec3 t = normalize(cross(abs(dir.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), dir));
    vec3 b = cross(dir, t);
    float bias = texelWorld * (0.5 + 2.0 * tanTheta);
    float vis = 0.0;
    for (int x = -1; x <= 1; x++) {
      for (int y = -1; y <= 1; y++) {
        vec3 o = dir + (t * float(x) + b * float(y)) * uCubeTexel;
        float inv = textureCube(uShadowCube, o).r;
        float occluder = inv > 0.0 ? 1.0 / inv : 1e9;
        vis += dp - bias > occluder ? 0.0 : 1.0;
      }
    }
    return vis / 9.0;
  }

  void main() {
    vec3 toLight = uLightPos - vWorldPos;
    float d = length(toLight);
    vec3 L = toLight / d;
    vec3 n = normalize(vWorldNormal);
    float ndl = dot(n, L);
    if (uOneSided > 0.5) {
      vec3 inward = n * (dot(n, uRoomCenter - vWorldPos) >= 0.0 ? 1.0 : -1.0);
      if (dot(inward, L) <= 0.0) {
        gl_FragColor = uDirMode == 1 ? vec4(0.0) : bakeOutput(vec3(0.0), 1.0);
        return;
      }
    }
    if (uPortal > 0.5) {
      vec3 pn = cross(uPortalU, uPortalV);
      float facing = dot(pn, L);
      float t = abs(facing) > 1e-6 ? dot(pn, uPortalCenter - vWorldPos) / facing : -1.0;
      vec3 local = vWorldPos + L * t - uPortalCenter;
      if (
        t <= 0.0 ||
        abs(dot(local, uPortalU)) > dot(uPortalU, uPortalU) ||
        abs(dot(local, uPortalV)) > dot(uPortalV, uPortalV)
      ) {
        gl_FragColor = uDirMode == 1 ? vec4(0.0) : bakeOutput(vec3(0.0), 1.0);
        return;
      }
    }
    float cosAxis = dot(-L, uLightDir);
    float spot = uLambert > 0.5 ? max(cosAxis, 0.0) : smoothstep(uConeCos, uPenumbraCos, cosAxis);
    float atten = 1.0 / max(pow(d, uDecay), 0.01);
    if (uCutoff > 0.0) {
      float r = clamp(1.0 - pow(d / uCutoff, 4.0), 0.0, 1.0);
      atten *= r * r;
    }
    float vis = spot <= 0.0
      ? 0.0
      : uCubeShadow > 0.5
        ? cubeVisibility(n, ndl)
        : visibility(vWorldPos + n * sign(ndl) * 0.005, d);
    vec3 E = uLightColor * spot * atten * abs(ndl) * vis * uWeight;
    if (uDirMode == 1) {
      float lum = dot(E, vec3(0.2126, 0.7152, 0.0722));
      gl_FragColor = vec4(L * lum, lum);
      return;
    }
    gl_FragColor = bakeOutput(E, ndl);
  }
`

/**
 * One virtual point light (instant radiosity): a patch of lit surface re-emitting its
 * radiosity with a cosine lobe. I(ω) = (Φ/π)·cosθ_vpl, E = I·cosθ_recv / d². The d² clamp is
 * the standard VPL singularity bias (the near-field rays add back what it drops).
 */
export const VPL_FRAGMENT = /* glsl */ `
  uniform vec3 uVplPos;
  uniform vec3 uVplNormal;
  uniform vec3 uVplIntensity;
  uniform samplerCube uVplShadow;
  uniform float uMinDist2;
  uniform float uBias;
  // 1: write the light's DIRECTION weighted by its luminance (directional lightmap), not E.
  uniform int uDirMode;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  ${OUTPUT}

  void main() {
    vec3 toVpl = uVplPos - vWorldPos;
    float d2 = dot(toVpl, toVpl);
    float d = sqrt(d2);
    vec3 L = toVpl / d;
    vec3 n = normalize(vWorldNormal);
    float ndl = dot(n, L);
    float cosV = max(dot(uVplNormal, -L), 0.0);
    // Shadow lookup from a point nudged off the surface toward the VPL's side, with a bias
    // that grows with distance (a cube texel covers more surface further away) and at grazing
    // angles — otherwise a flat ceiling shadows itself in texel-sized blocks and grids.
    vec3 p = vWorldPos + n * sign(ndl) * 0.02;
    vec3 fromVpl = p - uVplPos;
    float dp = length(fromVpl);
    float inv = textureCube(uVplShadow, fromVpl / dp).r;
    float occluder = inv > 0.0 ? 1.0 / inv : 1e9;
    float bias = uBias + dp * 0.03 / max(abs(ndl), 0.2);
    float vis = dp - bias > occluder ? 0.0 : 1.0;
    vec3 E = uVplIntensity * cosV * abs(ndl) / max(d2, uMinDist2) * vis;
    if (uDirMode == 1) {
      float lum = dot(E, vec3(0.2126, 0.7152, 0.0722));
      gl_FragColor = vec4(L * lum, lum);
      return;
    }
    gl_FragColor = bakeOutput(E, ndl);
  }
`

/** Texture-space world position (xyz, w = coverage) or normal. */
export const GEOMETRY_FRAGMENT = /* glsl */ `
  uniform int uWhat;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  void main() {
    gl_FragColor = uWhat == 0 ? vec4(vWorldPos, 1.0) : vec4(normalize(vWorldNormal), 1.0);
  }
`

/** Shadow casters: inverse distance to the light (clear 0 = nothing in the way). */
export const DISTANCE_VERTEX = /* glsl */ `
  varying vec3 vWorldPos;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

export const DISTANCE_FRAGMENT = /* glsl */ `
  uniform vec3 uLightPos;
  // The sun through a window (portal): what lies beyond uOutsideAt along uOutsideNormal is
  // outdoors and casts nothing — a floor or ceiling modelled as one rectangle over the whole
  // footprint reaches past the window wall and would otherwise shade the window.
  uniform float uOutside;
  uniform vec3 uOutsideAt;
  uniform vec3 uOutsideNormal;
  varying vec3 vWorldPos;
  void main() {
    if (uOutside > 0.5 && dot(vWorldPos - uOutsideAt, uOutsideNormal) > 0.0) discard;
    gl_FragColor = vec4(1.0 / max(length(vWorldPos - uLightPos), 1e-4), 0.0, 0.0, 1.0);
  }
`

export const FULLSCREEN_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

/** Fill uncovered texels from covered neighbours so bilinear sampling never reads black seams. */
export const DILATE_FRAGMENT = /* glsl */ `
  uniform sampler2D uSource;
  uniform vec2 uTexel;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(uSource, vUv);
    if (c.a > 0.0) { gl_FragColor = c; return; }
    vec4 sum = vec4(0.0);
    for (int x = -1; x <= 1; x++) {
      for (int y = -1; y <= 1; y++) {
        vec4 s = texture2D(uSource, vUv + vec2(float(x), float(y)) * uTexel);
        if (s.a > 0.0) sum += vec4(s.rgb / s.a, 1.0);
      }
    }
    gl_FragColor = sum.a > 0.0 ? vec4(sum.rgb / sum.a, 1.0) : vec4(0.0);
  }
`

/**
 * Final lightmap = direct (sharp: shadows, beam edges) + bounce (low-frequency by nature).
 * The bounce is gathered from thousands of point emitters, so it carries sampling noise; a
 * coverage-aware Gaussian denoises it. `uRadius` 0 = no filtering (multi-chart atlases, where
 * a blur would bleed light between unrelated walls); > 0 only on single-chart receivers.
 */
export const COMBINE_FRAGMENT = /* glsl */ `
  uniform sampler2D uDirect;
  uniform sampler2D uBounce;
  uniform vec2 uBounceTexel;
  uniform float uRadius;
  // The bounce passes' total writes: each tap is weighted by how much of it lies on the chart
  // (alpha / writes). Without it a bilinear tap at a chart's edge (a corner) averages in empty
  // texels as black.
  uniform float uWrites;
  varying vec2 vUv;
  void main() {
    vec4 d = texture2D(uDirect, vUv);
    if (d.a <= 0.0) { gl_FragColor = vec4(0.0); return; }
    vec3 b = vec3(0.0);
    float w = 0.0;
    // Dense taps (13×13): on a narrow chart (a pilaster face) a sparse kernel's taps drop off
    // the chart one at a time, and each drop stepped the average into streaks along it.
    for (int x = -6; x <= 6; x++) {
      for (int y = -6; y <= 6; y++) {
        vec2 o = vUv + vec2(float(x), float(y)) * uBounceTexel * uRadius * 0.5;
        vec4 s = texture2D(uBounce, o);
        float g = exp(-float(x * x + y * y) / 18.0);
        // Bilinear taps, weighted by the fraction of the tap ON the chart (alpha / writes) —
        // smooth inside a chart, exact at its edges (an unweighted tap half off the chart
        // averaged in black: streaks; nearest taps instead: blocky plaid).
        b += s.rgb * g;
        w += g * s.a / uWrites;
      }
    }
    gl_FragColor = vec4(d.rgb + (w > 0.0 ? b / w : vec3(0.0)), 1.0);
  }
`

/**
 * Directional lightmap: the luminance-weighted mean direction the DIRECT light arrives from,
 * divided by ALL light (direct + bounce) — so its length is the light's directionality (≈1
 * under one lamp, small where bounce dominates). Stored ×0.5 so a half-Lambert on it spans
 * [0, 1] (Unity's directional lightmap encoding). World space.
 */
export const DIRECTION_FRAGMENT = /* glsl */ `
  uniform sampler2D uDirAccum;
  uniform sampler2D uDirect;
  uniform sampler2D uBounce;
  varying vec2 vUv;
  void main() {
    vec4 d = texture2D(uDirect, vUv);
    if (d.a <= 0.0) { gl_FragColor = vec4(0.0); return; }
    vec3 luma = vec3(0.2126, 0.7152, 0.0722);
    float total = dot(d.rgb, luma) + dot(texture2D(uBounce, vUv).rgb, luma);
    vec3 dir = texture2D(uDirAccum, vUv).rgb / max(total, 1e-6);
    gl_FragColor = vec4(0.5 * dir, 1.0);
  }
`

/** Normalise coverage-weighted accumulation (rgb / alpha would be wrong: alpha counts writes). */
export const RESOLVE_FRAGMENT = /* glsl */ `
  uniform sampler2D uSource;
  uniform float uScale;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(uSource, vUv);
    gl_FragColor = c.a > 0.0 ? vec4(c.rgb * uScale, 1.0) : vec4(0.0);
  }
`

/**
 * Ray tracing against the room's triangles (see gatherScene.ts) from lightmap texels, for the
 * near-field compensation. `traceRay` walks the BVH with a small stack; `radianceAt` is what the
 * ray sees at its hit: a receiver's albedo × baked irradiance / π, or a constant / emitter.
 */
const TRACE_GLSL = /* glsl */ `
  uniform highp sampler2D uTris;
  uniform highp sampler2D uNodes;
  uniform sampler2D uLM0;
  uniform sampler2D uLM1;
  uniform sampler2D uLM2;
  uniform sampler2D uLM3;
  uniform sampler2D uLM4;
  uniform sampler2D uLM5;
  // Rays end here (1e30: unlimited); hits further away are not hits.
  uniform float uMaxDist;
  const float GPI = 3.14159265358979;

  vec4 fetchT(highp sampler2D t, int i) { return texelFetch(t, ivec2(i % 2048, i / 2048), 0); }

  uvec2 pcg2d(uvec2 v) {
    v = v * 1664525u + 1013904223u;
    v.x += v.y * 1664525u;
    v.y += v.x * 1664525u;
    v = v ^ (v >> 16u);
    v.x += v.y * 1664525u;
    v.y += v.x * 1664525u;
    v = v ^ (v >> 16u);
    return v;
  }


  float traceRay(vec3 o, vec3 d, out int hitTri, out vec2 hitBary) {
    vec3 sd = vec3(abs(d.x) > 1e-8 ? d.x : 1e-8, abs(d.y) > 1e-8 ? d.y : 1e-8, abs(d.z) > 1e-8 ? d.z : 1e-8);
    vec3 invD = 1.0 / sd;
    int stack[48];
    int sp = 0;
    stack[sp++] = 0;
    float best = uMaxDist;
    hitTri = -1;
    hitBary = vec2(0.0);
    for (int iter = 0; iter < 2048; iter++) {
      if (sp == 0) break;
      int ni = stack[--sp];
      vec4 a = fetchT(uNodes, ni * 2);
      vec4 b = fetchT(uNodes, ni * 2 + 1);
      vec3 t1 = (a.xyz - o) * invD;
      vec3 t2 = (b.xyz - o) * invD;
      vec3 tn = min(t1, t2);
      vec3 tf = max(t1, t2);
      float tNear = max(max(tn.x, tn.y), max(tn.z, 0.0));
      float tFar = min(min(tf.x, tf.y), tf.z);
      if (tFar < tNear || tNear > best) continue;
      int count = int(a.w + 0.5);
      if (count > 0) {
        int start = int(b.w + 0.5);
        for (int k = 0; k < 8; k++) {
          if (k >= count) break;
          int ti = start + k;
          vec4 v0 = fetchT(uTris, ti * 6);
          vec3 e1 = fetchT(uTris, ti * 6 + 1).xyz;
          vec4 e2c = fetchT(uTris, ti * 6 + 2);
          vec3 e2 = e2c.xyz;
          vec3 pv = cross(d, e2);
          float det = dot(e1, pv);
          if (abs(det) < 1e-12) continue;
          float inv = 1.0 / det;
          vec3 tv = o - v0.xyz;
          float u = dot(tv, pv) * inv;
          if (u < 0.0 || u > 1.0) continue;
          vec3 qv = cross(tv, e1);
          float v = dot(d, qv) * inv;
          if (v < 0.0 || u + v > 1.0) continue;
          float t = dot(e2, qv) * inv;
          // Partly opaque (material opacity < 1): the ray passes with probability 1 − coverage,
          // decided by a hash of the ray and the triangle so every pass sees the same surface.
          if (e2c.w < 1.0 && t > 1e-4 && t < best) {
            uvec2 h = pcg2d(uvec2(floatBitsToUint(d.x) ^ uint(ti), floatBitsToUint(d.y) ^ floatBitsToUint(o.z)));
            if (float(h.x) * 2.3283064365386963e-10 >= e2c.w) continue;
          }
          if (t > 1e-4 && t < best) {
            best = t;
            hitTri = ti;
            hitBary = vec2(u, v);
          }
        }
      } else if (sp < 46) {
        stack[sp++] = int(b.w + 0.5);
        stack[sp++] = ni + 1;
      }
    }
    return best;
  }

  vec3 lightmapAt(int slot, vec2 uv) {
    if (slot == 0) return texture(uLM0, uv).rgb;
    if (slot == 1) return texture(uLM1, uv).rgb;
    if (slot == 2) return texture(uLM2, uv).rgb;
    if (slot == 3) return texture(uLM3, uv).rgb;
    if (slot == 4) return texture(uLM4, uv).rgb;
    return texture(uLM5, uv).rgb;
  }

  vec3 radianceAt(int ti, vec2 bary) {
    vec4 t0 = fetchT(uTris, ti * 6);
    vec4 t1 = fetchT(uTris, ti * 6 + 1);
    vec4 t3 = fetchT(uTris, ti * 6 + 3);
    vec4 t4 = fetchT(uTris, ti * 6 + 4);
    vec3 c = fetchT(uTris, ti * 6 + 5).rgb;
    if (int(t0.w + 0.5) != 0) return c;
    vec2 uv = t3.xy * (1.0 - bary.x - bary.y) + t3.zw * bary.x + t4.xy * bary.y;
    return c * lightmapAt(int(t1.w + 0.5), uv) / GPI;
  }

  float radicalInverse(uint b) {
    b = (b << 16u) | (b >> 16u);
    b = ((b & 0x55555555u) << 1u) | ((b & 0xAAAAAAAAu) >> 1u);
    b = ((b & 0x33333333u) << 2u) | ((b & 0xCCCCCCCCu) >> 2u);
    b = ((b & 0x0F0F0F0Fu) << 4u) | ((b & 0xF0F0F0F0u) >> 4u);
    b = ((b & 0x00FF00FFu) << 8u) | ((b & 0xFF00FF00u) >> 8u);
    return float(b) * 2.3283064365386963e-10;
  }

  // Cosine-weighted direction around n: Hammersley sample s of total, rotated per texel.
  vec3 cosineDir(vec3 n, int s, int total, vec2 rot) {
    float u1 = fract(float(s) / float(total) + rot.x);
    float u2 = fract(radicalInverse(uint(s)) + rot.y);
    float r = sqrt(u1);
    float phi = 2.0 * GPI * u2;
    vec3 t = normalize(cross(abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), n));
    vec3 b = cross(n, t);
    return normalize(t * r * cos(phi) + b * r * sin(phi) + n * sqrt(max(0.0, 1.0 - u1)));
  }

  vec2 texelRotation() {
    uvec2 h = pcg2d(uvec2(gl_FragCoord.xy));
    return vec2(h) * 2.3283064365386963e-10;
  }
`

/**
 * Which side of a (single-plane, two-sided) receiver faces the room: the side whose rays travel
 * further before hitting anything. Behind an exterior wall rays escape (score 0); inside a closed
 * prop they stop within centimetres; into the room they fly metres. Output R: +1 / −1.
 */
export const GATHER_SIDE_FRAGMENT = /* glsl */ `
  uniform float uOffset;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  ${TRACE_GLSL}
  void main() {
    vec3 n = normalize(vWorldNormal);
    vec2 rot = texelRotation();
    float front = 0.0;
    float back = 0.0;
    int tri;
    vec2 bary;
    for (int k = 0; k < 16; k++) {
      float tf = traceRay(vWorldPos + n * uOffset, cosineDir(n, k, 16, rot), tri, bary);
      front += tri >= 0 ? min(tf, 10.0) : 0.0;
      float tb = traceRay(vWorldPos - n * uOffset, cosineDir(-n, k, 16, rot), tri, bary);
      back += tri >= 0 ? min(tb, 10.0) : 0.0;
    }
    // The score difference: summed per chart on the CPU, which then decides the side.
    gl_FragColor = vec4(front - back, 0.0, 0.0, 1.0);
  }
`

/** Texture-space chart id (the unwrap's `chart` attribute; 0 for single-chart receivers). */
export const CHART_VERTEX = /* glsl */ `
  attribute float chart;
  varying float vChart;
  void main() {
    vChart = chart;
    gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
  }
`
export const CHART_FRAGMENT = /* glsl */ `
  varying float vChart;
  void main() { gl_FragColor = vec4(vChart, 0.0, 0.0, 1.0); }
`

/** Texture-space receiver with the room side of its chart (`chartSide`, else `uSide`). */
export const NEAR_VERTEX = /* glsl */ `
  uniform mat3 uNormalWorld;
  uniform float uSide;
  attribute float chartSide;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying float vSide;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    vWorldNormal = normalize(uNormalWorld * normal);
    vSide = chartSide != 0.0 ? chartSide : uSide;
    gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
  }
`

/**
 * One pass of the near-field compensation (see LightBaker `nearField`): cosine rays no longer
 * than r = uMaxDist (the VPL clamp distance); a hit at distance t adds L·(1 − t²/r²), the share
 * of its light the clamped VPLs left out. Frames and panels (constants) only block.
 * Alpha sums to 1 over all passes (coverage, for dilation).
 */
export const NEAR_FRAGMENT = /* glsl */ `
  uniform float uOffset;
  uniform int uPass;
  uniform int uRaysPerPass;
  uniform int uTotalRays;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying float vSide;
  ${TRACE_GLSL}
  void main() {
    vec3 n = normalize(vWorldNormal) * (vSide < 0.0 ? -1.0 : 1.0);
    vec3 o = vWorldPos + n * uOffset;
    vec2 rot = texelRotation();
    float r2 = uMaxDist * uMaxDist;
    vec3 sum = vec3(0.0);
    int tri;
    vec2 bary;
    for (int k = 0; k < 64; k++) {
      if (k >= uRaysPerPass) break;
      vec3 d = cosineDir(n, uPass * uRaysPerPass + k, uTotalRays, rot);
      float t = traceRay(o, d, tri, bary);
      if (tri < 0) continue;
      int kind = int(fetchT(uTris, tri * 6).w + 0.5);
      if (kind == 1) continue;
      sum += radianceAt(tri, bary) * (1.0 - t * t / r2);
    }
    gl_FragColor = vec4(sum * GPI / float(uTotalRays), float(uRaysPerPass) / float(uTotalRays));
  }
`
