import * as THREE from 'three'

// 顶点着色器注入逻辑
export const patchShaders = (shader: THREE.Shader) => {
  // 定义新的 Uniforms
  shader.uniforms.uMorphProgress = { value: 0 }
  shader.uniforms.uTime = { value: 0 }
  shader.uniforms.uAudioHigh = { value: 0 } // 高频数据
  shader.uniforms.uAudioLow = { value: 0 }  // 低频数据
  shader.uniforms.uMouse = { value: new THREE.Vector3(0, 0, 0) } // 鼠标/手指位置
  shader.uniforms.uInteractStrength = { value: 0 } // 交互强度（只有在散落时才强）

  // --- 1. 注入变量定义 (Head) ---
  shader.vertexShader = `
    uniform float uMorphProgress;
    uniform float uTime;
    uniform float uAudioHigh;
    uniform float uAudioLow;
    uniform vec3 uMouse;
    uniform float uInteractStrength;
    
    attribute vec3 aScatterPosition;
    attribute vec3 aTreePosition;
    attribute vec3 aRandom;
    
    // 简单的 3D 噪声函数，增加流动感
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    float snoise(vec3 v) {
      const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
      const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy) );
      vec3 x0 = v - i + dot(i, C.xxx) ;
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min( g.xyz, l.zxy );
      vec3 i2 = max( g.xyz, l.zxy );
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy; 
      vec3 x3 = x0 - D.yyy;
      i = mod289(i); 
      vec4 p = permute( permute( permute( 
                i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
              + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
      float n_ = 0.142857142857; 
      vec3  ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z); 
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_ );  
      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4( x.xy, y.xy );
      vec4 b1 = vec4( x.zw, y.zw );
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
      vec3 p0 = vec3(a0.xy,h.x);
      vec3 p1 = vec3(a0.zw,h.y);
      vec3 p2 = vec3(a1.xy,h.z);
      vec3 p3 = vec3(a1.zw,h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
    }

    ${shader.vertexShader}
  `

  // --- 2. 注入位置计算逻辑 (Main Body) ---
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `
    vec3 transformed = vec3(0.0);
    
    // 缓动曲线：Sigmoid-like，使开始和结束更平滑
    float t = smoothstep(0.0, 1.0, uMorphProgress);
    
    // --- 螺旋汇聚效果 ---
    // 在过渡过程中添加旋转，制造星系汇聚感
    float twist = (1.0 - t) * aRandom.x * 5.0; 
    float c = cos(twist);
    float s = sin(twist);
    mat2 rot = mat2(c, -s, s, c);
    
    // 混合位置：散落 -> 树形
    vec3 currentPos = mix(aScatterPosition, aTreePosition, t);
    
    // 应用螺旋旋转（仅在 XZ 平面）
    if(t < 0.99 && t > 0.01) {
        currentPos.xz *= rot; 
    }

    // --- 音频律动 (Audio Reactivity) ---
    // 低频让物体膨胀/震动，高频让物体轻微抖动
    float beatPulse = uAudioLow * 0.5 * smoothstep(0.5, 1.0, t); // 主要在树形态下明显
    vec3 beatDir = normalize(currentPos); // 沿法线方向膨胀
    currentPos += beatDir * beatPulse;
    
    // 散落形态下的漂浮感
    float floatY = sin(uTime * 0.5 + aRandom.y * 10.0) * (0.5 + uAudioHigh * 0.5);
    if(t < 0.5) currentPos.y += floatY;

    // --- 交互磁力场 (Touch/Mouse Repulsion) ---
    // 计算鼠标光标与粒子的距离
    // uMouse 已经是转换到世界空间的坐标
    float dist = distance(currentPos.xy, uMouse.xy);
    float repelRadius = 4.0;
    
    // 斥力公式：距离越近，推力越大
    if (dist < repelRadius && uInteractStrength > 0.0) {
        vec3 repelDir = normalize(currentPos - uMouse);
        float force = (1.0 - dist / repelRadius) * uInteractStrength * 2.0;
        // 稍微带一点 Z 轴的推力，让粒子不仅向四周散开，还向前凸起
        currentPos += repelDir * force;
        currentPos.z += force * 0.5; 
    }

    transformed = currentPos;
    `
  )
}