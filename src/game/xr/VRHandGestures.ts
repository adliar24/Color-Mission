import * as THREE from 'three';
import { GameSettings } from '../types';

export interface VRTeleportPreview {
  active: boolean;
  origin: THREE.Vector3;
  velocity: THREE.Vector3;
  target: THREE.Vector3;
  valid: boolean;
}

export interface VRHandGestureResult {
  moveZ: number;
  lookDeltaX: number;
  shoot: boolean;
  rightJustPinched: boolean;
  weaponSwitch: boolean;
  pause: boolean;
  rightAimOrigin: THREE.Vector3 | null;
  rightAimDir: THREE.Vector3 | null;
  virtualStick: { active: boolean; x: number; y: number };
  teleportPreview: VRTeleportPreview;
  teleportCommit: THREE.Vector3 | null;
}

type XRHandWithJoints = THREE.Group & {
  joints?: Record<string, THREE.Object3D | undefined>;
};

const _vWrist = new THREE.Vector3();
const _vThumb = new THREE.Vector3();
const _vIndex = new THREE.Vector3();
const _vMiddle = new THREE.Vector3();
const _vRing = new THREE.Vector3();
const _vPinky = new THREE.Vector3();
const _vIndexMcp = new THREE.Vector3();
const _vCamPos = new THREE.Vector3();
const _vCamFwd = new THREE.Vector3();
const _vCamRight = new THREE.Vector3();
const _vToCam = new THREE.Vector3();
const _vPalmNormal = new THREE.Vector3();
const _vHandFwd = new THREE.Vector3();
const _vRayOrigin = new THREE.Vector3();
const _vRayDir = new THREE.Vector3();
const _qRay = new THREE.Quaternion();
const _qWrist = new THREE.Quaternion();

/**
 * Pengenal gestur WebXR Hand Tracking Native (Anti-Jitter):
 * - Tangan Kiri Tunjuk Lantai + Cubit: Teleport Arc ke target lantai
 * - Sentuh Jam Tangan Kiri dengan Telunjuk Kanan: Ganti Senjata
 * - Tangan Kiri Menghadap Wajah + Tahan Cubit (0.55s): Pause Menu
 * - Tangan Kanan Cubit (telunjuk + ibu jari): Menembak / Klik Menu
 */
export class VRHandGestures {
  private isRightPinching = false;
  private wasRightPinching = false;
  private isLeftPinching = false;
  private leftPinchDuration = 0;
  private leftPauseFired = false;
  private leftPinchFacingFace = false;
  private watchTapCooldown = 0;

  private aimOriginOut = new THREE.Vector3();
  private aimDirOut = new THREE.Vector3();
  private teleportOriginOut = new THREE.Vector3();
  private teleportVelOut = new THREE.Vector3();
  private teleportTargetOut = new THREE.Vector3();
  private hasSmoothedTeleport = false;
  private smoothTpOrigin = new THREE.Vector3();
  private smoothTpDir = new THREE.Vector3();

  private static getJoint(hand: XRHandWithJoints | null, name: string): THREE.Object3D | null {
    if (!hand || !hand.joints) return null;
    const j = hand.joints[name];
    if (!j || (j.position.x === 0 && j.position.y === 0 && j.position.z === 0)) return null;
    return j;
  }

