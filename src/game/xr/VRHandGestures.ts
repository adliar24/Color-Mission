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
  shoulderEntered: boolean;
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
const _vDelta = new THREE.Vector3();
const _vRightHand = new THREE.Vector3();
const _vRayOrigin = new THREE.Vector3();
const _vRayDir = new THREE.Vector3();
const _vRingTarget = new THREE.Vector3();
const _qRay = new THREE.Quaternion();
const _qCam = new THREE.Quaternion();

/**
 * Pengenal gestur WebXR Hand Tracking:
 * - Tangan Kiri Arahkan + Cubit -> Teleport bebas 360° di lantai
 * - Tangan Kiri Kepalkan Semua Jari (~0.45s) -> Pause Menu
 * - Tangan Kanan Angkat ke Bahu Kanan lalu Tarik Maju (RE4 style) -> Ganti Senjata
 * - Tangan Kanan Cubit (telunjuk + ibu jari) -> Menembak / Klik Menu
 */
export class VRHandGestures {
  private wasRightPinching = false;
  private leftFistDuration = 0;
  private leftPauseFired = false;
  private rightInShoulderZone = false;
  private shoulderSwapCooldown = 0;
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
    rightSelectPulse = false,
    rightController: THREE.Object3D | null = null
  ): VRHandGestureResult {
    this.shoulderSwapCooldown = Math.max(0, this.shoulderSwapCooldown - dt);
    this.teleportCooldown = Math.max(0, this.teleportCooldown - dt);

    const moveZ = 0;
    const lookDeltaX = 0;
    let weaponSwitch = false;
    let shoulderEntered = false;
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

    // === 1. TANGAN KANAN: Bidik, Cubit (Meta OS), & Ganti Senjata via Bahu Kanan (RE4 style) ===
    const rWrist = VRHandGestures.getJoint(rightHand, 'wrist');
    const rIndexMcp = VRHandGestures.getJoint(rightHand, 'index-finger-metacarpal');

    if (camera) {
      camera.getWorldPosition(_vCamPos);
      camera.getWorldQuaternion(_qCam);
      _vCamFwd.set(0, 0, -1).applyQuaternion(_qCam);
      _vCamFwd.y = 0;
      if (_vCamFwd.lengthSq() < 0.0001) _vCamFwd.set(0, 0, -1);
      else _vCamFwd.normalize();
      _vCamRight.set(1, 0, 0).applyQuaternion(_qCam);
      _vCamRight.y = 0;
      if (_vCamRight.lengthSq() < 0.0001) _vCamRight.set(1, 0, 0);
      else _vCamRight.normalize();
    } else {
      _vCamPos.set(0, 1.6, 0);
      _vCamFwd.set(0, 0, -1);
      _vCamRight.set(1, 0, 0);
    }

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

    const shoulderJoint = rWrist ?? rIndexMcp ?? rightController;
    if (shoulderJoint) {
      shoulderJoint.getWorldPosition(_vRightHand);
      _vDelta.subVectors(_vRightHand, _vCamPos);
      const rightOffset = _vDelta.dot(_vCamRight);
      const upOffset = _vDelta.y;
      const forwardOffset = _vDelta.dot(_vCamFwd);

      const inShoulderZone =
        rightOffset >= 0.07 &&
        rightOffset <= 0.55 &&
        upOffset >= -0.4 &&
        upOffset <= 0.25 &&
        forwardOffset >= -0.42 &&
        forwardOffset <= 0.23;

      if (!this.rightInShoulderZone) {
        if (inShoulderZone && this.shoulderSwapCooldown <= 0) {
          this.rightInShoulderZone = true;
          shoulderEntered = true;
        }
      } else if (!inShoulderZone && (forwardOffset > 0.24 || rightOffset < 0.05 || upOffset < -0.42)) {
        weaponSwitch = true;
        this.rightInShoulderZone = false;
        this.shoulderSwapCooldown = 0.42;
      }
    }

    // === 2. TANGAN KIRI: Point-to-Teleport & Kepalkan Tangan (~0.45s) untuk Pause ===
    const lWrist = VRHandGestures.getJoint(leftHand, 'wrist');
    const lThumb = VRHandGestures.getJoint(leftHand, 'thumb-tip');
    const lIndex = VRHandGestures.getJoint(leftHand, 'index-finger-tip');
    const lMiddle = VRHandGestures.getJoint(leftHand, 'middle-finger-tip');
    const lRing = VRHandGestures.getJoint(leftHand, 'ring-finger-tip');
    const lPinky = VRHandGestures.getJoint(leftHand, 'pinky-finger-tip');
    const lIndexMcp = VRHandGestures.getJoint(leftHand, 'index-finger-metacarpal');

    let isLeftFist = false;
    if (lWrist) {
      lWrist.getWorldPosition(_vWrist);
      if (lIndex && lMiddle && lRing && lPinky) {
        lIndex.getWorldPosition(_vIndex);
        lMiddle.getWorldPosition(_vMiddle);
        lRing.getWorldPosition(_vRing);
        lPinky.getWorldPosition(_vPinky);
        isLeftFist =
          !leftSelectActive &&
          _vIndex.distanceTo(_vWrist) < 0.105 &&
          _vMiddle.distanceTo(_vWrist) < 0.105 &&
          _vRing.distanceTo(_vWrist) < 0.098 &&
          _vPinky.distanceTo(_vWrist) < 0.092;
      }
    }

    if (isLeftFist) {
      this.leftFistDuration += dt;
      if (this.leftFistDuration >= 0.45 && !this.leftPauseFired) {
        pause = true;
        this.leftPauseFired = true;
      }
    } else {
      this.leftFistDuration = 0;
      this.leftPauseFired = false;
    }

    // 2B. Ring Teleport selalu aktif & responsif mengikuti arah tangan kiri (tanpa bergantung semua jari)
    if (!isLeftFist && (leftController || (lWrist && lIndexMcp))) {
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

    // 2C. Cubit Tangan Kiri (Event selectstart native Meta OS untuk Teleport anti-double)
    if (leftSelectPulse && !isLeftFist && teleportPreview.active && teleportPreview.valid && this.teleportCooldown <= 0) {
      teleportCommit = this.teleportTargetOut.clone();
      this.teleportCooldown = 0.45;
    }

    return {
      moveZ,
      lookDeltaX,
      shoot: rightSelectActive,
      menuPinch: rightSelectPulse,
      rightJustPinched,
      weaponSwitch,
      shoulderEntered,
      pause,
      rightAimOrigin,
      rightAimDir,
      teleportPreview,
      teleportCommit,
    };
  }
}

