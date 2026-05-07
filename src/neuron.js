import * as THREE from '../node_modules/three/build/three.module.js';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

function tube(points, radius, tubeSeg = 12) {
  return new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(points), tubeSeg, radius, 7, false
  );
}

export const SEG_N    = 6;
export const SEG_LEN  = 0.34;
export const NODE_LEN = 0.065;
export const AXON_BASE_Y = -0.82;

export function buildNeuron() {
  const group = new THREE.Group();

  // ── Materials ─────────────────────────────────────────
  const somaMat = new THREE.MeshStandardMaterial({
    color: 0x7eb8ff, roughness: 0.40, metalness: 0.10,
    emissive: new THREE.Color(0x1a3a6e), emissiveIntensity: 0.35,
  });
  const dendMat = new THREE.MeshStandardMaterial({
    color: 0x56cfb2, roughness: 0.60, metalness: 0.05,
  });
  const axonBaseMat = new THREE.MeshStandardMaterial({
    color: 0x5e9bfc, roughness: 0.45, metalness: 0.10,
    emissive: new THREE.Color(0x00091e), emissiveIntensity: 1.0,
  });
  const myelBaseMat = new THREE.MeshStandardMaterial({
    color: 0xddeeff, roughness: 0.25, metalness: 0.15,
    transparent: true, opacity: 0.88,
    emissive: new THREE.Color(0x000000), emissiveIntensity: 0,
  });
  const termMat = new THREE.MeshStandardMaterial({
    color: 0xf47067, roughness: 0.50, metalness: 0.05,
    emissive: new THREE.Color(0xf47067), emissiveIntensity: 0.40,
  });

  // ── Soma ──────────────────────────────────────────────
  const somaMesh = new THREE.Mesh(new THREE.SphereGeometry(0.38, 48, 48), somaMat);
  group.add(somaMesh);

  // ── Dendrites (5 primary + 1 branch each) ────────────
  const dendCfg = [
    { dir: v3( 0.55,  0.70,  0.25), len: 1.15 },
    { dir: v3(-0.70,  0.65,  0.15), len: 1.05 },
    { dir: v3( 0.20,  0.90, -0.45), len: 1.10 },
    { dir: v3(-0.40,  0.85, -0.30), len: 0.95 },
    { dir: v3( 0.05,  1.00,  0.40), len: 1.20 },
  ];

  for (const { dir, len } of dendCfg) {
    dir.normalize();
    const p0 = dir.clone().multiplyScalar(0.38);
    const jitter = v3(
      (Math.random() - 0.5) * 0.22,
      0,
      (Math.random() - 0.5) * 0.22
    );
    const p1 = dir.clone().multiplyScalar(len * 0.52).add(jitter);
    const p2 = dir.clone().multiplyScalar(len);

    group.add(new THREE.Mesh(tube([p0, p1, p2], 0.028), dendMat));

    // Branch: rotate dir ~35–55° on XZ plane
    const bAxis = v3(0, 1, 0);
    const bAngle = (Math.random() > 0.5 ? 1 : -1) * (0.6 + Math.random() * 0.3);
    const bDir = dir.clone().applyAxisAngle(bAxis, bAngle).normalize();
    const b1 = p2.clone();
    const b2 = p2.clone().add(bDir.multiplyScalar(0.46));
    group.add(new THREE.Mesh(
      tube([b1, b1.clone().lerp(b2, 0.5), b2], 0.016, 8),
      dendMat
    ));
  }

  // ── Axon hillock (tapered exit from soma) ─────────────
  group.add(new THREE.Mesh(
    tube([v3(0, -0.38, 0), v3(0.03, -0.58, 0.02), v3(0, AXON_BASE_Y, 0)], 0.072, 8),
    axonBaseMat.clone()
  ));

  // ── Myelinated segments + Nodes of Ranvier ────────────
  const axonSegments = [];

  for (let i = 0; i < SEG_N; i++) {
    const y0 = AXON_BASE_Y - i * (SEG_LEN + NODE_LEN);
    const y1 = y0 - SEG_LEN;
    const n1 = y1 - NODE_LEN;

    // Myelin sheath
    const mMat  = myelBaseMat.clone();
    const mMesh = new THREE.Mesh(
      tube([v3(0, y0, 0), v3(0, (y0 + y1) * 0.5, 0), v3(0, y1, 0)], 0.050, 6),
      mMat
    );
    group.add(mMesh);

    // Node of Ranvier (unmyelinated gap — visible axon membrane)
    const nMat  = axonBaseMat.clone();
    const nMesh = new THREE.Mesh(
      tube([v3(0, y1, 0), v3(0, (y1 + n1) * 0.5, 0), v3(0, n1, 0)], 0.026, 6),
      nMat
    );
    group.add(nMesh);

    axonSegments.push({
      mMesh, nMesh, mMat, nMat,
      t: i / (SEG_N - 1),        // 0 = first segment, 1 = last
      worldY: y0 - SEG_LEN * 0.5, // mid-point Y for light tracking
    });
  }

  // ── Axon terminals (boutons) ──────────────────────────
  const baseY = AXON_BASE_Y - SEG_N * (SEG_LEN + NODE_LEN);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.062, 16, 16), termMat);
    m.position.set(Math.cos(a) * 0.22, baseY - 0.16, Math.sin(a) * 0.11);
    group.add(m);
  }

  return { group, axonSegments, somaMat };
}
