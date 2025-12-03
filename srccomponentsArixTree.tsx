import * as THREE from 'three'
import React, { useMemo, useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { patchShaders } from '../utils/shaderUtils'

// 常量定义
const PARTICLE_COUNT = 3500
const COLOR_EMERALD = new THREE.Color('#002419')
const COLOR_GOLD = new THREE.Color('#FFD700')

// 生成几何数据
const generateData = (count: number) => {
  const treePositions = new Float32Array(count * 3)
  const scatterPositions = new Float32Array(count * 3)
  const randoms = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    const i3 = i * 3
    const t = i / count
    
    // 1. 树形 (斐波那契螺旋圆锥)
    const angle = i * Math.PI * (3 - Math.sqrt(5)) * 20 
    const radius = (1 - t) * 5.0 
    const y = (t - 0.5) * 14 
    treePositions[i3] = Math.cos(angle) * radius
    treePositions[i3 + 1] = y
    treePositions[i3 + 2] = Math.sin(angle) * radius

    // 2. 散落形 (更大的球体空间)
    const r = 15 + Math.random() * 15 
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(Math.random() * 2 - 1)
    scatterPositions[i3] = r * Math.sin(phi) * Math.cos(theta)
    scatterPositions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    scatterPositions[i3 + 2] = r * Math.cos(phi)

    // 3. 随机属性
    randoms[i3] = Math.random()
    randoms[i3+1] = Math.random()
    randoms[i3+2] = Math.random()
  }
  return { treePositions, scatterPositions, randoms }
}

interface ArixTreeProps {
  state: 'SCATTERED' | 'TREE_SHAPE'
  audioAnalyser?: THREE.AudioAnalyser | null
}

export const ArixTree = ({ state, audioAnalyser }: ArixTreeProps) => {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const materialRef = useRef<THREE.MeshPhysicalMaterial>(null)
  const { viewport, pointer } = useThree()
  
  // 初始化数据
  const { treePositions, scatterPositions, randoms } = useMemo(() => generateData(PARTICLE_COUNT), [])
  
  // 更新逻辑
  useFrame((rootState, delta) => {
    if (!materialRef.current?.userData.shader) return
    const shader = materialRef.current.userData.shader

    // 1. 状态过渡插值
    const target = state === 'TREE_SHAPE' ? 1 : 0
    shader.uniforms.uMorphProgress.value = THREE.MathUtils.lerp(
      shader.uniforms.uMorphProgress.value,
      target,
      delta * 1.5 // 过渡速度
    )

    // 2. 时间
    shader.uniforms.uTime.value = rootState.clock.elapsedTime

    // 3. 音频数据处理
    if (audioAnalyser) {
      const data = audioAnalyser.getFrequencyData()
      // 获取低频平均值 (Bass)
      let lowSum = 0; for(let i=0; i<10; i++) lowSum += data[i]
      const lowAvg = lowSum / 10 / 255
      
      // 获取高频平均值 (Treble)
      let highSum = 0; for(let i=80; i<100; i++) highSum += data[i]
      const highAvg = highSum / 20 / 255

      // 平滑音频信号，避免过于剧烈的闪烁
      shader.uniforms.uAudioLow.value = THREE.MathUtils.lerp(shader.uniforms.uAudioLow.value, lowAvg * 2.0, 0.2)
      shader.uniforms.uAudioHigh.value = THREE.MathUtils.lerp(shader.uniforms.uAudioHigh.value, highAvg * 3.0, 0.2)
    }

    // 4. 交互处理 (鼠标/触摸)
    // 将屏幕标准坐标 (-1 到 1) 转换为世界坐标的大致 XY 平面位置
    // 这里的 18 是相机距离的大致 Z 轴位置，用于简单的投影计算
    const mouseX = (pointer.x * viewport.width) / 2
    const mouseY = (pointer.y * viewport.height) / 2
    
    // 平滑移动 uMouse，产生一种“液体”跟随的延迟感
    const currentMouse = shader.uniforms.uMouse.value
    currentMouse.x = THREE.MathUtils.lerp(currentMouse.x, mouseX, 0.1)
    currentMouse.y = THREE.MathUtils.lerp(currentMouse.y, mouseY, 0.1)
    
    // 只有在 SCATTERED 状态下，或者 TREE 状态下想要一点点扰动时开启
    // 当完全聚合时，减少干扰，保持造型完美
    const interactStrengthTarget = state === 'SCATTERED' ? 1.0 : 0.2
    shader.uniforms.uInteractStrength.value = THREE.MathUtils.lerp(
        shader.uniforms.uInteractStrength.value, 
        interactStrengthTarget, 
        0.1
    )
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]} castShadow receiveShadow>
      {/* 几何体：使用四面体，更有珠宝切割感 */}
      <cylinderGeometry args={[0.02, 0.15, 0.8, 4]} />
      
      {/* 注入 Attribute */}
      <instancedBufferAttribute attach="geometry-attributes-aTreePosition" args={[treePositions, 3]} />
      <instancedBufferAttribute attach="geometry-attributes-aScatterPosition" args={[scatterPositions, 3]} />
      <instancedBufferAttribute attach="geometry-attributes-aRandom" args={[randoms, 3]} />

      <meshPhysicalMaterial
        ref={materialRef}
        color={COLOR_GOLD}
        emissive={COLOR_EMERALD}
        emissiveIntensity={0.2}
        metalness={1.0}
        roughness={0.15}
        clearcoat={1.0}
        clearcoatRoughness={0.1}
        onBeforeCompile={(shader) => {
          patchShaders(shader)
          materialRef.current!.userData.shader = shader
        }}
      />
    </instancedMesh>
  )
}