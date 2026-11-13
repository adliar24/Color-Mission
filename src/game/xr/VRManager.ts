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
  public aimLine: THREE.Line;
  public reticleMesh: THREE.Mesh;
  public currentSession: XRSession | null = null;
  private onSessionStateChange?: (isActive: boolean) => void;
  private leftGripModel: THREE.Group;
  private rightGripModel: THREE.Group;

  private static createHoloHand(isLeft: boolean, colorHex: string): THREE.Group {
    const hand = new THREE.Group();
    const coreMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.22,
    });
    const wireMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      wireframe: true,
      transparent: true,
      opacity: 0.8,
    });

    const addPart = (
      geo: THREE.BufferGeometry,
      x: number,
      y: number,
      z: number,
      rx = 0,
      ry = 0,
      rz = 0
    ) => {
      const solid = new THREE.Mesh(geo, coreMat);
      solid.position.set(x, y, z);
      solid.rotation.set(rx, ry, rz);
      hand.add(solid);

      const wire = new THREE.Mesh(geo, wireMat);
      wire.position.set(x, y, z);
      wire.rotation.set(rx, ry, rz);
      hand.add(wire);
    };

    // Gelang / Wrist Cuff
    addPart(new THREE.CylinderGeometry(0.032, 0.035, 0.055, 10), 0, -0.005, 0.055, Math.PI / 2, 0, 0);

    // Telapak Tangan (Palm)
    addPart(new THREE.BoxGeometry(0.072, 0.024, 0.082), 0, 0, -0.005, 0.12, 0, 0);

    // 4 Jari (sedikit menekuk ke depan)
    const fingerSpecs = [
      { x: -0.024, len: 0.062 },
      { x: -0.008, len: 0.07 },
      { x: 0.008, len: 0.066 },
      { x: 0.024, len: 0.054 },
    ];
    const dirSign = isLeft ? 1 : -1;
    fingerSpecs.forEach((f) => {
      const fx = f.x * dirSign;
      addPart(new THREE.BoxGeometry(0.013, 0.015, f.len), fx, -0.006, -0.048 - f.len * 0.42, -0.28, 0, 0);
    });

    // Ibu Jari (Thumb) di sisi dalam
    addPart(
      new THREE.BoxGeometry(0.015, 0.016, 0.052),
      0.042 * dirSign,
      0.004,
      -0.026,
      -0.18,
      -0.55 * dirSign,
      0
    );

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

    // Controller 0 & 1 pada Three.js WebXRManager
    const ctrl0 = this.renderer.xr.getController(0);
    const ctrl1 = this.renderer.xr.getController(1);
    this.leftController = ctrl0;
    this.rightController = ctrl1;

    this.playerRig.add(ctrl0);
    this.playerRig.add(ctrl1);

    // Sinar bidik (Aim Ray) pada controller kanan
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -28),
    ]);
    const lineMat = new THREE.LineBasicMaterial({
      color: '#00f0ff',
      transparent: true,
      opacity: 0.78,
    });
    this.aimLine = new THREE.Line(lineGeo, lineMat);
    this.aimLine.visible = false;
    this.rightController.add(this.aimLine);

    // Model visual hologram tangan cyber agar posisi tangan terlihat jelas di VR
    this.leftGripModel = VRManager.createHoloHand(true, '#38bdf8');
    this.rightGripModel = VRManager.createHoloHand(false, '#22d3ee');
    this.leftController.add(this.leftGripModel);
    this.rightController.add(this.rightGripModel);

    // Reticle titik bidik di ujung sinar
    this.reticleMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.08, 0.14, 16),
      new THREE.MeshBasicMaterial({ color: '#00f0ff', side: THREE.DoubleSide })
    );
    this.reticleMesh.position.set(0, 0, -12);
    this.reticleMesh.visible = false;
    this.rightController.add(this.reticleMesh);

    // Pastikan handedness kiri & kanan selalu akurat sesuai laporan WebXR
    const handleConnect = (ctrl: THREE.Group, other: THREE.Group) => (event: THREE.Event & { data?: XRInputSource }) => {
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

  public setRightHandModelVisible(visible: boolean) {
    this.rightGripModel.visible = visible;
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
      this.reticleMesh.visible = true;
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
    (this.aimLine.material as THREE.Material).dispose();
    this.reticleMesh.geometry.dispose();
    (this.reticleMesh.material as THREE.Material).dispose();
  }
}

