import * as THREE from 'three';

export interface VRSupportStatus {
  hasWebXR: boolean;
  isImmersiveVRSupported: boolean;
  isSecureContext: boolean;
  messageId: string;
}

export class VRManager {
  public renderer: THREE.WebGLRenderer;
  public playerRig: THREE.Group;
  public leftController: THREE.Group;
  public rightController: THREE.Group;
  public aimLine: THREE.Mesh;
  public reticleMesh: THREE.Mesh;
  public currentSession: XRSession | null = null;
  private onSessionStateChange?: (isActive: boolean) => void;
  private leftGripModel: THREE.Group;
  private rightGripModel: THREE.Group;
  private aimLineMat: THREE.MeshBasicMaterial;
  private reticleMat: THREE.MeshBasicMaterial;

  private static createMetaHoloMaterial(colorHex: string): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(colorHex) },
      },
      vertexShader: `
        varying vec3 vNormalView;
        varying vec3 vViewPos;
        void main() {
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewPos = -mvPos.xyz;
          vNormalView = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying vec3 vNormalView;
        varying vec3 vViewPos;
        void main() {
          vec3 N = normalize(vNormalView);
          vec3 V = normalize(vViewPos);
          float fresnel = pow(1.0 - abs(dot(N, V)), 2.1);
          float alpha = mix(0.08, 0.85, fresnel);
          vec3 col = mix(uColor * 0.65, vec3(0.88, 0.98, 1.0), fresnel * 0.7);
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
    });
  }

  /**
   * Membuat model tangan hologram organik bergaya Meta Horizon OS
   * (siluet telapak anatomis halus + 3 ruas jari melengkung + shader Fresnel).
   */
  private static createHoloHand(isLeft: boolean, colorHex: string): THREE.Group {
    const hand = new THREE.Group();
    const mat = VRManager.createMetaHoloMaterial(colorHex);
    const sign = isLeft ? 1 : -1;

    // 1. Telapak tangan anatomis menggunakan kurva Bezier halus
    const palmShape = new THREE.Shape();
    palmShape.moveTo(-0.024, 0.046);
    palmShape.bezierCurveTo(-0.036, 0.015, -0.04, -0.018, -0.034, -0.044);
    palmShape.bezierCurveTo(-0.015, -0.052, 0.015, -0.052, 0.034, -0.042);
    palmShape.bezierCurveTo(0.04, -0.012, 0.034, 0.02, 0.024, 0.046);
    palmShape.bezierCurveTo(0.01, 0.052, -0.01, 0.052, -0.024, 0.046);

    const palmGeo = new THREE.ExtrudeGeometry(palmShape, {
      depth: 0.012,
      bevelEnabled: true,
      bevelSegments: 5,
      steps: 1,
      bevelSize: 0.007,
      bevelThickness: 0.007,
    });
    palmGeo.center();
    const palmMesh = new THREE.Mesh(palmGeo, mat);
    palmMesh.rotation.x = Math.PI / 2;
    palmMesh.position.set(0, 0, -0.004);
    hand.add(palmMesh);

    // Pergelangan tangan tirus
    const wristGeo = new THREE.CapsuleGeometry(0.024, 0.035, 6, 12);
    const wristMesh = new THREE.Mesh(wristGeo, mat);
    wristMesh.rotation.x = Math.PI / 2;
    wristMesh.scale.set(1.15, 0.72, 1);
    wristMesh.position.set(0, -0.004, 0.068);
    hand.add(wristMesh);

    // 2. Empat jari (3 ruas melengkung natural per jari)
    const addFinger = (
      baseX: number,
      baseZ: number,
      lengths: [number, number, number],
      radii: [number, number, number],
      splayY: number
    ) => {
      const root = new THREE.Group();
      root.position.set(baseX * sign, -0.001, baseZ);
      root.rotation.y = splayY * sign;

      let parent: THREE.Group = root;
      const bends = [0.22, 0.34, 0.28];
      lengths.forEach((len, idx) => {
        const segGroup = new THREE.Group();
        segGroup.rotation.x = -bends[idx];
        const segGeo = new THREE.CapsuleGeometry(radii[idx], len, 5, 10);
        const segMesh = new THREE.Mesh(segGeo, mat);
        segMesh.rotation.x = Math.PI / 2;
        segMesh.position.set(0, 0, -len * 0.5 - radii[idx] * 0.35);
        segGroup.add(segMesh);
        parent.add(segGroup);

        const nextPivot = new THREE.Group();
        nextPivot.position.set(0, 0, -len - radii[idx] * 0.5);
        segGroup.add(nextPivot);
        parent = nextPivot;
      });
      hand.add(root);
    };

    // Telunjuk, Tengah, Manis, Kelingking
    addFinger(-0.025, -0.044, [0.026, 0.018, 0.014], [0.0075, 0.0068, 0.0058], 0.06);
    addFinger(-0.008, -0.048, [0.029, 0.021, 0.015], [0.0078, 0.007, 0.006], 0.01);
    addFinger(0.009, -0.046, [0.027, 0.019, 0.014], [0.0074, 0.0066, 0.0056], -0.03);
    addFinger(0.025, -0.04, [0.021, 0.015, 0.012], [0.0066, 0.0058, 0.005], -0.09);

    // 3. Ibu jari (anatomis miring ke sisi dalam)
    const thumbRoot = new THREE.Group();
    thumbRoot.position.set(-0.032 * sign, -0.005, -0.005);
    thumbRoot.rotation.set(-0.22, 0.65 * sign, 0.38 * sign);
    const thumbBase = new THREE.Mesh(new THREE.CapsuleGeometry(0.0088, 0.024, 5, 10), mat);
    thumbBase.rotation.x = Math.PI / 2;
    thumbBase.position.set(0, 0, -0.014);
    thumbRoot.add(thumbBase);

    const thumbTip = new THREE.Mesh(new THREE.CapsuleGeometry(0.0074, 0.02, 5, 10), mat);
    thumbTip.rotation.x = Math.PI / 2;
    thumbTip.position.set(0, -0.004, -0.038);
    thumbTip.rotation.x += -0.25;
    thumbRoot.add(thumbTip);
    hand.add(thumbRoot);

    return hand;
  }

  constructor(
    renderer: THREE.WebGLRenderer,
    playerRig: THREE.Group,
    onSessionStateChange?: (isActive: boolean) => void
  ) {
    this.renderer = renderer;
    this.playerRig = playerRig;
    this.onSessionStateChange = onSessionStateChange;

    this.renderer.xr.enabled = true;

    const ctrl0 = this.renderer.xr.getController(0);
    const ctrl1 = this.renderer.xr.getController(1);
    this.leftController = ctrl0;
    this.rightController = ctrl1;

    this.playerRig.add(ctrl0);
    this.playerRig.add(ctrl1);

    // Sinar bidik Meta OS Style (pendek & samar saat bebas, panjang & tegas saat kena target)
    const beamGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 1, 8);
    beamGeo.rotateX(Math.PI / 2);
    beamGeo.translate(0, 0, -0.5);
    this.aimLineMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    this.aimLine = new THREE.Mesh(beamGeo, this.aimLineMat);
    this.aimLine.scale.set(1, 1, 1.5);
    this.aimLine.visible = false;
    this.rightController.add(this.aimLine);

    // Titik bulat tegas di ujung sinar saat mengenai target/tombol
    this.reticleMat = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.96,
    });
    this.reticleMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.032, 16, 16),
      this.reticleMat
    );
    this.reticleMesh.position.set(0, 0, -12);
    this.reticleMesh.visible = false;
    this.rightController.add(this.reticleMesh);

    // Hologram Tangan Meta OS
    this.leftGripModel = VRManager.createHoloHand(true, '#38bdf8');
    this.rightGripModel = VRManager.createHoloHand(false, '#22d3ee');
    this.leftController.add(this.leftGripModel);
    this.rightController.add(this.rightGripModel);

    // Pastikan handedness kiri & kanan selalu akurat sesuai laporan WebXR
    const handleConnect =
      (ctrl: THREE.Group, other: THREE.Group) =>
      (event: THREE.Event & { data?: XRInputSource }) => {
        const handedness = event.data?.handedness;
        if (handedness === 'right' && this.rightController !== ctrl) {
          this.rightController = ctrl;
          this.leftController = other;
          this.syncControllerAttachments();
        } else if (handedness === 'left' && this.leftController !== ctrl) {
          this.leftController = ctrl;
          this.rightController = other;
          this.syncControllerAttachments();
        }
      };
    ctrl0.addEventListener('connected', handleConnect(ctrl0, ctrl1));
    ctrl1.addEventListener('connected', handleConnect(ctrl1, ctrl0));
  }

  private syncControllerAttachments() {
    this.leftController.add(this.leftGripModel);
    this.rightController.add(this.rightGripModel);
    this.rightController.add(this.aimLine);
    this.rightController.add(this.reticleMesh);
  }

  public setLeftHandModelVisible(visible: boolean) {
    this.leftGripModel.visible = visible;
  }

  public setRightHandModelVisible(visible: boolean) {
    this.rightGripModel.visible = visible;
  }

  /**
   * Memperbarui gaya laser bidik Meta OS:
   * - Jika tidak mengenai objek (hitDistance === null): laser pendek (1.5m) & agak transparan tanpa ujung bulat.
   * - Jika mengenai musuh / objek / papan UI: laser memanjang tepat ke target, tegas, dengan ujung bulat bersinar.
   */
  public updateAimRay(hitDistance: number | null, colorHex = '#38bdf8') {
    if (!this.currentSession) return;
    this.aimLine.visible = true;
    this.aimLineMat.color.set(colorHex);

    if (hitDistance !== null && hitDistance > 0.05) {
      this.aimLine.scale.set(1.25, 1.25, hitDistance);
      this.aimLineMat.opacity = 0.92;
      this.reticleMesh.visible = true;
      this.reticleMesh.position.set(0, 0, -hitDistance);
      const dotScale = THREE.MathUtils.clamp(hitDistance * 0.16, 0.55, 2.2);
      this.reticleMesh.scale.setScalar(dotScale);
      this.reticleMat.color.set(colorHex);
    } else {
      this.aimLine.scale.set(0.75, 0.75, 1.5);
      this.aimLineMat.opacity = 0.28;
      this.reticleMesh.visible = false;
    }
  }

  public static async checkSupport(): Promise<VRSupportStatus> {
    if (typeof window === 'undefined') {
      return {
        hasWebXR: false,
        isImmersiveVRSupported: false,
        isSecureContext: false,
        messageId: 'Lingkungan bukan browser.',
      };
    }

    const isSecure = window.isSecureContext;
    if (!isSecure) {
      return {
        hasWebXR: false,
        isImmersiveVRSupported: false,
        isSecureContext: false,
        messageId:
          'WebXR memerlukan koneksi aman (HTTPS atau localhost). Mode Desktop/Mobile tetap dapat dimainkan.',
      };
    }

    if (!('xr' in navigator) || !navigator.xr) {
      return {
        hasWebXR: false,
        isImmersiveVRSupported: false,
        isSecureContext: true,
        messageId:
          'Browser ini belum mendukung WebXR Device API. Gunakan Meta Quest Browser pada Quest 3S untuk mode VR.',
      };
    }

    try {
      const supported = await navigator.xr.isSessionSupported('immersive-vr');
      if (!supported) {
        return {
          hasWebXR: true,
          isImmersiveVRSupported: false,
          isSecureContext: true,
          messageId:
            'Perangkat VR (immersive-vr) tidak terdeteksi. Hubungkan headset atau buka di Meta Quest 3S.',
        };
      }
      return {
        hasWebXR: true,
        isImmersiveVRSupported: true,
        isSecureContext: true,
        messageId: 'Mode VR (WebXR immersive-vr) siap diaktifkan.',
      };
    } catch {
      return {
        hasWebXR: true,
        isImmersiveVRSupported: false,
        isSecureContext: true,
        messageId: 'Gagal memeriksa sesi WebXR pada perangkat ini.',
      };
    }
  }

  public async enterVR(): Promise<{ ok: boolean; message: string }> {
    const status = await VRManager.checkSupport();
    if (!status.isImmersiveVRSupported || !navigator.xr) {
      return { ok: false, message: status.messageId };
    }

    try {
      const session = await navigator.xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
      });

      this.currentSession = session;
      session.addEventListener('end', this.handleSessionEnd);

      await this.renderer.xr.setSession(session);
      this.aimLine.visible = true;
      this.reticleMesh.visible = false;
      this.onSessionStateChange?.(true);

      return { ok: true, message: 'Berhasil masuk ke sesi Mode VR.' };
    } catch (err) {
      const msg =
        err instanceof Error
          ? `Tidak dapat memulai sesi VR: ${err.message}`
          : 'Gagal mengaktifkan sesi immersive-vr.';
      return { ok: false, message: msg };
    }
  }

  public async exitVR() {
    if (this.currentSession) {
      try {
        await this.currentSession.end();
      } catch {}
    }
  }

  private handleSessionEnd = () => {
    if (this.currentSession) {
      this.currentSession.removeEventListener('end', this.handleSessionEnd);
    }
    this.currentSession = null;
    this.aimLine.visible = false;
    this.reticleMesh.visible = false;
    this.onSessionStateChange?.(false);
  };

  public dispose() {
    if (this.currentSession) {
      this.currentSession.removeEventListener('end', this.handleSessionEnd);
      this.currentSession.end().catch(() => {});
      this.currentSession = null;
    }
    this.aimLine.geometry.dispose();
    this.aimLineMat.dispose();
    this.reticleMesh.geometry.dispose();
    this.reticleMat.dispose();
  }
}
