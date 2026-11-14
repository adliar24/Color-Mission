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
  menuPinch: boolean;
  rightJustPinched: boolean;
  weaponSwitch: boolean;
  pause: boolean;
  rightAimOrigin: THREE.Vector3 | null;
  rightAimDir: THREE.Vector3 | null;
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
const _vRayOrigin = new THREE.Vector3();
const _vRayDir = new THREE.Vector3();
const _vRingTarget = new THREE.Vector3();
const _qRay = new THREE.Quaternion();
const _qWrist = new THREE.Quaternion();

/**
 * Pengenal gestur WebXR Hand Tracking (khusus Tangan Kiri untuk Teleport & Pause):
 * - Tangan Kiri Cubit & Tahan -> Arahkan Ring Teleport bebas 360° di lantai, Lepas -> Teleport!
 * - Sentuh Jam Tangan Kiri dengan Telunjuk Kanan -> Ganti Senjata
 * - Tangan Kiri Menghadap Wajah + Tahan Cubit (0.55s) -> Pause Menu
 * - Tangan Kanan Cubit (telunjuk + ibu jari) -> Menembak / Klik Menu
 */
export class VRHandGestures {
  private wasRightPinching = false;
  private isLeftPinching = false;
  private leftPinchDuration = 0;
  private leftPauseFired = false;
  private leftPinchFacingFace = false;
  private watchTapCooldown = 0;
  private teleportCooldown = 0;
  private hasTeleportTarget = false;
  private leftPinchLockTimer = 0;

