"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const ACCENT = "#9b5cff";

function metal(color: string) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    metalness: 0.92,
    roughness: 0.33,
    envMapIntensity: 1.25,
  });
}

function accentMat() {
  const col = new THREE.Color(ACCENT);
  return new THREE.MeshStandardMaterial({
    color: col,
    metalness: 0.85,
    roughness: 0.26,
    envMapIntensity: 1.35,
    emissive: col.clone(),
    emissiveIntensity: 0.14,
  });
}

function roundedRectShape(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function gearGeo(r: number, teeth: number, depth: number, thick: number) {
  const shape = new THREE.Shape();
  const tip = r + depth;
  const seg = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * seg;
    const a1 = a + seg * 0.25;
    const a2 = a + seg * 0.5;
    const a3 = a + seg * 0.75;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    shape.lineTo(Math.cos(a1) * tip, Math.sin(a1) * tip);
    shape.lineTo(Math.cos(a2) * tip, Math.sin(a2) * tip);
    shape.lineTo(Math.cos(a3) * r, Math.sin(a3) * r);
  }
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, r * 0.34, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thick,
    bevelEnabled: true,
    bevelThickness: thick * 0.18,
    bevelSize: depth * 0.14,
    bevelSegments: 2,
    steps: 1,
    curveSegments: 20,
  });
  geo.center();
  return geo;
}

function makePadlock(bodyMat: THREE.Material, faceMat: THREE.Material) {
  const g = new THREE.Group();
  const bodyGeo = new THREE.ExtrudeGeometry(roundedRectShape(1.5, 1.5, 0.42), {
    depth: 0.55,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.06,
    bevelSegments: 2,
    steps: 1,
  });
  bodyGeo.center();
  g.add(new THREE.Mesh(bodyGeo, faceMat));
  const shackle = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.13, 18, 40, Math.PI),
    bodyMat
  );
  shackle.position.y = 0.75;
  g.add(shackle);
  const khMat = new THREE.MeshStandardMaterial({
    color: 0x14111c,
    metalness: 0.4,
    roughness: 0.6,
  });
  const kh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.14, 20), khMat);
  kh.rotation.x = Math.PI / 2;
  kh.position.set(0, -0.02, 0.32);
  g.add(kh);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.14), khMat);
  slot.position.set(0, -0.28, 0.32);
  g.add(slot);
  return g;
}

function makeKey(mat: THREE.Material) {
  const g = new THREE.Group();
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 14, 30), mat);
  bow.position.y = 0.95;
  g.add(bow);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.4, 16), mat);
  shaft.position.y = 0.1;
  g.add(shaft);
  const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.12), mat);
  t1.position.set(0.15, -0.42, 0);
  g.add(t1);
  const t2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.12), mat);
  t2.position.set(0.11, -0.66, 0);
  g.add(t2);
  return g;
}

function makeEnv(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const x = c.getContext("2d");
  if (!x) return;
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#2a1d4d");
  g.addColorStop(0.45, "#120e22");
  g.addColorStop(1, "#07060d");
  x.fillStyle = g;
  x.fillRect(0, 0, 512, 256);
  const spot = (cx: number, cy: number, r: number, col: string) => {
    const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    rg.addColorStop(0, col);
    rg.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = rg;
    x.fillRect(0, 0, 512, 256);
  };
  spot(140, 70, 170, "rgba(150,90,255,0.55)");
  spot(400, 150, 150, "rgba(80,140,255,0.35)");
  spot(300, 40, 90, "rgba(255,255,255,0.28)");
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  scene.environment = pmrem.fromEquirectangular(tex).texture;
  tex.dispose();
  pmrem.dispose();
}

