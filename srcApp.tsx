import React, { useState, useRef, Suspense } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, Float, PerspectiveCamera, Text } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, ChromaticAberration, Noise } from '@react-three/postprocessing'
import { ArixTree } from './components/ArixTree'

export default function App() {
  const [treeState, setTreeState] = useState<'SCATTERED' | 'TREE_SHAPE'>('SCATTERED')
  const [audioStarted, setAudioStarted] = useState(false)
  const audioAnalyser = useRef<THREE.AudioAnalyser | null>(null)
  const soundRef = useRef<THREE.Audio | null>(null)

  // 处理音频初始化（浏览器必须要用户交互才能播放声音）
  const handleStart = async () => {
    if (audioStarted) {
        // 切换状态：散落 <-> 聚合
        setTreeState(s => s === 'SCATTERED' ? 'TREE_SHAPE' : 'SCATTERED')
        return
    }

    // 初始化音频
    const listener = new THREE.AudioListener()
    const sound = new THREE.Audio(listener)
    const loader = new THREE.AudioLoader()
    
    // 这里使用一个免费的圣诞风格或爵士风格 MP3 URL
    // 你可以替换为你本地的音乐，例如 '/music/mysong.mp3'
    const audioUrl = 'https://assets.mixkit.co/music/preview/mixkit-christmas-magic-2818.mp3' 

    try {
        const buffer = await loader.loadAsync(audioUrl)
        sound.setBuffer(buffer)
        sound.setLoop(true)
        sound.setVolume(0.5)
        sound.play()
        
        // 创建分析器
        const analyser = new THREE.AudioAnalyser(sound, 128)
        audioAnalyser.current = analyser
        soundRef.current = sound
        
        setAudioStarted(true)
        setTreeState('TREE_SHAPE') // 音乐响起，自动聚合
    } catch (e) {
        console.error("Audio load failed", e)
        // 即使音频失败也允许进入体验
        setAudioStarted(true)
        setTreeState('TREE_SHAPE')
    }
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000504', overflow: 'hidden' }}>
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping }}>
        <PerspectiveCamera makeDefault position={[0, 0, 20]} fov={35} />
        
        {/* --- 环境与灯光 --- */}
        <color attach="background" args={['#000504']} />
        <fog attach="fog" args={['#000504', 10, 45]} />
        
        <ambientLight intensity={0.5} color="#002419" />
        <spotLight 
          position={[10, 20, 10]} 
          angle={0.25} 
          penumbra={1} 
          intensity={150} 
          color="#FFD700" 
          castShadow 
        />
        <pointLight position={[-10, -5, -10]} intensity={50} color="#00ff88" distance={20} />
        
        {/* 城市夜景 HDRI 提供奢华反射 */}
        <Environment preset="city" environmentIntensity={0.8} />

        {/* --- 主体内容 --- */}
        <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
           <group rotation={[0, 0, Math.PI / 12]}>
             <Suspense fallback={null}>
               {/* 1. 核心圣诞树 */}
               <ArixTree state={treeState} audioAnalyser={audioAnalyser.current} />

               {/* 2. 定制文字 "TO WQC" */}
               <Text
                 position={[6, -2, 2]} // 坐标：放在树的右下方
                 rotation={[0, -0.3, 0]} // 稍微旋转，面向相机
                 fontSize={2.5}
                 letterSpacing={0.15}
                 font="https://fonts.gstatic.com/s/cinzel/v19/8vIJ7ww63mVu7gt79w.ttf" // 奢华衬线体
                 anchorX="center"
                 anchorY="middle"
               >
                 TO WQC
                 {/* 文字材质：高亮发光金 */}
                 <meshPhysicalMaterial
                   color="#FFD700"
                   emissive="#FFD700"
                   emissiveIntensity={1.2} // 让它在 Bloom 效果下发光
                   metalness={1.0}
                   roughness={0.2}
                   clearcoat={1.0}
                 />
               </Text>
             </Suspense>
           </group>
        </Float>
        
        {/* --- 电影感后期特效 --- */}
        <EffectComposer disableNormalPass>
          <Bloom 
            luminanceThreshold={0.9} 
            mipmapBlur 
            intensity={1.2} 
            radius={0.5}
            color="#FFD700" // 强制泛光带一点金黄色
          />
          <ChromaticAberration offset={[0.0015, 0.0015]} radialModulation={false} modulationOffset={0.0} />
          <Noise opacity={0.02} />
          <Vignette eskil={false} offset={0.1} darkness={1.0} />
        </EffectComposer>

        <OrbitControls 
          enablePan={false} 
          enableZoom={true}
          maxDistance={30}
          minDistance={10}
          autoRotate={treeState === 'TREE_SHAPE'}
          autoRotateSpeed={0.8}
          maxPolarAngle={Math.PI / 1.5}
        />
      </Canvas>
      
      {/* --- UI 层 --- */}
      <div className="ui-layer">
        <h1 className="title">ARIX SIGNATURE</h1>
        <p className="subtitle">Interactive Holiday Experience</p>
        
        <button className={`cta-button ${audioStarted ? 'active' : ''}`} onClick={handleStart}>
          {!audioStarted ? 'INITIALIZE EXPERIENCE' : (treeState === 'SCATTERED' ? 'ASSEMBLE' : 'RELEASE')}
        </button>
        
        <div className="hint">
          {audioStarted ? 'Drag to Rotate • Touch to Interact' : 'Headphones Recommended'}
        </div>
      </div>
    </div>
  )
}