  private aimOriginOut = new THREE.Vector3();
  private aimDirOut = new THREE.Vector3();
  private teleportOriginOut = new THREE.Vector3();
  private teleportVelOut = new THREE.Vector3();
  private teleportTargetOut = new THREE.Vector3();

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
    leftController: THREE.Object3D | null = null,
    leftSelectActive = false,
    leftSelectPulse = false,
    rightSelectActive = false,
    rightSelectPulse = false
  ): VRHandGestureResult {
    this.watchTapCooldown = Math.max(0, this.watchTapCooldown - dt);
    this.teleportCooldown = Math.max(0, this.teleportCooldown - dt);

    const moveZ = 0;
    const lookDeltaX = 0;
    let weaponSwitch = false;
    let pause = false;
    let rightAimOrigin: THREE.Vector3 | null = null;
    let rightAimDir: THREE.Vector3 | null = null;
    const teleportPreview: VRTeleportPreview = {
      active: false,
      origin: this.teleportOriginOut,
      velocity: this.teleportVelOut,
      target: this.teleportTargetOut,
      valid: false,
    };
    let teleportCommit: THREE.Vector3 | null = null;

    // === 1. TANGAN KANAN: Gunakan event selectstart/selectend native Meta OS (anti salah baca saat melambai) ===
    const rWrist = VRHandGestures.getJoint(rightHand, 'wrist');
    const rIndex = VRHandGestures.getJoint(rightHand, 'index-finger-tip');
    const rIndexMcp = VRHandGestures.getJoint(rightHand, 'index-finger-metacarpal');

    const rightJustPinched = rightSelectPulse || (rightSelectActive && !this.wasRightPinching);
    this.wasRightPinching = rightSelectActive;

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

    if (camera) {
      camera.getWorldPosition(_vCamPos);
    } else {
      _vCamPos.set(0, 1.6, 0);
    }

    let isFacingFace = false;
    if (lWrist) {
      lWrist.getWorldPosition(_vWrist);
      lWrist.getWorldQuaternion(_qWrist);

      if (camera && lMiddle && lRing && lPinky) {
        lMiddle.getWorldPosition(_vMiddle);
        lRing.getWorldPosition(_vRing);
        lPinky.getWorldPosition(_vPinky);
        const middleDist = _vMiddle.distanceTo(_vWrist);
        const ringDist = _vRing.distanceTo(_vWrist);
        const pinkyDist = _vPinky.distanceTo(_vWrist);
        const fingersOpen = middleDist > 0.12 && ringDist > 0.115 && pinkyDist > 0.1;

        _vToCam.subVectors(_vCamPos, _vWrist).normalize();
        // Di WebXR tangan kiri, sisi telapak mengarah ke -Y lokal wrist
        _vPalmNormal.set(0, -1, 0).applyQuaternion(_qWrist).normalize();
        isFacingFace = fingersOpen ? _vPalmNormal.dot(_vToCam) > 0.68 : false;
      }

      // 2A. Sentuh Jam Tangan Kiri dengan Telunjuk Kanan -> Ganti Senjata (Zero Conflict)
      if (rIndex && this.watchTapCooldown <= 0) {
        rIndex.getWorldPosition(_vIndex);
        if (_vIndex.distanceTo(_vWrist) < 0.095) {
          weaponSwitch = true;
          this.watchTapCooldown = 0.65;
        }
      }
    }

    // 2B. Ring Teleport selalu aktif & responsif mengikuti arah tangan kiri (tanpa bergantung semua jari)
    if (!isFacingFace && (leftController || (lWrist && lIndexMcp))) {
      if (leftController) {
        leftController.getWorldPosition(_vRayOrigin);
        leftController.getWorldQuaternion(_qRay);
        _vRayDir.set(0, 0, -1).applyQuaternion(_qRay).normalize();
      } else if (lIndexMcp) {
        lIndexMcp.getWorldPosition(_vIndexMcp);
        _vRayOrigin.copy(_vIndexMcp);
        _vRayDir.subVectors(_vIndexMcp, _vWrist).normalize();
      }

      const y0 = Math.max(0.25, _vRayOrigin.y);
      const speed = 11.5;
      const vy = _vRayDir.y * speed + 2.4;
      const g = 9.8;
      const disc = Math.max(0, vy * vy + 2 * g * (y0 - 0.04));
      const tHit = (vy + Math.sqrt(disc)) / g;

      let tx = _vRayOrigin.x + _vRayDir.x * speed * tHit;
      let tz = _vRayOrigin.z + _vRayDir.z * speed * tHit;

      const dx = tx - _vCamPos.x;
      const dz = tz - _vCamPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.001 && dist < 0.6) {
        const s = 0.6 / dist;
        tx = _vCamPos.x + dx * s;
        tz = _vCamPos.z + dz * s;
      } else if (dist > 26) {
        const s = 26 / dist;
        tx = _vCamPos.x + dx * s;
        tz = _vCamPos.z + dz * s;
      }

      tx = THREE.MathUtils.clamp(tx, -28, 28);
      tz = THREE.MathUtils.clamp(tz, -28, 28);

      _vRingTarget.set(tx, 0.04, tz);
      let isPinchClosing = leftSelectActive;
      if (lThumb && lIndex) {
        lThumb.getWorldPosition(_vThumb);
        lIndex.getWorldPosition(_vIndex);
        if (_vThumb.distanceTo(_vIndex) < 0.03) {
          isPinchClosing = true;
        }
      }
      if (isPinchClosing) {
        this.leftPinchLockTimer += dt;
      } else {
        this.leftPinchLockTimer = 0;
      }

      if (!this.hasTeleportTarget) {
        this.teleportTargetOut.copy(_vRingTarget);
        this.hasTeleportTarget = true;
      } else if (!isPinchClosing || this.leftPinchLockTimer > 0.35) {
        // Kunci posisi ring sesaat ketika jari mulai menjepit agar gerakan cubit tidak menggeser target
        this.teleportTargetOut.lerp(_vRingTarget, 0.85);
      }

      if (lWrist) {
        this.teleportOriginOut.copy(_vWrist);
      } else {
        this.teleportOriginOut.copy(_vRayOrigin);
      }
      teleportPreview.active = true;
      teleportPreview.valid = true;
    } else {
      this.hasTeleportTarget = false;
    }

    // 2C. Cubit Tangan Kiri (Event selectstart native Meta OS untuk Teleport anti-double, atau tahan menghadap wajah untuk Pause)
    if (leftSelectPulse && !isFacingFace && teleportPreview.active && teleportPreview.valid && this.teleportCooldown <= 0) {
      teleportCommit = this.teleportTargetOut.clone();
      this.teleportCooldown = 0.45;
    }

    if (lWrist && lThumb && lIndex) {
      lThumb.getWorldPosition(_vThumb);
      lIndex.getWorldPosition(_vIndex);
      const leftPinchDist = _vThumb.distanceTo(_vIndex);
      const leftHoldNow = leftSelectActive || leftPinchDist < 0.028;
      if (this.isLeftPinching) {
        if (!leftHoldNow) {
          this.isLeftPinching = false;
          this.leftPinchDuration = 0;
          this.leftPauseFired = false;
          this.leftPinchFacingFace = false;
        } else {
          this.leftPinchDuration += dt;
          if (this.leftPinchFacingFace && this.leftPinchDuration >= 0.55 && !this.leftPauseFired) {
            pause = true;
            this.leftPauseFired = true;
          }
        }
      } else if (leftHoldNow) {
        this.isLeftPinching = true;
        this.leftPinchDuration = 0;
        this.leftPauseFired = false;
        this.leftPinchFacingFace = isFacingFace;
      }
    } else {
      this.isLeftPinching = false;
      this.leftPinchDuration = 0;
      this.leftPauseFired = false;
      this.leftPinchFacingFace = false;
    }

    return {
      moveZ,
      lookDeltaX,
      shoot: rightSelectActive,
      menuPinch: rightSelectPulse,
      rightJustPinched,
      weaponSwitch,
      pause,
      rightAimOrigin,
      rightAimDir,
      teleportPreview,
      teleportCommit,
    };
  }
}

