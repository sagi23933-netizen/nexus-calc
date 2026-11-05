import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { prefersReducedMotion } from '../lib/hooks';

/** Rounded ticket with a semicircle notch on each side (the BulDeal coupon). */
function ticketShape(w: number, h: number, r: number, n: number) {
  const s = new THREE.Shape();
  const x0 = -w / 2;
  const y0 = -h / 2;
  const x1 = w / 2;
  const y1 = h / 2;
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0);
  s.quadraticCurveTo(x1, y0, x1, y0 + r);
  s.lineTo(x1, -n);
  s.absarc(x1, 0, n, -Math.PI / 2, Math.PI / 2, true);
  s.lineTo(x1, y1 - r);
  s.quadraticCurveTo(x1, y1, x1 - r, y1);
  s.lineTo(x0 + r, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - r);
  s.lineTo(x0, n);
  s.absarc(x0, 0, n, Math.PI / 2, -Math.PI / 2, true);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}

interface Floater {
  obj: THREE.Object3D;
  base: THREE.Vector3;
  amp: number;
  speed: number;
  phase: number;
  spin: THREE.Vector3;
  scaleTarget: number;
  boost: number;
}

export default function Hero3D({ className }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      return; // no WebGL — the CSS background stays
    }
    const reduce = prefersReducedMotion();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0, 11);

    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-4, 6, 8);
    scene.add(key, new THREE.HemisphereLight(0xf4ffe0, 0x2a3a10, 0.7));

    const disposables: { dispose: () => void }[] = [env, pmrem];
    const track = <T extends { dispose: () => void }>(x: T) => {
      disposables.push(x);
      return x;
    };

    const mat = {
      lime: track(new THREE.MeshPhysicalMaterial({ color: '#9bd11a', roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2, sheen: 0.4 })),
      leaf: track(new THREE.MeshPhysicalMaterial({ color: '#1e5c2e', roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.25 })),
      deep: track(new THREE.MeshPhysicalMaterial({ color: '#2f6b12', roughness: 0.4, clearcoat: 0.5 })),
      wood: track(new THREE.MeshPhysicalMaterial({ color: '#8c3f18', roughness: 0.55, clearcoat: 0.5, clearcoatRoughness: 0.4 })),
      cream: track(new THREE.MeshPhysicalMaterial({ color: '#fff6dc', roughness: 0.25, clearcoat: 1 })),
      gold: track(new THREE.MeshPhysicalMaterial({ color: '#ffc933', roughness: 0.18, metalness: 0.85, clearcoat: 1 })),
      red: track(new THREE.MeshPhysicalMaterial({ color: '#ff4d4d', roughness: 0.3, clearcoat: 0.8 })),
    };

    const ticketGeo = track(
      new THREE.ExtrudeGeometry(ticketShape(2.3, 1.55, 0.24, 0.24), { depth: 0.16, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 5, curveSegments: 28 }),
    );
    ticketGeo.center();
    const ringGeo = track(new THREE.TorusGeometry(0.17, 0.065, 18, 40));
    const barGeo = track(new THREE.BoxGeometry(0.13, 1.05, 0.12));
    const sphereGeo = track(new THREE.SphereGeometry(0.28, 40, 40));
    const coinGeo = track(new THREE.CylinderGeometry(0.34, 0.34, 0.09, 48));
    const torusGeo = track(new THREE.TorusGeometry(0.32, 0.11, 24, 60));

    const percent = (material: THREE.Material, scale = 1) => {
      const g = new THREE.Group();
      const a = new THREE.Mesh(ringGeo, material);
      a.position.set(-0.34, 0.3, 0);
      const b = new THREE.Mesh(ringGeo, material);
      b.position.set(0.34, -0.3, 0);
      const bar = new THREE.Mesh(barGeo, material);
      bar.rotation.z = -0.72;
      g.add(a, b, bar);
      g.scale.setScalar(scale);
      return g;
    };

    const ticket = (body: THREE.Material, glyph: THREE.Material) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(ticketGeo, body));
      const p = percent(glyph, 0.78);
      p.position.z = 0.16;
      g.add(p);
      const back = percent(glyph, 0.78);
      back.position.z = -0.16;
      back.rotation.y = Math.PI;
      g.add(back);
      return g;
    };

    const root = new THREE.Group();
    scene.add(root);
    const floaters: Floater[] = [];
    const add = (obj: THREE.Object3D, pos: [number, number, number], rot: [number, number, number], opts: Partial<Pick<Floater, 'amp' | 'speed'>> & { spin?: [number, number, number]; scale?: number } = {}) => {
      obj.position.set(...pos);
      obj.rotation.set(...rot);
      if (opts.scale) obj.scale.setScalar(opts.scale);
      root.add(obj);
      floaters.push({
        obj,
        base: new THREE.Vector3(...pos),
        amp: opts.amp ?? 0.18,
        speed: opts.speed ?? 0.8,
        phase: Math.random() * Math.PI * 2,
        spin: new THREE.Vector3(...(opts.spin ?? [0.05, 0.18, 0.02])),
        scaleTarget: opts.scale ?? 1,
        boost: 0,
      });
    };

    add(ticket(mat.lime, mat.leaf), [-2.6, 0.5, 0.6], [0.25, 0.5, -0.18], { scale: 1.25, amp: 0.22, speed: 0.7, spin: [0.02, 0.22, 0.01] });
    add(ticket(mat.leaf, mat.lime), [-0.3, -1.4, -1.5], [-0.2, -0.6, 0.3], { scale: 0.9, amp: 0.16, speed: 0.9 });
    add(ticket(mat.cream, mat.wood), [-4.9, -1.2, -0.8], [0.4, 0.9, 0.35], { scale: 0.8, amp: 0.2, speed: 1.1 });
    add(percent(mat.wood, 1.25), [-4.6, 1.7, -0.4], [0.1, 0.4, 0], { amp: 0.25, speed: 0.6, spin: [0.0, 0.5, 0.0] });
    add(percent(mat.lime, 0.9), [0.6, 1.7, -2.2], [0.2, -0.3, 0.1], { amp: 0.2, speed: 1.0, spin: [0.1, -0.4, 0.05] });
    add(new THREE.Mesh(sphereGeo, mat.gold), [-1.2, 2.1, 0.2], [0, 0, 0], { amp: 0.3, speed: 1.3, scale: 0.8 });
    add(new THREE.Mesh(sphereGeo, mat.lime), [-3.7, -2.3, 0.8], [0, 0, 0], { amp: 0.2, speed: 1.2, scale: 0.7 });
    add(new THREE.Mesh(sphereGeo, mat.red), [1.2, -0.4, -2.4], [0, 0, 0], { amp: 0.25, speed: 1.4, scale: 0.55 });
    add(new THREE.Mesh(coinGeo, mat.gold), [-1.4, -2.3, 1.2], [1.2, 0.2, 0.3], { amp: 0.22, speed: 1.0, spin: [0.6, 0.0, 0.3] });
    add(new THREE.Mesh(coinGeo, mat.gold), [-5.8, 0.6, -1.4], [1.0, 0.5, 0.1], { amp: 0.2, speed: 0.9, spin: [0.5, 0.2, 0.0], scale: 0.8 });
    add(new THREE.Mesh(torusGeo, mat.wood), [-2.4, 2.6, -1.6], [0.8, 0.3, 0], { amp: 0.2, speed: 0.8, spin: [0.3, 0.3, 0] });
    add(new THREE.Mesh(torusGeo, mat.leaf), [0.9, 0.4, -3.4], [0.4, 0.9, 0], { amp: 0.2, speed: 0.7, spin: [0.2, 0.4, 0], scale: 0.9 });

    // ---- layout ----
    let w = 1;
    let h = 1;
    const layout = () => {
      w = el.clientWidth || 1;
      h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // the cluster spans roughly x ∈ [-5.8, 1.2] — center it and shrink on narrow canvases
      const aspect = w / h;
      root.position.set(2.3, aspect < 1.2 ? 0.3 : 0, 0);
      root.scale.setScalar(Math.min(1.05, Math.max(0.55, aspect / 1.55)));
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(el);

    // ---- interaction ----
    const pointer = new THREE.Vector2(0, 0);
    const target = new THREE.Vector2(0, 0);
    const ray = new THREE.Raycaster();
    let hovered: Floater | null = null;
    const findFloater = (o: THREE.Object3D | null) => {
      while (o) {
        const f = floaters.find((x) => x.obj === o);
        if (f) return f;
        o = o.parent;
      }
      return null;
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      target.set(pointer.x, pointer.y);
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(root.children, true)[0];
      const f = hit ? findFloater(hit.object) : null;
      if (hovered && hovered !== f) hovered.scaleTarget /= 1.12;
      if (f && hovered !== f) f.scaleTarget *= 1.12;
      hovered = f;
      el.style.cursor = f ? 'pointer' : '';
    };
    const onLeave = () => {
      target.set(0, 0);
      if (hovered) hovered.scaleTarget /= 1.12;
      hovered = null;
      el.style.cursor = '';
    };
    const onClick = () => {
      if (hovered) hovered.boost = 1;
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('click', onClick);

    // ---- loop ----
    const clock = new THREE.Clock();
    let raf = 0;
    let visible = true;
    const tick = () => {
      const t = clock.getElapsedTime();
      root.rotation.y += (target.x * 0.28 - root.rotation.y) * 0.05;
      root.rotation.x += (-target.y * 0.16 - root.rotation.x) * 0.05;
      for (const f of floaters) {
        f.obj.position.y = f.base.y + Math.sin(t * f.speed + f.phase) * f.amp;
        f.obj.position.x = f.base.x + Math.cos(t * f.speed * 0.6 + f.phase) * f.amp * 0.4;
        const boost = 1 + f.boost * 14;
        f.obj.rotation.x += f.spin.x * 0.016 * boost;
        f.obj.rotation.y += f.spin.y * 0.016 * boost;
        f.obj.rotation.z += f.spin.z * 0.016 * boost;
        f.boost *= 0.96;
        const s = f.obj.scale.x + (f.scaleTarget - f.obj.scale.x) * 0.12;
        f.obj.scale.setScalar(s);
      }
      renderer.render(scene, camera);
      if (visible) raf = requestAnimationFrame(tick);
    };

    if (reduce) {
      renderer.render(scene, camera);
    } else {
      raf = requestAnimationFrame(tick);
    }

    const io = new IntersectionObserver(([entry]) => {
      const was = visible;
      visible = entry.isIntersecting && !document.hidden;
      if (visible && !was && !reduce) raf = requestAnimationFrame(tick);
      if (!visible) cancelAnimationFrame(raf);
    });
    io.observe(el);
    const onVis = () => {
      const was = visible;
      visible = !document.hidden;
      if (visible && !was && !reduce) raf = requestAnimationFrame(tick);
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelAnimationFrame(raf);
      visible = false;
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('click', onClick);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} className={className} aria-hidden />;
}
