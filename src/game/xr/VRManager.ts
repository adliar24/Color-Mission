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
    this.leftController = this.renderer.xr.getController(0);
    this.rightController = this.renderer.xr.getController(1);

    this.playerRig.add(this.leftController);
    this.playerRig.add(this.rightController);

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

    // Model visual gagang controller sederhana agar pemain melihat posisi tangan di VR
    const controllerGripGeo = new THREE.BoxGeometry(0.05, 0.05, 0.16);
    const leftGripMat = new THREE.MeshBasicMaterial({ color: '#38bdf8', wireframe: true });
    const rightGripMat = new THREE.MeshBasicMaterial({ color: '#00f0ff' });

    const leftModel = new THREE.Mesh(controllerGripGeo, leftGripMat);
    const rightModel = new THREE.Mesh(controllerGripGeo, rightGripMat);
    this.leftController.add(leftModel);
    this.rightController.add(rightModel);

    // Reticle titik bidik di ujung sinar
    this.reticleMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.08, 0.14, 16),
      new THREE.MeshBasicMaterial({ color: '#00f0ff', side: THREE.DoubleSide })
    );
    this.reticleMesh.position.set(0, 0, -12);
    this.reticleMesh.visible = false;
    this.rightController.add(this.reticleMesh);
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

