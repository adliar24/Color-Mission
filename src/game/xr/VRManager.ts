import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/examples/jsm/webxr/XRHandModelFactory.js';
import type { VRTeleportPreview } from './VRHandGestures';

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
  public leftGrip: THREE.Group;
  public rightGrip: THREE.Group;
  public leftHand: THREE.Group;
  public rightHand: THREE.Group;

  public aimLine: THREE.Mesh;
  public reticleMesh: THREE.Mesh;
  public currentSession: XRSession | null = null;
  public isHandTrackingLeft = false;
  public isHandTrackingRight = false;

  private onSessionStateChange?: (isActive: boolean) => void;
  private leftHoloGroup: THREE.Object3D;
  private rightHoloGroup: THREE.Object3D;
  private leftCtrlGroup: THREE.Object3D;
  private rightCtrlGroup: THREE.Object3D;
  private aimLineMat: THREE.MeshBasicMaterial;
  private reticleMat: THREE.MeshBasicMaterial;
  private aimRayTarget: THREE.Object3D | null = null;
  private aimScratchScale = new THREE.Vector3(1, 1, 1);
  public rightWeaponAnchor: THREE.Group;
  private weaponAnchorPosScratch = new THREE.Vector3();
  private weaponAnchorQuatScratch = new THREE.Quaternion();
  private rigQuatInvScratch = new THREE.Quaternion();
  private leftVisible = true;
  private rightVisible = true;

  // Indikator joystick virtual saat tangan kiri mengepal di mode Hand Tracking
  private virtualStickGroup: THREE.Group;
  private virtualStickKnob: THREE.Mesh;

  // Kurva Teleport Arc + Ring Target gaya Meta Quest VR Home
  private teleportGroup: THREE.Group;
  private teleportArcLine: THREE.Line;
  private teleportArcPositions: Float32Array;
  private teleportRing: THREE.Mesh;

  private static createHoloHandMaterial(colorHex: string): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.75,
      transparent: true,
      opacity: 0.42,
      roughness: 0.2,
      metalness: 0.1,
      depthWrite: false,
    });
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
        vec3 holoV = normalize(vViewPosition);
        float fresnel = pow(1.0 - abs(dot(normalize(vNormal), holoV)), 1.9);
        gl_FragColor.rgb = mix(gl_FragColor.rgb * 0.7, vec3(0.85, 0.98, 1.0), fresnel * 0.75);
        gl_FragColor.a = clamp(mix(0.16, 0.88, fresnel), 0.12, 0.92);
        #include <dithering_fragment>
        `
      );
    };
    return mat;
  }

  private static applyHoloMaterialToTree(root: THREE.Object3D, mat: THREE.Material) {
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.material = mat;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
      }
    });
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

    const ctrlModelFactory = new XRControllerModelFactory();
    const handModelFactory = new XRHandModelFactory();

    const ctrl0 = this.renderer.xr.getController(0);
    const ctrl1 = this.renderer.xr.getController(1);
    const grip0 = this.renderer.xr.getControllerGrip(0);
    const grip1 = this.renderer.xr.getControllerGrip(1);
    const hand0 = this.renderer.xr.getHand(0);
    const hand1 = this.renderer.xr.getHand(1);

    this.leftController = ctrl0;
    this.rightController = ctrl1;
    this.leftGrip = grip0;
    this.rightGrip = grip1;
    this.leftHand = hand0;
    this.rightHand = hand1;

    this.playerRig.add(ctrl0, ctrl1, grip0, grip1, hand0, hand1);

    // 1. Model 3D Controller Quest Resmi (untuk mode pakai Controller)
    this.leftCtrlGroup = ctrlModelFactory.createControllerModel(grip0);
    this.rightCtrlGroup = ctrlModelFactory.createControllerModel(grip1);
    grip0.add(this.leftCtrlGroup);
    grip1.add(this.rightCtrlGroup);

    // 2. Model Tangan Fleksibel Meta OS 25-Sendi (untuk mode Tangan Kosong / Hand Tracking)
    const leftHoloMat = VRManager.createHoloHandMaterial('#38bdf8');
    const rightHoloMat = VRManager.createHoloHandMaterial('#22d3ee');
    this.leftHoloGroup = handModelFactory.createHandModel(hand0, 'mesh');
    this.rightHoloGroup = handModelFactory.createHandModel(hand1, 'mesh');
    hand0.add(this.leftHoloGroup);
    hand1.add(this.rightHoloGroup);

    // Terapkan shader hologram Meta OS segera setelah mesh skinned tangan selesai dimuat
    const watchHoloLoad = (group: THREE.Object3D, mat: THREE.Material) => {
      group.addEventListener('childadded', () => {
        VRManager.applyHoloMaterialToTree(group, mat);
      });
      VRManager.applyHoloMaterialToTree(group, mat);
    };
    watchHoloLoad(this.leftHoloGroup, leftHoloMat);
    watchHoloLoad(this.rightHoloGroup, rightHoloMat);

    // 3. Cincin Indikator Virtual Thumbstick (muncul saat tangan kiri mengepal untuk bergerak)
    this.virtualStickGroup = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.036, 0.044, 24),
      new THREE.MeshBasicMaterial({
        color: '#22d3ee',
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    this.virtualStickGroup.add(ring);

    this.virtualStickKnob = new THREE.Mesh(
      new THREE.SphereGeometry(0.011, 12, 12),
      new THREE.MeshBasicMaterial({ color: '#ffffff' })
    );
    this.virtualStickGroup.add(this.virtualStickKnob);
    this.virtualStickGroup.position.set(0, 0.08, -0.02);
    this.virtualStickGroup.visible = false;
    this.leftHand.add(this.virtualStickGroup);

    // Kurva Teleport Arc + Ring Target Lantai (Meta Quest VR Home style)
    this.teleportGroup = new THREE.Group();
    this.teleportGroup.visible = false;
    const arcSegments = 24;
    this.teleportArcPositions = new Float32Array((arcSegments + 1) * 3);
    const arcGeo = new THREE.BufferGeometry();
    arcGeo.setAttribute('position', new THREE.BufferAttribute(this.teleportArcPositions, 3));
    this.teleportArcLine = new THREE.Line(
      arcGeo,
      new THREE.LineBasicMaterial({
        color: '#e0f2fe',
        transparent: true,
        opacity: 0.92,
      })
    );
    this.teleportGroup.add(this.teleportArcLine);

    const tpRingGeo = new THREE.RingGeometry(0.24, 0.34, 32);
    tpRingGeo.rotateX(-Math.PI / 2);
    this.teleportRing = new THREE.Mesh(
      tpRingGeo,
      new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      })
    );
    this.teleportGroup.add(this.teleportRing);
    if (this.playerRig.parent) {
      this.playerRig.parent.add(this.teleportGroup);
    }

    // Anchor senjata tangan kanan khusus Hand Tracking: posisi di telapak tangan, arah mengikuti targetRaySpace yang stabil
    this.rightWeaponAnchor = new THREE.Group();
    this.playerRig.add(this.rightWeaponAnchor);

    // 4. Sinar Bidik Meta OS Style
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
    this.reticleMesh = new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 16), this.reticleMat);
    this.reticleMesh.position.set(0, 0, -12);
    this.reticleMesh.visible = false;
    this.rightController.add(this.reticleMesh);

    // Pastikan handedness kiri & kanan selalu akurat sesuai laporan WebXR
    const handleConnect =
      (
        ctrl: THREE.Group,
        otherCtrl: THREE.Group,
        grip: THREE.Group,
        otherGrip: THREE.Group,
        hand: THREE.Group,
        otherHand: THREE.Group
      ) =>
      (event: THREE.Event & { data?: XRInputSource }) => {
        const handedness = event.data?.handedness;
        if (handedness === 'right' && this.rightController !== ctrl) {
          this.rightController = ctrl;
          this.leftController = otherCtrl;
          this.rightGrip = grip;
          this.leftGrip = otherGrip;
          this.rightHand = hand;
          this.leftHand = otherHand;
          this.syncControllerAttachments();
        } else if (handedness === 'left' && this.leftController !== ctrl) {
          this.leftController = ctrl;
          this.rightController = otherCtrl;
          this.leftGrip = grip;
          this.rightGrip = otherGrip;
          this.leftHand = hand;
          this.rightHand = otherHand;
          this.syncControllerAttachments();
        }
        VRManager.applyHoloMaterialToTree(this.leftHoloGroup, leftHoloMat);
        VRManager.applyHoloMaterialToTree(this.rightHoloGroup, rightHoloMat);
      };

    ctrl0.addEventListener('connected', handleConnect(ctrl0, ctrl1, grip0, grip1, hand0, hand1));
    ctrl1.addEventListener('connected', handleConnect(ctrl1, ctrl0, grip1, grip0, hand1, hand0));
    hand0.addEventListener('connected', handleConnect(ctrl0, ctrl1, grip0, grip1, hand0, hand1));
    hand1.addEventListener('connected', handleConnect(ctrl1, ctrl0, grip1, grip0, hand1, hand0));
  }

  private syncControllerAttachments() {
    this.rightController.add(this.aimLine);
    this.rightController.add(this.reticleMesh);
    this.leftHand.add(this.virtualStickGroup);
  }

  public setLeftHandModelVisible(visible: boolean) {
    this.leftVisible = visible;
  }

  public setRightHandModelVisible(visible: boolean) {
    this.rightVisible = visible;
  }

  public getLeftWatchMount(): THREE.Object3D {
    if (this.isHandTrackingLeft) {
      const wrist = (this.leftHand as THREE.Group & { joints?: Record<string, THREE.Object3D> }).joints?.['wrist'];
      if (wrist && (wrist.position.x !== 0 || wrist.position.y !== 0 || wrist.position.z !== 0)) {
        return wrist;
      }
    }
    return this.leftController;
  }

  public attachAimRayTo(target: THREE.Object3D | null) {
    this.aimRayTarget = target;
    const desiredParent = target ?? this.rightController;
    if (this.aimLine.parent !== desiredParent) {
      desiredParent.add(this.aimLine);
      desiredParent.add(this.reticleMesh);
    }
  }

  public getRightWeaponMount(): THREE.Object3D {
    if (this.isHandTrackingRight) {
      return this.rightWeaponAnchor;
    }
    return this.rightController;
  }

  /**
   * Memperbarui visibilitas otomatis antara Controller Quest 3D dan Tangan Hologram Meta OS
   * berdasarkan apakah pengguna sedang memegang controller atau menggunakan tangan kosong.
   */
  public updateInputVisuals(
    xrSession: XRSession | null,
    virtualStick?: { active: boolean; x: number; y: number },
    teleportPreview?: VRTeleportPreview
  ) {
    let leftHasHand = false;
    let rightHasHand = false;
    let leftHasCtrl = false;
    let rightHasCtrl = false;

    if (xrSession) {
      for (const src of xrSession.inputSources) {
        if (src.hand) {
          if (src.handedness === 'left') leftHasHand = true;
          else if (src.handedness === 'right') rightHasHand = true;
        } else if (src.gamepad) {
          if (src.handedness === 'left') leftHasCtrl = true;
          else if (src.handedness === 'right') rightHasCtrl = true;
        }
      }
    }

    this.isHandTrackingLeft = leftHasHand && !leftHasCtrl;
    this.isHandTrackingRight = rightHasHand && !rightHasCtrl;

    this.leftHoloGroup.visible = this.leftVisible && this.isHandTrackingLeft;
    this.leftCtrlGroup.visible = this.leftVisible && !this.isHandTrackingLeft;

    this.rightHoloGroup.visible = this.rightVisible && this.isHandTrackingRight;
    this.rightCtrlGroup.visible = this.rightVisible && !this.isHandTrackingRight;

    // Update rightWeaponAnchor: tempelkan posisi ke telapak tangan kanan, arahkan ke targetRaySpace (stabilized)
    if (this.isHandTrackingRight) {
      const joints = (this.rightHand as THREE.Group & { joints?: Record<string, THREE.Object3D> }).joints;
      const palm = joints?.['middle-finger-metacarpal'] ?? joints?.['index-finger-metacarpal'] ?? joints?.['wrist'];
      if (palm && (palm.position.x !== 0 || palm.position.y !== 0 || palm.position.z !== 0)) {
        palm.getWorldPosition(this.weaponAnchorPosScratch);
        this.playerRig.worldToLocal(this.weaponAnchorPosScratch);
        this.rightWeaponAnchor.position.lerp(this.weaponAnchorPosScratch, 0.48);
      }
      this.rightController.getWorldQuaternion(this.weaponAnchorQuatScratch);
      this.playerRig.getWorldQuaternion(this.rigQuatInvScratch).invert();
      this.weaponAnchorQuatScratch.premultiply(this.rigQuatInvScratch);
      this.rightWeaponAnchor.quaternion.slerp(this.weaponAnchorQuatScratch, 0.35);
    }

    const desiredAimParent = this.aimRayTarget ?? this.rightController;
    if (this.aimLine.parent !== desiredAimParent) {
      desiredAimParent.add(this.aimLine);
      desiredAimParent.add(this.reticleMesh);
    }

    if (virtualStick && virtualStick.active && this.isHandTrackingLeft) {
      const stickMount = this.getLeftWatchMount();
      if (this.virtualStickGroup.parent !== stickMount) {
        stickMount.add(this.virtualStickGroup);
      }
      this.virtualStickGroup.visible = true;
      this.virtualStickKnob.position.set(virtualStick.x * 0.032, 0, virtualStick.y * 0.032);
    } else {
      this.virtualStickGroup.visible = false;
    }

    if (teleportPreview && teleportPreview.active && teleportPreview.valid && this.isHandTrackingLeft) {
      if (!this.teleportGroup.parent && this.playerRig.parent) {
        this.playerRig.parent.add(this.teleportGroup);
      }
      this.teleportGroup.visible = true;
      this.teleportRing.position.copy(teleportPreview.target);

      const g = 9.8;
      const y0 = teleportPreview.origin.y;
      const vy = teleportPreview.velocity.y;
      const totalT = (vy + Math.sqrt(Math.max(0, vy * vy + 2 * g * (y0 - 0.04)))) / g;
      const segs = 24;
      for (let i = 0; i <= segs; i++) {
        const t = (i / segs) * totalT;
        const px = THREE.MathUtils.clamp(teleportPreview.origin.x + teleportPreview.velocity.x * t, -28, 28);
        const py = Math.max(0.04, y0 + vy * t - 0.5 * g * t * t);
        const pz = THREE.MathUtils.clamp(teleportPreview.origin.z + teleportPreview.velocity.z * t, -28, 28);
        this.teleportArcPositions[i * 3] = px;
        this.teleportArcPositions[i * 3 + 1] = py;
        this.teleportArcPositions[i * 3 + 2] = pz;
      }
      this.teleportArcLine.geometry.attributes.position.needsUpdate = true;
    } else {
      this.teleportGroup.visible = false;
    }
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

    let parentScale = 1;
    if (this.aimLine.parent) {
      this.aimLine.parent.getWorldScale(this.aimScratchScale);
      parentScale = Math.max(0.05, this.aimScratchScale.z);
    }
    const invScale = 1 / parentScale;

    if (hitDistance !== null && hitDistance > 0.05) {
      const localDist = hitDistance * invScale;
      this.aimLine.scale.set(1.25 * invScale, 1.25 * invScale, localDist);
      this.aimLineMat.opacity = 0.92;
      this.reticleMesh.visible = true;
      this.reticleMesh.position.set(0, 0, -localDist);
      const dotScale = THREE.MathUtils.clamp(hitDistance * 0.16, 0.55, 2.2) * invScale;
      this.reticleMesh.scale.setScalar(dotScale);
      this.reticleMat.color.set(colorHex);
    } else {
      this.aimLine.scale.set(0.75 * invScale, 0.75 * invScale, 1.5 * invScale);
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
