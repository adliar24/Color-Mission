import * as THREE from 'three';
import { GameSettings } from '../types';

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
const _vToCam = new THREE.Vector3();
const _vPalmNormal = new THREE.Vector3();
const _qWrist = new THREE.Quaternion();
const _qWristInv = new THREE.Quaternion();
const _vLocalThumb = new THREE.Vector3();

/**
 * Pengenal gestur WebXR Hand Tracking bergaya Meta Horizon OS:
 * - Tangan Kiri Kepal + Geser Ibu Jari: maju/mundur & putar kanan/kiri
 * - Tangan Kiri Cubit Cepat (jari lain terbuka): ganti senjata
 * - Tangan Kiri Tahan Cubit menghadap wajah (0.55s): Pause
 * - Tangan Kanan Cubit (telunjuk + ibu jari): menembak (atau klik menu)
 */
export class VRHandGestures {
  private isRightPinching = false;
  private wasRightPinching = false;
  private isLeftPinching = false;
  private leftPinchDuration = 0;
  private leftPauseFired = false;
  private leftPinchFacingFace = false;

  private isLeftFist = false;
  private thumbAnchorLocal = new THREE.Vector3();
  private snapTurnCooldown = 0;

  private aimOriginOut = new THREE.Vector3();
  private aimDirOut = new THREE.Vector3();

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
    settings: GameSettings
  ): VRHandGestureResult {
    this.snapTurnCooldown = Math.max(0, this.snapTurnCooldown - dt);

    let moveZ = 0;
    let lookDeltaX = 0;
    let weaponSwitch = false;
    let pause = false;
    let rightAimOrigin: THREE.Vector3 | null = null;
    let rightAimDir: THREE.Vector3 | null = null;
    const virtualStick = { active: false, x: 0, y: 0 };

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
        if (pinchDist > 0.038) this.isRightPinching = false;
      } else {
        if (pinchDist < 0.025) this.isRightPinching = true;
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

    // === 2. TANGAN KIRI: Kepal + Geser Ibu Jari, Cubit Ganti Senjata, Tahan Cubit Wajah Pause ===
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

      // Deteksi kepal: jari tengah, manis, dan kelingking tertekuk dekat pergelangan/telapak
      const fistNow = middleDist < 0.095 && ringDist < 0.09 && pinkyDist < 0.085;
      const fingersOpen = middleDist > 0.115 && ringDist > 0.11;

      if (fistNow) {
        _qWristInv.copy(_qWrist).invert();
        _vLocalThumb.subVectors(_vThumb, _vIndexMcp).applyQuaternion(_qWristInv);

        if (!this.isLeftFist) {
          this.isLeftFist = true;
          this.thumbAnchorLocal.copy(_vLocalThumb);
        } else {
          const dx = _vLocalThumb.x - this.thumbAnchorLocal.x;
          const dz = _vLocalThumb.z - this.thumbAnchorLocal.z;
          const deadzone = 0.014;
          const maxRange = 0.042;

          // Geser depan/belakang -> moveZ (maju/mundur)
          if (Math.abs(dz) > deadzone) {
            const normZ = THREE.MathUtils.clamp(
              (Math.abs(dz) - deadzone) / (maxRange - deadzone),
              0,
              1
            );
            moveZ = dz < 0 ? -normZ : normZ;
          }

          // Geser kanan/kiri -> putar kamera (Meta OS locomotion)
          if (Math.abs(dx) > deadzone) {
            const normX = THREE.MathUtils.clamp(
              (Math.abs(dx) - deadzone) / (maxRange - deadzone),
              0,
              1
            );
            const signedX = dx > 0 ? normX : -normX;
            if (settings.vrTurnMode === 'snap') {
              if (Math.abs(signedX) > 0.45 && this.snapTurnCooldown <= 0) {
                const snapRad = THREE.MathUtils.degToRad(settings.vrSnapAngle);
                lookDeltaX = signedX > 0 ? -snapRad : snapRad;
                this.snapTurnCooldown = 0.38;
              }
            } else {
              lookDeltaX = -signedX * settings.vrSmoothTurnSpeed * dt;
            }
          }

          virtualStick.active = true;
          virtualStick.x = THREE.MathUtils.clamp(dx / maxRange, -1, 1);
          virtualStick.y = THREE.MathUtils.clamp(dz / maxRange, -1, 1);
        }
      } else {
        this.isLeftFist = false;
      }

      // Cek apakah telapak tangan kiri menghadap wajah/kamera (untuk gestur Pause Meta OS)
      let isFacingFace = false;
      if (camera) {
        camera.getWorldPosition(_vCamPos);
        _vToCam.subVectors(_vCamPos, _vWrist).normalize();
        // Di WebXR tangan kiri, sisi telapak (+Y lokal atau -Y tergantung orientasi)
        _vPalmNormal.set(0, -1, 0).applyQuaternion(_qWrist).normalize();
        isFacingFace = _vPalmNormal.dot(_vToCam) > 0.42;
      }

      // Cubit tangan kiri (hanya jika jari lain terbuka agar tidak bentrok dengan kepal)
      const leftPinchDist = _vThumb.distanceTo(_vIndex);
      if (fingersOpen) {
        if (this.isLeftPinching) {
          if (leftPinchDist > 0.038) {
            // Dilepas sebelum 0.55s dan tidak menghadap wajah -> ganti senjata
            if (!this.leftPauseFired && !this.leftPinchFacingFace && this.leftPinchDuration < 0.45) {
              weaponSwitch = true;
            }
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
        } else if (leftPinchDist < 0.025) {
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
    } else {
      this.isLeftFist = false;
      this.isLeftPinching = false;
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
    };
  }
}

