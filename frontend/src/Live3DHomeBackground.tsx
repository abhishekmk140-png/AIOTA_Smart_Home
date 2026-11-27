import { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface Live3DHomeBackgroundProps {
  theme?: 'dark' | 'light'
}

export function Live3DHomeBackground({ theme = 'dark' }: Live3DHomeBackgroundProps) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene()
    const isDark = theme === 'dark'

    scene.background = new THREE.Color(isDark ? 0x090d16 : 0xf1f5f9)
    scene.fog = new THREE.FogExp2(isDark ? 0x090d16 : 0xf1f5f9, 0.028)

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    )
    camera.position.set(7, 5, 8.5)
    camera.lookAt(0, 1.2, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = isDark ? 1.15 : 1.05
    renderer.domElement.style.position = 'absolute'
    renderer.domElement.style.inset = '0'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.pointerEvents = 'none'
    renderer.domElement.style.zIndex = '-1'
    container.appendChild(renderer.domElement)

    // 2. Lighting System
    const ambientLight = new THREE.AmbientLight(
      isDark ? 0x1e293b : 0xe2e8f0,
      isDark ? 1.2 : 1.8
    )
    scene.add(ambientLight)

    // Window daylight / moonlight directional light
    const windowLight = new THREE.DirectionalLight(
      isDark ? 0x60a5fa : 0xffedd5,
      isDark ? 1.5 : 2.2
    )
    windowLight.position.set(6, 6, -3)
    windowLight.castShadow = true
    windowLight.shadow.mapSize.width = 1024
    windowLight.shadow.mapSize.height = 1024
    scene.add(windowLight)

    // Smart IoT warm ceiling spotlight
    const ceilingSpot = new THREE.SpotLight(0xf59e0b, isDark ? 2.8 : 1.5, 12, Math.PI / 4, 0.4)
    ceilingSpot.position.set(0, 4.5, 0)
    ceilingSpot.target.position.set(0, 0, 0)
    scene.add(ceilingSpot)
    scene.add(ceilingSpot.target)

    // Smart neon cyan accent light (desk / hub)
    const neonCyanLight = new THREE.PointLight(0x06b6d4, isDark ? 2.5 : 1.2, 6)
    neonCyanLight.position.set(-1.8, 1.8, 0.5)
    scene.add(neonCyanLight)

    // Smart indigo accent light (shelves / lounge)
    const neonVioletLight = new THREE.PointLight(0x8b5cf6, isDark ? 2.0 : 1.0, 7)
    neonVioletLight.position.set(2.2, 2.0, -1.5)
    scene.add(neonVioletLight)

    // 3. Materials
    const floorMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x1e2230 : 0xe2e8f0,
      roughness: 0.35,
      metalness: 0.15,
    })

    const wallMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x111625 : 0xf8fafc,
      roughness: 0.85,
    })

    const slatMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x1a2133 : 0xcbd5e1,
      roughness: 0.6,
    })

    const deskMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x0f172a : 0x334155,
      roughness: 0.25,
      metalness: 0.3,
    })

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.22,
      roughness: 0.1,
      transmission: 0.85,
      thickness: 0.5,
    })

    const sofaMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x252e42 : 0x64748b,
      roughness: 0.9,
    })

    const screenMat = new THREE.MeshBasicMaterial({
      color: isDark ? 0x38bdf8 : 0x0284c7,
    })

    const plantMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.5,
    })

    const potMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x334155 : 0x94a3b8,
      roughness: 0.4,
    })

    // 4. Construct Room Architecture
    // Floor
    const floorGeo = new THREE.PlaneGeometry(16, 16)
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)

    // Back Wall
    const backWallGeo = new THREE.BoxGeometry(16, 6, 0.4)
    const backWall = new THREE.Mesh(backWallGeo, wallMat)
    backWall.position.set(0, 3, -4)
    backWall.receiveShadow = true
    scene.add(backWall)

    // Left Wall
    const leftWallGeo = new THREE.BoxGeometry(0.4, 6, 16)
    const leftWall = new THREE.Mesh(leftWallGeo, wallMat)
    leftWall.position.set(-5, 3, 0)
    leftWall.receiveShadow = true
    scene.add(leftWall)

    // Architectural Wood Slats Accent on Back Wall
    const slatGroup = new THREE.Group()
    for (let i = -4.5; i <= 0.5; i += 0.25) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.12, 5.5, 0.1), slatMat)
      slat.position.set(i, 2.8, -3.75)
      slat.castShadow = true
      slatGroup.add(slat)
    }
    scene.add(slatGroup)

    // Large Panoramic Window Frame on Right
    const winFrameMat = new THREE.MeshStandardMaterial({ color: isDark ? 0x0f172a : 0x475569 })
    const winTop = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 7), winFrameMat)
    winTop.position.set(4.5, 5, -0.5)
    const winBottom = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 7), winFrameMat)
    winBottom.position.set(4.5, 0.8, -0.5)
    const winGlass = new THREE.Mesh(new THREE.BoxGeometry(0.05, 4.2, 6.9), glassMat)
    winGlass.position.set(4.5, 2.9, -0.5)
    scene.add(winTop, winBottom, winGlass)

    // Outdoor City / Garden Horizon Glow through Window
    const horizonGeo = new THREE.PlaneGeometry(12, 6)
    const horizonMat = new THREE.MeshBasicMaterial({
      color: isDark ? 0x1e3a8a : 0xbae6fd,
      side: THREE.DoubleSide,
    })
    const horizon = new THREE.Mesh(horizonGeo, horizonMat)
    horizon.position.set(6.5, 3, -0.5)
    horizon.rotation.y = -Math.PI / 2
    scene.add(horizon)

    // 5. Smart Office Area (Desk, Curved Monitor, Chair)
    const officeGroup = new THREE.Group()

    // Smart Executive Desk
    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 1.3), deskMat)
    deskTop.position.set(-2.2, 1.4, -1.8)
    deskTop.castShadow = true
    deskTop.receiveShadow = true

    const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.4, 12)
    const legMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.2 })
    const leg1 = new THREE.Mesh(legGeo, legMat)
    leg1.position.set(-3.3, 0.7, -2.3)
    const leg2 = new THREE.Mesh(legGeo, legMat)
    leg2.position.set(-1.1, 0.7, -2.3)
    const leg3 = new THREE.Mesh(legGeo, legMat)
    leg3.position.set(-3.3, 0.7, -1.3)
    const leg4 = new THREE.Mesh(legGeo, legMat)
    leg4.position.set(-1.1, 0.7, -1.3)

    // Curved Smart Monitor
    const screenGeo = new THREE.BoxGeometry(1.6, 0.75, 0.05)
    const screen = new THREE.Mesh(screenGeo, screenMat)
    screen.position.set(-2.2, 2.05, -2.2)
    const screenStand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), legMat)
    screenStand.position.set(-2.2, 1.65, -2.2)

    // Desk LED Glow bar underneath
    const deskGlowGeo = new THREE.BoxGeometry(2.5, 0.03, 0.03)
    const deskGlowMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 })
    const deskGlow = new THREE.Mesh(deskGlowGeo, deskGlowMat)
    deskGlow.position.set(-2.2, 1.34, -1.2)

    officeGroup.add(deskTop, leg1, leg2, leg3, leg4, screen, screenStand, deskGlow)
    scene.add(officeGroup)

    // Modern Ergonomic Chair
    const chairGroup = new THREE.Group()
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.7), sofaMat)
    seat.position.set(-2.2, 0.9, -1.0)
    const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.8, 0.1), sofaMat)
    backrest.position.set(-2.2, 1.35, -0.65)
    const chairPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8), legMat)
    chairPole.position.set(-2.2, 0.45, -1.0)
    chairGroup.add(seat, backrest, chairPole)
    scene.add(chairGroup)

    // 6. Smart Lounge Living Area (Sofa, Coffee Table, Ambient Lamp)
    const loungeGroup = new THREE.Group()

    // Modern Minimalist Sofa
    const sofaBase = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.45, 1.4), sofaMat)
    sofaBase.position.set(1.4, 0.35, 0.8)
    sofaBase.castShadow = true
    const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.9, 0.4), sofaMat)
    sofaBack.position.set(1.4, 0.85, 1.4)
    const cushion1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.2), new THREE.MeshStandardMaterial({ color: 0x6366f1, roughness: 0.8 }))
    cushion1.position.set(0.6, 0.8, 1.2)
    const cushion2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.2), new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.8 }))
    cushion2.position.set(2.2, 0.8, 1.2)

    // Modern Round Coffee Table
    const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.08, 24), deskMat)
    tableTop.position.set(1.4, 0.5, -0.5)
    const tableLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 0.5, 16), legMat)
    tableLeg.position.set(1.4, 0.25, -0.5)

    // Smart Tablet on Coffee Table
    const tablet = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.02, 0.25), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }))
    tablet.position.set(1.4, 0.55, -0.5)

    loungeGroup.add(sofaBase, sofaBack, cushion1, cushion2, tableTop, tableLeg, tablet)
    scene.add(loungeGroup)

    // 7. Architectural Plant in Geometric Planter
    const plantGroup = new THREE.Group()
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 0.8, 16), potMat)
    pot.position.set(-4.2, 0.4, 1.5)
    pot.castShadow = true
    plantGroup.add(pot)

    for (let l = 0; l < 8; l++) {
      const leafGeo = new THREE.SphereGeometry(0.35, 8, 8)
      leafGeo.scale(1, 0.1, 0.6)
      const leaf = new THREE.Mesh(leafGeo, plantMat)
      const angle = (l / 8) * Math.PI * 2
      leaf.position.set(
        -4.2 + Math.cos(angle) * 0.35,
        0.85 + l * 0.12,
        1.5 + Math.sin(angle) * 0.35
      )
      leaf.rotation.y = angle
      leaf.rotation.z = 0.35
      plantGroup.add(leaf)
    }
    scene.add(plantGroup)

    // 8. Wall-Mounted Smart IoT Control Panel (Pulsing Indicator)
    const panelGeo = new THREE.BoxGeometry(0.6, 0.9, 0.04)
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.1, metalness: 0.9 })
    const iotPanel = new THREE.Mesh(panelGeo, panelMat)
    iotPanel.position.set(-4.78, 2.6, -0.5)
    iotPanel.rotation.y = Math.PI / 2

    const panelGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.75),
      new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide })
    )
    panelGlow.position.set(-4.75, 2.6, -0.5)
    panelGlow.rotation.y = Math.PI / 2
    scene.add(iotPanel, panelGlow)

    // 9. Floating Floating Shelves with Smart Lighting
    const shelfGeo = new THREE.BoxGeometry(2.4, 0.08, 0.5)
    const shelf1 = new THREE.Mesh(shelfGeo, deskMat)
    shelf1.position.set(1.8, 3.2, -3.7)
    const shelf2 = new THREE.Mesh(shelfGeo, deskMat)
    shelf2.position.set(1.8, 2.4, -3.7)

    const shelfLed1 = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.02, 0.02), new THREE.MeshBasicMaterial({ color: 0x8b5cf6 }))
    shelfLed1.position.set(1.8, 3.15, -3.46)
    const shelfLed2 = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.02, 0.02), new THREE.MeshBasicMaterial({ color: 0xf59e0b }))
    shelfLed2.position.set(1.8, 2.35, -3.46)

    scene.add(shelf1, shelf2, shelfLed1, shelfLed2)

    // 10. Ambient Floating Atmospheric Light Dust Particles
    const particleCount = 45
    const particleGeo = new THREE.BufferGeometry()
    const particlePos = new Float32Array(particleCount * 3)
    for (let p = 0; p < particleCount * 3; p += 3) {
      particlePos[p] = (Math.random() - 0.5) * 8
      particlePos[p + 1] = Math.random() * 4.5 + 0.5
      particlePos[p + 2] = (Math.random() - 0.5) * 8
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3))
    const particleMat = new THREE.PointsMaterial({
      color: isDark ? 0x67e8f9 : 0xf59e0b,
      size: 0.06,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    })
    const particles = new THREE.Points(particleGeo, particleMat)
    scene.add(particles)

    // 11. Mouse & Parallax Interactive Physics
    let targetRotX = 0
    let targetRotY = 0
    let mouseX = 0
    let mouseY = 0

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
      mouseX = (clientX / window.innerWidth - 0.5) * 2
      mouseY = (clientY / window.innerHeight - 0.5) * 2
      targetRotX = mouseY * 0.25
      targetRotY = mouseX * 0.4
    }

    window.addEventListener('mousemove', handlePointerMove, { passive: true })
    window.addEventListener('touchmove', handlePointerMove, { passive: true })

    // 12. 60 FPS Render Loop with Breathing Animation
    let animationFrameId: number
    let clock = new THREE.Clock()

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)
      const elapsed = clock.getElapsedTime()

      // Gentle organic breathing camera orbit
      const breatheX = Math.sin(elapsed * 0.35) * 0.25
      const breatheY = Math.cos(elapsed * 0.25) * 0.15

      // Smooth camera interpolation toward mouse parallax + breathing orbit
      camera.position.x += ((7 + breatheX + targetRotY * 1.8) - camera.position.x) * 0.035
      camera.position.y += ((5 + breatheY - targetRotX * 1.2) - camera.position.y) * 0.035
      camera.lookAt(0, 1.2, 0)

      // Pulse IoT lighting
      const pulse = 1 + Math.sin(elapsed * 2.0) * 0.15
      neonCyanLight.intensity = (isDark ? 2.5 : 1.2) * pulse
      neonVioletLight.intensity = (isDark ? 2.0 : 1.0) * (1 + Math.cos(elapsed * 1.5) * 0.15)
      panelGlow.scale.set(1 + Math.sin(elapsed * 3.0) * 0.04, 1, 1)

      // Drift dust motes
      const positions = particleGeo.attributes.position.array as Float32Array
      for (let i = 1; i < positions.length; i += 3) {
        positions[i] += Math.sin(elapsed + i) * 0.002
        if (positions[i] > 5) positions[i] = 0.5
      }
      particleGeo.attributes.position.needsUpdate = true

      renderer.render(scene, camera)
    }

    animate()

    // 13. Responsive Resize Handler
    const handleResize = () => {
      if (!container) return
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }
    window.addEventListener('resize', handleResize)

    // 14. Cleanup on unmount
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('touchmove', handlePointerMove)
      cancelAnimationFrame(animationFrameId)
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [theme])

  return (
    <div
      ref={mountRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    />
  )
}
