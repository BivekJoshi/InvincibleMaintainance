import { useEffect, useRef, useState } from 'react';
import { Group, Matrix4, PerspectiveCamera, Vector3, WebGLRenderer } from 'three';
import { ROOMS } from './rooms';
import { buildModel } from './model';
import { paint } from './palette';
import { applyPose } from './pose';
import { STATIC_POSE, poseAt } from './timeline';
import { CENTRE, FIT_DENSE, FIT_WIDE, UP, VIEW } from './constants';
import { SectionCutFallback } from './SectionCutFallback';
import { cn } from '@/helpers/utils';

/**
 * Section Cut — an exploded bathroom-corner detail that builds itself, then
 * peels open twice to show what it is made of.
 *
 * This is the hero's anchor, and it is deliberately nothing like the timber
 * frame on the login screen: solid shaded material rather than wireframe, a
 * colour per layer rather than gold-on-ink, and a camera that leans around a
 * still object rather than a model that spins. The subject is the trades the
 * company actually sells — screed, waterproofing, tile, conduit, supply, waste.
 *
 * The rules it plays by:
 *   1. Decoration beside a CTA. It never takes a pointer event, never looks
 *      clickable, and holds still for about four fifths of its cycle.
 *   2. Colour comes from CSS variables, so a theme toggle repaints it in place
 *      rather than stranding it or replaying the build.
 *   3. `prefers-reduced-motion` gets one composed still frame and no rAF, ever.
 *   4. It stops when the hero scrolls away or the tab is hidden.
 *   5. No textures, no assets, no network. Every shape is procedural.
 *
 * This file owns only the browser end of that: the renderer, the camera rig,
 * the observers that start and stop it, and the caption. The scene itself is
 * split by what each part answers —
 *
 *   constants.js  the drawing, in metres
 *   profiles.js   the two turned profiles and the drilled cement board
 *   model.js      builds it: geometry, materials, lights, the whole graph
 *   palette.js    CSS variables → materials and lights, re-read on theme change
 *   timeline.js   what the scene is doing at time t — pure, no scene graph
 *   pose.js       applies a pose to the graph — the only writer
 *   easing.js     the four curves the timeline is written with
 *   rooms.js      the five fit-outs the model cycles through
 */

// What the scene is made of, in build order, for the screen-reader list.
const DEFAULT_LAYERS = [
  'Reinforced concrete slab', 'Cement screed', 'Waterproof membrane', 'Notched tile adhesive',
  'Terracotta floor tile', 'Blockwork', 'Conduit and supply pipes', 'Cement board', 'Wall tile',
];

/**
 * @param {object} props
 * @param {string} [props.className]
 * @param {boolean} [props.reduced] Render one static frame and schedule no rAF.
 * @param {string[]} [props.layerLabels] The screen-reader layer list, in build order.
 */
