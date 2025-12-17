import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { motion } from 'framer-motion';

const Hero = ({ onGetStarted }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000,
      );
      camera.position.z = 4;

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      const particlesCount = 3500;
      const positions = new Float32Array(particlesCount * 3);

      for (let i = 0; i < particlesCount * 3; i += 1) {
        positions[i] = (Math.random() - 0.5) * 12;
      }

      const particlesGeometry = new THREE.BufferGeometry();
      particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const particlesMaterial = new THREE.PointsMaterial({
        color: 0x10b981,
        size: 0.025,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });

      const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
      scene.add(particlesMesh);

      const mouse = { x: 0, y: 0 };
      const onMouseMove = (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      };

      window.addEventListener('mousemove', onMouseMove);

      const onResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };

      window.addEventListener('resize', onResize);

      const clock = new THREE.Clock();

      const animate = () => {
        const elapsed = clock.getElapsedTime();

        particlesMesh.rotation.y = elapsed * 0.03;
        particlesMesh.rotation.x = Math.sin(elapsed * 0.15) * 0.08;

        particlesMesh.position.x += (mouse.x * 0.2 - particlesMesh.position.x) * 0.02;
        particlesMesh.position.y += (mouse.y * 0.2 - particlesMesh.position.y) * 0.02;

        renderer.render(scene, camera);
        requestAnimationFrame(animate);
      };

      animate();

      return () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('resize', onResize);
        particlesGeometry.dispose();
        particlesMaterial.dispose();
        renderer.dispose();
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Three.js initialization error:', error);
      // Continue rendering even if WebGL fails
    }
  }, []);

  return (
    <section className="relative h-screen w-full overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#10b98122,transparent_60%),radial-gradient(circle_at_bottom,#06b6d422,transparent_60%)] mix-blend-screen" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight text-coolwhite drop-shadow-2xl"
        >
          Study Smarter with{' '}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-300 bg-clip-text text-transparent">
            Grounded AI
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.7 }}
          className="mt-5 max-w-xl text-base sm:text-lg md:text-xl text-slate-200/80"
        >
          NotebookLM-inspired, but reimagined with emerald glassmorphism, voice-first dialogue,
          and 100% grounded economics tutoring.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
        >
          <button
            type="button"
            onClick={onGetStarted}
            className="relative inline-flex items-center justify-center rounded-full px-8 py-3 text-sm sm:text-base font-medium text-slate-900 shadow-xl shadow-emerald-600/40 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-300 hover:scale-[1.02] hover:shadow-emerald-500/50 transition-all duration-200"
          >
            <span className="relative z-10">Open Dashboard</span>
          </button>
          <span className="text-xs sm:text-sm text-slate-300/80">
            Voice Q&amp;A • WebGL insights • Exam-focused summaries
          </span>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;