  public update(
    leftHand: XRHandWithJoints | null,
    rightHand: XRHandWithJoints | null,
    camera: THREE.Camera | null,
    dt: number,
    _settings: GameSettings,
    leftController: THREE.Object3D | null = null
  ): VRHandGestureResult {
    this.watchTapCooldown = Math.max(0, this.watchTapCooldown - dt);

    let moveZ = 0;
    let lookDeltaX = 0;
    let weaponSwitch = false;
    let pause = false;
    let rightAimOrigin: THREE.Vector3 | null = null;
    let rightAimDir: THREE.Vector3 | null = null;
    const virtualStick = { active: false, x: 0, y: 0 };
    const teleportPreview: VRTeleportPreview = {
      active: false,
      origin: this.teleportOriginOut,
      velocity: this.teleportVelOut,
      target: this.teleportTargetOut,
      valid: false,
    };
    let teleportCommit: THREE.Vector3 | null = null;

    // === 1. TANGAN KANAN: Cubit untuk Tembak / Klik Menu + Aim Ray ===
    const rWrist = VRHandGestures.getJoint(rightHand, 'wrist');
    const rThumb = VRHandGestures.getJoint(rightHand, 'thumb-tip');
    const rIndex = VRHandGestures.getJoint(rightHand, 'index-finger-tip');
    const rIndexMcp = VRHandGestures.getJoint(rightHand, 'index-finger-metacarpal');

    if (rThumb && rIndex) {
      rThumb.getWorldPosition(_vThumb);
      rIndex.getWorldPosition(_vIndex);
      const pinchDist = _vThumb.distanceTo(_vIndex);
      if (this.isRightPinching) {
        if (pinchDist > 0.048) this.isRightPinching = false;
      } else {
        if (pinchDist < 0.034) this.isRightPinching = true;
      }
    } else {
      this.isRightPinching = false;
    }

    const rightJustPinched = this.isRightPinching && !this.wasRightPinching;
    this.wasRightPinching = this.isRightPinching;

    if (rWrist && rIndexMcp) {
      rWrist.getWorldPosition(_vWrist);
      rIndexMcp.getWorldPosition(_vIndexMcp);
      this.aimOriginOut.copy(_vIndexMcp);
      this.aimDirOut.subVectors(_vIndexMcp, _vWrist).normalize();
      // Sedikit miring ke bawah agar natural seperti pointer Meta OS
      this.aimDirOut.y -= 0.14;
      this.aimDirOut.normalize();
      rightAimOrigin = this.aimOriginOut;
      rightAimDir = this.aimDirOut;
    }

    // === 2. TANGAN KIRI: Point-to-Teleport, Tap Jam Ganti Senjata, & Pause Meta OS ===
    const lWrist = VRHandGestures.getJoint(leftHand, 'wrist');
    const lThumb = VRHandGestures.getJoint(leftHand, 'thumb-tip');
    const lIndex = VRHandGestures.getJoint(leftHand, 'index-finger-tip');
    const lMiddle = VRHandGestures.getJoint(leftHand, 'middle-finger-tip');
    const lRing = VRHandGestures.getJoint(leftHand, 'ring-finger-tip');
    const lPinky = VRHandGestures.getJoint(leftHand, 'pinky-finger-tip');
    const lIndexMcp = VRHandGestures.getJoint(leftHand, 'index-finger-metacarpal');

    if (lWrist && lThumb && lIndex && lMiddle && lRing && lPinky && lIndexMcp) {
      lWrist.getWorldPosition(_vWrist);
      lWrist.getWorldQuaternion(_qWrist);
      lThumb.getWorldPosition(_vThumb);
      lIndex.getWorldPosition(_vIndex);
      lMiddle.getWorldPosition(_vMiddle);
      lRing.getWorldPosition(_vRing);
      lPinky.getWorldPosition(_vPinky);
      lIndexMcp.getWorldPosition(_vIndexMcp);

      const middleDist = _vMiddle.distanceTo(_vWrist);
      const ringDist = _vRing.distanceTo(_vWrist);
      const pinkyDist = _vPinky.distanceTo(_vWrist);
      const fingersOpen = middleDist > 0.12 && ringDist > 0.115 && pinkyDist > 0.1;

      if (camera) {
        camera.getWorldPosition(_vCamPos);
        _vToCam.subVectors(_vCamPos, _vWrist).normalize();
      } else {
        _vToCam.set(0, 0, 1);
      }

      // Di WebXR tangan kiri, sisi telapak mengarah ke -Y lokal wrist
      _vPalmNormal.set(0, -1, 0).applyQuaternion(_qWrist).normalize();
      const isFacingFace = camera && fingersOpen ? _vPalmNormal.dot(_vToCam) > 0.68 : false;
      const leftPinchDist = _vThumb.distanceTo(_vIndex);

      // 2A. Sentuh Jam Tangan Kiri dengan Telunjuk Kanan -> Ganti Senjata (Zero Conflict)
      if (rIndex && this.watchTapCooldown <= 0) {
        rIndex.getWorldPosition(_vIndex);
        if (_vIndex.distanceTo(_vWrist) < 0.095) {
          weaponSwitch = true;
          this.watchTapCooldown = 0.65;
        }
        // Kembalikan _vIndex ke posisi telunjuk kiri
        lIndex.getWorldPosition(_vIndex);
      }

      // 2B. Point-to-Teleport (Tunjuk lantai dengan tangan kiri + cubit untuk pindah)
      if (!isFacingFace) {
        if (leftController) {
          leftController.getWorldPosition(_vRayOrigin);
          leftController.getWorldQuaternion(_qRay);
          _vRayDir.set(0, 0, -1).applyQuaternion(_qRay).normalize();
        } else {
          _vRayOrigin.copy(_vIndexMcp);
          _vRayDir.subVectors(_vIndexMcp, _vWrist).normalize();
        }

        if (_vRayDir.y < 0.28 && _vRayDir.y > -0.92) {
          // Bekukan target saat jari mulai mendekat untuk mencubit agar ring tidak lompat/glitch
          const freezeAim = leftPinchDist < 0.048 && this.hasSmoothedTeleport;
          if (!this.hasSmoothedTeleport) {
            this.smoothTpOrigin.copy(_vRayOrigin);
            this.smoothTpDir.copy(_vRayDir);
            this.hasSmoothedTeleport = true;
          } else if (!freezeAim) {
            this.smoothTpOrigin.lerp(_vRayOrigin, 0.42);
            this.smoothTpDir.lerp(_vRayDir, 0.42).normalize();
          }

          this.teleportOriginOut.copy(this.smoothTpOrigin);
          this.teleportOriginOut.y = Math.max(0.25, this.teleportOriginOut.y);
          const speed = 9.5;
          this.teleportVelOut.copy(this.smoothTpDir).multiplyScalar(speed);
          this.teleportVelOut.y = Math.max(-2.0, this.teleportVelOut.y + 2.2);

          const g = 9.8;
          const y0 = this.teleportOriginOut.y;
          const vy = this.teleportVelOut.y;
          const disc = Math.max(0, vy * vy + 2 * g * (y0 - 0.04));
          const tHit = (vy + Math.sqrt(disc)) / g;

          this.teleportTargetOut
            .copy(this.teleportOriginOut)
            .addScaledVector(this.teleportVelOut, tHit);
          this.teleportTargetOut.x = THREE.MathUtils.clamp(this.teleportTargetOut.x, -28, 28);
          this.teleportTargetOut.z = THREE.MathUtils.clamp(this.teleportTargetOut.z, -28, 28);
          this.teleportTargetOut.y = 0.04;

          teleportPreview.active = true;
          teleportPreview.valid = true;
        } else {
          this.hasSmoothedTeleport = false;
        }
      } else {
        this.hasSmoothedTeleport = false;
      }

      // 2C. Cubit Tangan Kiri:
      // - Jika menghadap wajah & ditahan 0.55s -> Pause Menu
      // - Jika sedang membidik lantai (teleportPreview.active) -> langsung Teleport!
      if (this.isLeftPinching) {
        if (leftPinchDist > 0.048) {
          this.isLeftPinching = false;
          this.leftPinchDuration = 0;
          this.leftPauseFired = false;
          this.leftPinchFacingFace = false;
        } else {
          this.leftPinchDuration += dt;
          if (isFacingFace) this.leftPinchFacingFace = true;
          if (this.leftPinchFacingFace && this.leftPinchDuration >= 0.55 && !this.leftPauseFired) {
            pause = true;
            this.leftPauseFired = true;
          }
        }
      } else if (leftPinchDist < 0.034) {
        this.isLeftPinching = true;
        this.leftPinchDuration = 0;
        this.leftPauseFired = false;
        this.leftPinchFacingFace = isFacingFace;
        if (!isFacingFace && teleportPreview.active && teleportPreview.valid) {
          teleportCommit = this.teleportTargetOut.clone();
          this.hasSmoothedTeleport = false;
        }
      }
    } else {
      this.isLeftPinching = false;
      this.leftPinchDuration = 0;
      this.leftPauseFired = false;
      this.leftPinchFacingFace = false;
      this.hasSmoothedTeleport = false;
    }

    return {
      moveZ,
      lookDeltaX,
      shoot: this.isRightPinching,
      rightJustPinched,
      weaponSwitch,
      pause,
      rightAimOrigin,
      rightAimDir,
      virtualStick,
      teleportPreview,
      teleportCommit,
    };
  }
}

