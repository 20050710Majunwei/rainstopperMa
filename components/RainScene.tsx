import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RainState } from '../types';

interface RainSceneProps {
  rainStateRef: React.MutableRefObject<RainState>;
}

export const RainScene: React.FC<RainSceneProps> = ({ rainStateRef }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // --- Setup Three.js Scene ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050505, 0.002);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 50;
    camera.position.y = 10;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000);
    mountRef.current.appendChild(renderer.domElement);

    // --- Rain Particles ---
    const particleCount = 15000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount);

    const rangeX = 200;
    const rangeY = 200;
    const rangeZ = 100;

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * rangeX; // x
      positions[i * 3 + 1] = (Math.random() - 0.5) * rangeY; // y
      positions[i * 3 + 2] = (Math.random() - 0.5) * rangeZ; // z
      
      // Random individual velocity variance
      velocities[i] = 0.5 + Math.random() * 0.5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 1));

    // Create a texture for the drop
    const spriteConfig = (ctx: CanvasRenderingContext2D) => {
        ctx.beginPath();
        ctx.arc(16, 16, 10, 0, Math.PI * 2);
        ctx.fillStyle = "white";
        ctx.fill();
    };
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d');
    if (context) spriteConfig(context);
    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
      color: 0xaaccff,
      size: 0.8,
      map: texture,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const rainSystem = new THREE.Points(geometry, material);
    scene.add(rainSystem);

    // --- Spotlight for dramatic effect ---
    const spotLight = new THREE.SpotLight(0xffffff, 50);
    spotLight.position.set(0, 50, 20);
    spotLight.angle = Math.PI / 4;
    spotLight.penumbra = 0.5;
    scene.add(spotLight);
    
    const ambientLight = new THREE.AmbientLight(0x222222);
    scene.add(ambientLight);

    // --- Animation Loop ---
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      const delta = clock.getDelta(); // Time since last frame in seconds
      
      // Smoothly interpolate current physics speed towards target speed from gesture
      // We do some simple lerping here for visual smoothness
      const targetSpeed = rainStateRef.current.speed;
      // You can store currentSpeed on the geometry or closure if you want momentum, 
      // but direct mapping feels more responsive for "magic" control.
      const currentSpeed = targetSpeed; 

      const positionsAttr = geometry.attributes.position;
      const array = positionsAttr.array as Float32Array;
      const velocitiesAttr = geometry.attributes.velocity;
      const velArray = velocitiesAttr.array as Float32Array;

      // Base fall speed multiplier
      const baseSpeed = 40; 

      for (let i = 0; i < particleCount; i++) {
        const idx = i * 3 + 1; // y coordinate
        const v = velArray[i];

        // Move particle
        // y = y - (velocity * globalSpeed * baseSpeed * delta)
        // If speed is negative (reverse), it adds to Y.
        array[idx] -= v * currentSpeed * baseSpeed * delta;

        // Boundary checks to wrap particles around
        // Top boundary
        if (array[idx] < -rangeY / 2) {
          array[idx] += rangeY;
        }
        // Bottom boundary (for reverse rain)
        if (array[idx] > rangeY / 2) {
          array[idx] -= rangeY;
        }
      }

      positionsAttr.needsUpdate = true;
      
      // Slight rotation of the whole system for depth perception
      rainSystem.rotation.y += 0.001 * delta;

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    // --- Resize Handler ---
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [rainStateRef]);

  return <div ref={mountRef} className="absolute inset-0 z-0" />;
};