export function ThreeHeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const clock = new THREE.Clock();
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a0813, 14, 42);
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 10);

    makeEnv(renderer, scene);
    scene.add(new THREE.AmbientLight(0x5a4f7a, 0.55));
    const dir = new THREE.DirectionalLight(0xffffff, 1.05);
    dir.position.set(5, 8, 6);
    scene.add(dir);
    const purpleLight = new THREE.PointLight(0x9b5cff, 1.7, 46);
    purpleLight.position.set(-6, 3, 5);
    scene.add(purpleLight);
    const pl2 = new THREE.PointLight(0x4f8cff, 0.8, 46);
    pl2.position.set(6, -3, 3);
    scene.add(pl2);
    const back = new THREE.DirectionalLight(0xc59cff, 0.5);
    back.position.set(-4, -3, -6);
    scene.add(back);

    // dust particles
    const dustN = 170;
    const pos = new Float32Array(dustN * 3);
    for (let i = 0; i < dustN; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 18;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const dust = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        color: 0xb9a0ff,
        size: 0.05,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      })
    );
    scene.add(dust);

    // floating gears / keys / padlocks
    const objGroup = new THREE.Group();
    scene.add(objGroup);
    const density = window.innerWidth < 640 ? 14 : 24;
    const palette = ["#b4bacb", "#73788c", "#d9c486"];
    for (let i = 0; i < density; i++) {
      const mat =
        Math.random() < 0.24
          ? accentMat()
          : metal(palette[(Math.random() * palette.length) | 0]);
      const t = Math.random();
      let o: THREE.Object3D;
      if (t < 0.42) {
        o = new THREE.Mesh(
          gearGeo(0.45 + Math.random() * 0.35, 9 + ((Math.random() * 5) | 0), 0.18, 0.2),
          mat
        );
        o.scale.setScalar(0.85 + Math.random() * 0.4);
      } else if (t < 0.74) {
        o = makeKey(mat);
        o.scale.setScalar(0.5 + Math.random() * 0.3);
      } else {
        o = makePadlock(mat, mat);
        o.scale.setScalar(0.38 + Math.random() * 0.22);
      }
      const depth = -3 - Math.random() * 20;
      const dist = 10 - depth;
      const halfW = dist * 0.414 * 1.55;
      const halfH = dist * 0.414 * 0.92;
      const home = new THREE.Vector3(
        (Math.random() * 2 - 1) * halfW,
        (Math.random() * 2 - 1) * halfH,
        depth
      );
      o.position.copy(home);
      o.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      o.userData.home = home;
      o.userData.spin = new THREE.Vector3(
        (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.4
      );
      o.userData.phase = Math.random() * 6;
      o.userData.bobSpd = 0.4 + Math.random() * 0.7;
      o.userData.burstScale = 0.5 + Math.random() * 0.9;
      objGroup.add(o);
    }

    const mouse = { x: 0, y: 0 };
    const smooth = { x: 0, y: 0 };
    let clickAt: number | null = null;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onClick = () => {
      clickAt = clock.elapsedTime;
    };
    const setSize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("click", onClick);
    window.addEventListener("resize", setSize);
    setSize();

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      smooth.x += (mouse.x - smooth.x) * 0.06;
      smooth.y += (mouse.y - smooth.y) * 0.06;
      let burst = 0;
      if (clickAt != null) {
        const k = t - clickAt;
        burst = k < 1.4 ? 1 - k / 1.4 : 0;
        if (k >= 1.4) clickAt = null;
      }
      objGroup.rotation.y += dt * 0.04;
      objGroup.children.forEach((o) => {
        const u = o.userData;
        if (u.spin) {
          o.rotation.x += u.spin.x * dt;
          o.rotation.y += u.spin.y * dt;
          o.rotation.z += u.spin.z * dt;
        }
        if (u.home) {
          const out = 1 + burst * 0.6 * u.burstScale;
          o.position.set(
            u.home.x * out,
            u.home.y * out + Math.sin(t * u.bobSpd + u.phase) * 0.25,
            u.home.z * out
          );
        }
      });
      dust.rotation.y += dt * 0.01;
      camera.position.x += (smooth.x * 3 - camera.position.x) * 0.04;
      camera.position.y += (-smooth.y * 2 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("click", onClick);
      window.removeEventListener("resize", setSize);
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(
            (m) => m.dispose()
          );
        }
      });
      scene.environment?.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <>
      <div className="fixed inset-0 z-0 bg-[#0a0812]" aria-hidden="true" />
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-0 block h-screen w-screen"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(124,77,255,.10),transparent_55%),radial-gradient(100%_60%_at_50%_120%,rgba(10,8,18,.9),transparent)]"
        aria-hidden="true"
      />
    </>
  );
}