export function SectionCutScene({ className, reduced = false, layerLabels }) {
  const hostRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [pass, setPass] = useState({ room: 0, phase: null });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let renderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      setFailed(true);
      return undefined;
    }

    renderer.setClearAlpha(0);
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
    host.appendChild(renderer.domElement);

    // The model — every geometry, material and group — is built once, here.
    const model = buildModel();
    const { scene } = model;

    const camera = new PerspectiveCamera(34, 1, 3.0, 18);
    // The camera hangs off a rig centred on the model, so the pointer leans the
    // view around a still object rather than spinning the object. Nine separated
    // layers swim if you rotate them; they hold if you rotate the eye.
    const rig = new Group();
    rig.position.copy(CENTRE);
    rig.add(camera);
    scene.add(rig);

    paint(model);

    // The last pose applied, so a resize or a repaint can re-apply it rather
    // than guessing where on the timeline the scene had got to.
    let lastPose = STATIC_POSE;
    const showPose = (next) => { applyPose(model, next); lastPose = next; };

    // ── size ──
    let dense = false;
    let baseDistance = 7.5;
    const bias = new Vector3();

    // `Object3D.lookAt` takes a point in WORLD space, and the rig's origin is
    // already the target — so passing `rig.worldToLocal(CENTRE)` handed it a
    // constant (0,0,0) and aimed the camera at the world origin, most of a metre
    // below the model. Aim in the rig's own space instead, which is also what
    // lets the parallax rotate the rig without changing what is being looked at.
    const aimLocal = new Matrix4();
    const RIG_ORIGIN = new Vector3();
    const placeCamera = (dolly) => {
      camera.position.copy(VIEW).multiplyScalar(baseDistance * dolly).add(bias);
      aimLocal.lookAt(camera.position, RIG_ORIGIN, camera.up);
      camera.quaternion.setFromRotationMatrix(aimLocal);
    };

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      dense = w < 520;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dense ? 1.5 : 1.75));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      // The distance that fits in BOTH axes: a short wide panel is constrained
      // vertically, a narrow one horizontally. Take whichever is tighter.
      const vFov = (camera.fov * Math.PI) / 180;
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
      baseDistance = (dense ? FIT_DENSE : FIT_WIDE) / Math.sin(Math.min(vFov, hFov) / 2);

      // The bias sits on the camera's own position, never on the aim point:
      // offsetting the target makes the model slide across the panel instead of
      // being leaned around.
      bias.set(0, 0, 0);
      if (!dense) bias.crossVectors(VIEW, UP).normalize().multiplyScalar(-0.24);

      placeCamera(lastPose.dolly);
      showPose(lastPose);
      renderer.render(scene, camera);
    };

    const resizeWatcher = new ResizeObserver(resize);
    resizeWatcher.observe(host);

    const themeWatcher = new MutationObserver(() => {
      paint(model);
      showPose(lastPose);
      renderer.render(scene, camera);
    });
    themeWatcher.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    // ── pointer: parallax only, and never on a touch device ──
    const aim = { x: 0, y: 0 };
    const eye = { x: 0, y: 0 };
    const fine = window.matchMedia ? window.matchMedia('(pointer: fine)').matches : false;
    const onPointerMove = (e) => {
      const r = host.getBoundingClientRect();
      aim.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
      aim.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
    };
    const onPointerLeave = (e) => { if (!e.relatedTarget) { aim.x = 0; aim.y = 0; } };
    if (fine && !reduced) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      // On the document, not the host: the host carries pointer-events: none,
      // so a listener there can never fire and the lean sticks where it was.
      document.addEventListener('pointerout', onPointerLeave);
    }

    // ── the loop ──
    let raf = 0;
    let elapsed = 0;
    let last = 0;
    let onScreen = true;
    let shown = null;

    const draw = (t) => {
      const pose = poseAt(t);
      showPose(pose);
      placeCamera(pose.dolly);
      rig.rotation.y = eye.x * 0.085;
      rig.rotation.x = eye.y * 0.045;
      renderer.render(scene, camera);
      // Two setState calls per room, never one per frame.
      const line = `${pose.room}:${pose.phase ?? ''}`;
      if (line !== shown) { shown = line; setPass({ room: pose.room, phase: pose.phase }); }
    };

    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      // Clamped deltas, never wall-clock elapsed: a 32s cycle read off a real
      // clock would teleport most of the way into a reveal after a scroll-past.
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      elapsed += dt;
      eye.x += (aim.x - eye.x) * Math.min(dt * 3.2, 1);
      eye.y += (aim.y - eye.y) * Math.min(dt * 3.2, 1);
      draw(elapsed);
    };
    const play = () => {
      if (raf || reduced || !onScreen || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const pause = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };

    resize();
    // Compile before anything is hidden, so the shader hitch lands on an empty
    // canvas rather than in the middle of the build.
    renderer.compile(scene, camera);

    if (reduced) {
      showPose(STATIC_POSE);
      placeCamera(1);
      renderer.render(scene, camera);
    } else {
      play();
    }

    const onVisibility = () => (document.hidden ? pause() : play());
    document.addEventListener('visibilitychange', onVisibility);
    const viewWatcher = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) play(); else pause();
    }, { rootMargin: '120px' });
    viewWatcher.observe(host);

    return () => {
      pause();
      viewWatcher.disconnect();
      resizeWatcher.disconnect();
      themeWatcher.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerout', onPointerLeave);
      // Nine geometries are shared across ~90 meshes, so a scene.traverse()
      // would dispose the same buffer dozens of times. Dispose the list once.
      model.geometries.forEach((g) => g.dispose());
      model.materials.forEach((m) => m.dispose());
      model.instances.forEach((im) => im.dispose());
      // Each room kit allocates instanced meshes of its own, every one holding
      // an instanceMatrix buffer the list above knows nothing about.
      for (const kit of model.kits ?? []) {
        for (const group of [kit.wall, kit.floor]) {
          group.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
        }
      }
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [reduced]);

  const labels = layerLabels ?? DEFAULT_LAYERS;
  const room = ROOMS[pass.room] ?? ROOMS[0];

  if (failed) return <SectionCutFallback className={className} labels={labels} />;

  return (
    <figure className={cn('relative m-0', className)}>
      <div ref={hostRef} aria-hidden className="aspect-[7/6] w-full" style={{ pointerEvents: 'none' }} />
      {/* Every room and every layer named in text, so the panel is legible to a
          screen reader and to a crawler whatever WebGL does. */}
      <ul className="sr-only">
        {ROOMS.map((r) => <li key={r.key}>{r.name}: {r.caption}</li>)}
        {labels.map((l) => <li key={l}>{l}</li>)}
      </ul>
      <figcaption className="flex min-h-[2.75rem] items-center gap-2.5 border-t bg-muted/40 px-5 py-2.5 text-[12px] leading-snug text-muted-foreground">
        {reduced ? (
          <span>{ROOMS.map((r) => r.name).join(' · ')} — the rooms we fit out and maintain.</span>
        ) : (
          <>
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
              {room.name}
            </span>
            <span>{pass.phase === 'reveal' ? room.reveal : room.caption}</span>
          </>
        )}
      </figcaption>
    </figure>
  );
}
