import * as THREE from 'three';
import {
  GameSettings,
  GameplayInputCommand,
  HapticEventType,
  PlatformMode,
  WeaponType,
} from '../types';

/**
 * 1. DESKTOP INPUT (Keyboard WASD + Mouse Pointer Lock + Gamepad Controller)
 */
export class DesktopInput {
  private keysPressed = new Set<string>();
  private isMouseDown = false;
  private lookAccumX = 0;
  private lookAccumY = 0;
  private pendingReload = false;
  private pendingDash = false;
  private pendingEmp = false;
  private pendingOverdrive = false;
  private pendingPause = false;
  private pendingMute = false;
  private pendingToggleHint = false;
  private pendingWeapon: WeaponType | null = null;
  public isPointerLocked = false;
  private domElement: HTMLElement | null = null;
  private isActive = false;

  // State Gamepad Desktop
  private prevGamepadButtons: Record<string, boolean> = {};
  private gamepadWeaponIdx = 0;
  private weaponsOrder: WeaponType[] = [
    'laser_rifle',
    'cyber_shotgun',
    'railgun',
    'plasma_smg',
  ];

  public attach(domElement: HTMLElement) {
    this.detach();
    this.domElement = domElement;
    this.isActive = true;

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      window.addEventListener('mousedown', this.onMouseDown);
      window.addEventListener('mouseup', this.onMouseUp);
      window.addEventListener('mousemove', this.onMouseMove);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('pointerlockchange', this.onPointerLockChange);
    }
  }

  public detach() {
    this.isActive = false;
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      window.removeEventListener('mousedown', this.onMouseDown);
      window.removeEventListener('mouseup', this.onMouseUp);
      window.removeEventListener('mousemove', this.onMouseMove);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    }
    this.keysPressed.clear();
    this.isMouseDown = false;
  }

  public releasePointerLock() {
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock?.();
    }
    this.isPointerLocked = false;
    this.isMouseDown = false;
  }

  public requestPointerLock() {
    if (
      typeof document !== 'undefined' &&
      this.domElement &&
      document.pointerLockElement !== this.domElement
    ) {
      try {
        this.domElement.requestPointerLock?.();
      } catch {}
    }
  }

  public consumeMuteRequest(): boolean {
    const val = this.pendingMute;
    this.pendingMute = false;
    return val;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.isActive) return;
    this.keysPressed.add(e.code);

    if (e.code === 'Escape' || e.code === 'KeyP') {
      this.pendingPause = true;
    } else if (e.code === 'KeyM') {
      this.pendingMute = true;
    } else if (e.code === 'KeyR') {
      this.pendingReload = true;
    } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      this.pendingDash = true;
    } else if (e.code === 'KeyQ') {
      this.pendingEmp = true;
    } else if (e.code === 'KeyE') {
      this.pendingOverdrive = true;
    } else if (e.code === 'KeyH') {
      this.pendingToggleHint = true;
    } else if (e.code === 'Digit1') {
      this.pendingWeapon = 'laser_rifle';
    } else if (e.code === 'Digit2') {
      this.pendingWeapon = 'cyber_shotgun';
    } else if (e.code === 'Digit3') {
      this.pendingWeapon = 'railgun';
    } else if (e.code === 'Digit4') {
      this.pendingWeapon = 'plasma_smg';
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keysPressed.delete(e.code);
  };

  private onMouseDown = (e: MouseEvent) => {
    if (!this.isActive) return;
    const target = e.target as HTMLElement | null;
    if (target && target.closest('button, input, select, a, [data-ui="true"]')) {
      return;
    }
    if (e.button === 0) {
      this.isMouseDown = true;
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.isMouseDown = false;
    }
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.isActive) return;
    if (this.isPointerLocked || e.buttons === 1) {
      this.lookAccumX += e.movementX;
      this.lookAccumY += e.movementY;
    }
  };

  private onPointerLockChange = () => {
    this.isPointerLocked =
      !!this.domElement &&
      typeof document !== 'undefined' &&
      document.pointerLockElement === this.domElement;
  };

  private wasGamepadJustPressed(key: string, pressed: boolean | undefined): boolean {
    const now = !!pressed;
    const prev = !!this.prevGamepadButtons[key];
    this.prevGamepadButtons[key] = now;
    return now && !prev;
  }

  public poll(settings: GameSettings, dt: number = 0.016): GameplayInputCommand {
    let moveX = 0;
    let moveZ = 0;
    if (this.keysPressed.has('KeyA') || this.keysPressed.has('ArrowLeft')) moveX -= 1;
    if (this.keysPressed.has('KeyD') || this.keysPressed.has('ArrowRight')) moveX += 1;
    if (this.keysPressed.has('KeyW') || this.keysPressed.has('ArrowUp')) moveZ -= 1;
    if (this.keysPressed.has('KeyS') || this.keysPressed.has('ArrowDown')) moveZ += 1;

    const sens = 0.0038 * settings.mouseSensitivity;
    let lookDeltaX = -this.lookAccumX * sens;
    let lookDeltaY = -this.lookAccumY * sens;
    this.lookAccumX = 0;
    this.lookAccumY = 0;

    let jump = this.keysPressed.has('Space');
    let shoot = this.isMouseDown;
    let reload = this.pendingReload;
    let dash = this.pendingDash;
    let emp = this.pendingEmp;
    let overdrive = this.pendingOverdrive;
    let pause = this.pendingPause;
    let toggleHint = this.pendingToggleHint;
    let weaponSwitch = this.pendingWeapon;

    // Poll Gamepad Desktop (Xbox / PlayStation / Standard Gamepad)
    if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') {
      try {
        const gamepads = navigator.getGamepads();
        for (const gp of gamepads) {
          if (!gp || !gp.connected) continue;

          // Analog Kiri (Gerak)
          const lx = gp.axes[0] || 0;
          const ly = gp.axes[1] || 0;
          if (Math.abs(lx) > 0.16) moveX += lx;
          if (Math.abs(ly) > 0.16) moveZ += ly;

          // D-Pad Gerak Cadangan
          if (gp.buttons[14]?.pressed) moveX -= 1;
          if (gp.buttons[15]?.pressed) moveX += 1;
          if (gp.buttons[12]?.pressed) moveZ -= 1;
          if (gp.buttons[13]?.pressed) moveZ += 1;

          // Analog Kanan (Kamera)
          const rx = gp.axes[2] || 0;
          const ry = gp.axes[3] || 0;
          const gpLookSpeed = 2.6 * settings.mouseSensitivity;
          if (Math.abs(rx) > 0.14) lookDeltaX -= rx * gpLookSpeed * dt;
          if (Math.abs(ry) > 0.14) lookDeltaY -= ry * gpLookSpeed * dt;

          // RT / R2 (buttons[7]) -> Menembak
          if (gp.buttons[7]?.pressed || (gp.buttons[7]?.value ?? 0) > 0.35) {
            shoot = true;
          }
          // A / Cross (buttons[0]) -> Lompat
          if (gp.buttons[0]?.pressed) {
            jump = true;
          }
          // B / Circle (buttons[1]) -> Dash
          if (this.wasGamepadJustPressed(`gp_${gp.index}_b1`, gp.buttons[1]?.pressed)) {
            dash = true;
          }
          // X / Square (buttons[2]) -> Reload
          if (this.wasGamepadJustPressed(`gp_${gp.index}_b2`, gp.buttons[2]?.pressed)) {
            reload = true;
          }
          // Y / Triangle (buttons[3]) -> Ganti Senjata
          if (this.wasGamepadJustPressed(`gp_${gp.index}_b3`, gp.buttons[3]?.pressed)) {
            this.gamepadWeaponIdx = (this.gamepadWeaponIdx + 1) % this.weaponsOrder.length;
            weaponSwitch = this.weaponsOrder[this.gamepadWeaponIdx];
          }
          // LB / L1 (buttons[4]) -> Dash / EMP
          if (this.wasGamepadJustPressed(`gp_${gp.index}_b4`, gp.buttons[4]?.pressed)) {
            dash = true;
          }
          // RB / R1 (buttons[5]) -> EMP
          if (this.wasGamepadJustPressed(`gp_${gp.index}_b5`, gp.buttons[5]?.pressed)) {
            emp = true;
          }
          // LT / L2 (buttons[6]) -> Overdrive
          if (
            this.wasGamepadJustPressed(
              `gp_${gp.index}_b6`,
              gp.buttons[6]?.pressed || (gp.buttons[6]?.value ?? 0) > 0.5
            )
          ) {
            overdrive = true;
          }
          // Back / Select (buttons[8]) -> Petunjuk
          if (this.wasGamepadJustPressed(`gp_${gp.index}_b8`, gp.buttons[8]?.pressed)) {
            toggleHint = true;
          }
          // Start / Options (buttons[9]) -> Pause
          if (this.wasGamepadJustPressed(`gp_${gp.index}_b9`, gp.buttons[9]?.pressed)) {
            pause = true;
          }
          break;
        }
      } catch {}
    }

    moveX = Math.max(-1, Math.min(1, moveX));
    moveZ = Math.max(-1, Math.min(1, moveZ));

    const cmd: GameplayInputCommand = {
      moveX,
      moveZ,
      lookDeltaX,
      lookDeltaY,
      jump,
      shoot,
      reload,
      dash,
      emp,
      overdrive,
      pause,
      toggleHint,
      weaponSwitch,
      vrAimRay: null,
    };

    this.pendingReload = false;
    this.pendingDash = false;
    this.pendingEmp = false;
    this.pendingOverdrive = false;
    this.pendingPause = false;
    this.pendingToggleHint = false;
    this.pendingWeapon = null;

    return cmd;
  }
}

/**
 * 2. MOBILE INPUT (Virtual Joystick + Area Sentuh Kanan + Opsi Gyroscope HP)
 */
export class MobileInput {
  public moveX = 0;
  public moveZ = 0;
  public isShooting = false;
  public isJumping = false;
  private lookAccumX = 0;
  private lookAccumY = 0;
  private gyroAccumX = 0;
  private gyroAccumY = 0;
  private lastGyroAlpha: number | null = null;
  private lastGyroBeta: number | null = null;
  private lastGyroGamma: number | null = null;
  private gyroListenerAttached = false;
  private pendingReload = false;
  private pendingDash = false;
  private pendingEmp = false;
  private pendingOverdrive = false;
  private pendingPause = false;
  private pendingToggleHint = false;
  private pendingWeapon: WeaponType | null = null;

  constructor() {
    this.attachGyroListener();
  }

  public static async requestGyroPermission(): Promise<boolean> {
    if (
      typeof window !== 'undefined' &&
      typeof (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } })
        .DeviceOrientationEvent?.requestPermission === 'function'
    ) {
      try {
        const res = await (
          window as unknown as {
            DeviceOrientationEvent: { requestPermission: () => Promise<string> };
          }
        ).DeviceOrientationEvent.requestPermission();
        return res === 'granted';
      } catch {
        return false;
      }
    }
    return true;
  }

  public async requestGyroPermission(): Promise<boolean> {
    return MobileInput.requestGyroPermission();
  }

  public attachGyroListener() {
    if (this.gyroListenerAttached || typeof window === 'undefined') return;
    window.addEventListener('deviceorientation', this.onDeviceOrientation);
    this.gyroListenerAttached = true;
  }

  public detachGyroListener() {
    if (!this.gyroListenerAttached || typeof window === 'undefined') return;
    window.removeEventListener('deviceorientation', this.onDeviceOrientation);
    this.gyroListenerAttached = false;
  }

  private onDeviceOrientation = (e: DeviceOrientationEvent) => {
    if (e.alpha === null || e.beta === null || e.gamma === null) return;

    if (
      this.lastGyroAlpha === null ||
      this.lastGyroBeta === null ||
      this.lastGyroGamma === null
    ) {
      this.lastGyroAlpha = e.alpha;
      this.lastGyroBeta = e.beta;
      this.lastGyroGamma = e.gamma;
      return;
    }

    // Hitung perubahan sudut orientasi HP tanpa memiringkan roll kamera
    let dAlpha = e.alpha - this.lastGyroAlpha;
    if (dAlpha > 180) dAlpha -= 360;
    if (dAlpha < -180) dAlpha += 360;

    const dBeta = e.beta - this.lastGyroBeta;

    this.lastGyroAlpha = e.alpha;
    this.lastGyroBeta = e.beta;
    this.lastGyroGamma = e.gamma;

    if (Math.abs(dAlpha) < 25 && Math.abs(dBeta) < 25) {
      this.gyroAccumX += dAlpha;
      this.gyroAccumY += dBeta;
    }
  };

  public setJoystick(x: number, y: number) {
    this.moveX = Math.max(-1, Math.min(1, x));
    this.moveZ = Math.max(-1, Math.min(1, y));
  }

  public addLookDelta(dx: number, dy: number) {
    this.lookAccumX += dx;
    this.lookAccumY += dy;
  }

  public setShooting(active: boolean) {
    this.isShooting = active;
  }

  public triggerJump() {
    this.isJumping = true;
  }

  public triggerReload() {
    this.pendingReload = true;
  }

  public triggerDash() {
    this.pendingDash = true;
  }

  public triggerEmp() {
    this.pendingEmp = true;
  }

  public triggerOverdrive() {
    this.pendingOverdrive = true;
  }

  public triggerPause() {
    this.pendingPause = true;
  }

  public triggerToggleHint() {
    this.pendingToggleHint = true;
  }

  public triggerWeaponSwitch(weapon: WeaponType) {
    this.pendingWeapon = weapon;
  }

  public reset() {
    this.moveX = 0;
    this.moveZ = 0;
    this.isShooting = false;
    this.isJumping = false;
    this.lookAccumX = 0;
    this.lookAccumY = 0;
    this.gyroAccumX = 0;
    this.gyroAccumY = 0;
    this.lastGyroAlpha = null;
    this.lastGyroBeta = null;
    this.lastGyroGamma = null;
  }

  public poll(settings: GameSettings): GameplayInputCommand {
    const sens = 0.0052 * settings.touchSensitivity;
    let lookDeltaX = -this.lookAccumX * sens;
    let lookDeltaY = -this.lookAccumY * sens;
    this.lookAccumX = 0;
    this.lookAccumY = 0;

    // Jika Gyro HP diaktifkan di Pengaturan, tambahkan rotasi yaw/pitch dari sensor gyro (tanpa roll/miring!)
    if (settings.mobileGyroEnabled) {
      const gyroSens = 0.012 * settings.touchSensitivity;
      lookDeltaX += this.gyroAccumX * gyroSens;
      lookDeltaY += this.gyroAccumY * gyroSens;
    } else {
      this.lastGyroAlpha = null;
      this.lastGyroBeta = null;
      this.lastGyroGamma = null;
    }
    this.gyroAccumX = 0;
    this.gyroAccumY = 0;

    const cmd: GameplayInputCommand = {
      moveX: this.moveX,
      moveZ: this.moveZ,
      lookDeltaX: lookDeltaX || 0,
      lookDeltaY: lookDeltaY || 0,
      jump: this.isJumping,
      shoot: this.isShooting,
      reload: this.pendingReload,
      dash: this.pendingDash,
      emp: this.pendingEmp,
      overdrive: this.pendingOverdrive,
      pause: this.pendingPause,
      toggleHint: this.pendingToggleHint,
      weaponSwitch: this.pendingWeapon,
      vrAimRay: null,
    };

    this.isJumping = false;
    this.pendingReload = false;
    this.pendingDash = false;
    this.pendingEmp = false;
    this.pendingOverdrive = false;
    this.pendingPause = false;
    this.pendingToggleHint = false;
    this.pendingWeapon = null;

    return cmd;
  }
}

/**
 * 3. VR INPUT (WebXR Meta Quest 3S Controller Tracking, Thumbsticks, Trigger & Grip/Buttons)
 */
export class VRInput {
  private snapTurnCooldown = 0;
  private prevButtonStates: Record<string, boolean> = {};
  private currentWeaponIndex = 0;
  private weaponsOrder: WeaponType[] = ['laser_rifle', 'cyber_shotgun', 'railgun', 'plasma_smg'];

  public poll(
    session: XRSession | null,
    rightController: THREE.Group | null,
    dt: number,
    settings: GameSettings
  ): GameplayInputCommand {
    const empty: GameplayInputCommand = {
      moveX: 0,
      moveZ: 0,
      lookDeltaX: 0,
      lookDeltaY: 0,
      jump: false,
      shoot: false,
      reload: false,
      dash: false,
      emp: false,
      overdrive: false,
      pause: false,
      weaponSwitch: null,
      vrAimRay: null,
      vrTeleportRequest: false,
    };

    if (!session) return empty;

    if (this.snapTurnCooldown > 0) {
      this.snapTurnCooldown = Math.max(0, this.snapTurnCooldown - dt);
    }

    let moveX = 0;
    let moveZ = 0;
    let lookDeltaX = 0;
    let shoot = false;
    let reload = false;
    let dash = false;
    let emp = false;
    let overdrive = false;
    let pause = false;
    let jump = false;
    let vrTeleportRequest = false;
    let weaponSwitch: WeaponType | null = null;

    for (const source of session.inputSources) {
      const gp = source.gamepad;
      if (!gp) continue;

      const handedness = source.handedness;
      const stickX = gp.axes.length >= 4 ? gp.axes[2] : gp.axes[0] || 0;
      const stickY = gp.axes.length >= 4 ? gp.axes[3] : gp.axes[1] || 0;

      if (handedness === 'left') {
        if (Math.abs(stickX) > 0.15) moveX = stickX;
        if (Math.abs(stickY) > 0.15) moveZ = stickY;

        if (this.wasJustPressed('left_btn4', gp.buttons[4]?.pressed)) {
          this.currentWeaponIndex = (this.currentWeaponIndex + 1) % this.weaponsOrder.length;
          weaponSwitch = this.weaponsOrder[this.currentWeaponIndex];
        }
        if (this.wasJustPressed('left_btn5', gp.buttons[5]?.pressed)) {
          emp = true;
        }
        if (this.wasJustPressed('left_grip', gp.buttons[1]?.pressed)) {
          dash = true;
        }
        if (this.wasJustPressed('left_trig', gp.buttons[0]?.pressed)) {
          if (settings.vrMovementMode === 'teleport') {
            vrTeleportRequest = true;
          } else {
            overdrive = true;
          }
        }
      } else if (handedness === 'right' || handedness === 'none') {
        if (gp.buttons[0]?.pressed || (gp.buttons[0]?.value ?? 0) > 0.5) {
          shoot = true;
        }
        if (this.wasJustPressed('right_grip', gp.buttons[1]?.pressed)) {
          reload = true;
        }
        if (this.wasJustPressed('right_btn4', gp.buttons[4]?.pressed)) {
          reload = true;
        }
        if (this.wasJustPressed('right_btn5', gp.buttons[5]?.pressed)) {
          dash = true;
        }

        if (Math.abs(stickX) > 0.6) {
          if (settings.vrTurnMode === 'snap') {
            if (this.snapTurnCooldown <= 0) {
              const snapRad = THREE.MathUtils.degToRad(settings.vrSnapAngle);
              lookDeltaX = stickX > 0 ? -snapRad : snapRad;
              this.snapTurnCooldown = 0.35;
            }
          } else {
            lookDeltaX = -stickX * settings.vrSmoothTurnSpeed * dt;
          }
        }

        if (settings.vrMovementMode === 'teleport' && stickY < -0.75) {
          if (this.wasJustPressed('right_tele', true)) {
            vrTeleportRequest = true;
          }
        } else {
          this.wasJustPressed('right_tele', false);
        }
      }
    }

    let vrAimRay: GameplayInputCommand['vrAimRay'] = null;
    if (rightController) {
      const origin = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      rightController.getWorldPosition(origin);
      rightController.getWorldQuaternion(quat);
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(quat).normalize();
      vrAimRay = {
        origin: [origin.x, origin.y, origin.z],
        direction: [dir.x, dir.y, dir.z],
      };
    }

    return {
      moveX,
      moveZ,
      lookDeltaX,
      lookDeltaY: 0,
      jump,
      shoot,
      reload,
      dash,
      emp,
      overdrive,
      pause,
      weaponSwitch,
      vrAimRay,
      vrTeleportRequest,
    };
  }

  private wasJustPressed(key: string, isPressed: boolean | undefined): boolean {
    const now = !!isPressed;
    const prev = !!this.prevButtonStates[key];
    this.prevButtonStates[key] = now;
    return now && !prev;
  }
}

/**
 * 4. INPUT MANAGER TERPUSAT + HAPTIC / VIBRATION FEEDBACK (DESKTOP GAMEPAD, MOBILE, VR)
 */
export class InputManager {
  public mode: PlatformMode = 'desktop';
  public desktop = new DesktopInput();
  public mobile = new MobileInput();
  public vr = new VRInput();
  private onModeChangeCallback?: (mode: PlatformMode) => void;
  private autoDetectionAttached = false;

  constructor() {
    this.detectInitialMode();
  }

  public detectInitialMode(): PlatformMode {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      const ua = navigator.userAgent || '';

      // 1. Deteksi Headset VR (Meta Quest 3S, OculusBrowser, Pico, Vive, Wolvic)
      if (/OculusBrowser|Quest|MetaQuest|Pacific|Vive|Pico|Wolvic|Firefox Reality/i.test(ua)) {
        this.mode = 'vr';
        return 'vr';
      }

      // 2. Deteksi Smartphone & Tablet (Android, iPhone, iPad, iPadOS, Layar Sentuh Mobile)
      const isMobileUA =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(ua);
      const isIPadOS =
        navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
      const hasCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      if (
        isMobileUA ||
        isIPadOS ||
        (hasCoarsePointer && isTouchDevice && window.innerWidth <= 1280)
      ) {
        this.mode = 'mobile';
        return 'mobile';
      }
    }
    this.mode = 'desktop';
    return 'desktop';
  }

  /**
   * Memantau interaksi dan kapabilitas perangkat secara cerdas & real-time
   * (Layar Sentuh, Mouse/Keyboard/Gamepad, dan Headset WebXR VR)
   */
  public attachAutoDetection(onModeChange: (mode: PlatformMode) => void) {
    this.onModeChangeCallback = onModeChange;
    if (this.autoDetectionAttached || typeof window === 'undefined') return;
    this.autoDetectionAttached = true;

    window.addEventListener('pointerdown', this.handleSmartPointerDown, { passive: true });
    window.addEventListener('touchstart', this.handleSmartTouchStart, { passive: true });
    window.addEventListener('keydown', this.handleSmartKeyDown, { passive: true });
    window.addEventListener('gamepadconnected', this.handleSmartGamepadConnected);

    // Jika berada di browser headset VR yang mendukung immersive-vr, otomatis sesuaikan ke mode VR
    if (typeof navigator !== 'undefined' && 'xr' in navigator && navigator.xr) {
      const ua = navigator.userAgent || '';
      if (/OculusBrowser|Quest|MetaQuest|Pacific|Vive|Pico|Wolvic|VR/i.test(ua)) {
        navigator.xr
          .isSessionSupported('immersive-vr')
          .then((supported) => {
            if (supported) {
              this.setMode('vr');
            }
          })
          .catch(() => {});
      }
    }
  }

  public detachAutoDetection() {
    if (!this.autoDetectionAttached || typeof window === 'undefined') return;
    this.autoDetectionAttached = false;
    window.removeEventListener('pointerdown', this.handleSmartPointerDown);
    window.removeEventListener('touchstart', this.handleSmartTouchStart);
    window.removeEventListener('keydown', this.handleSmartKeyDown);
    window.removeEventListener('gamepadconnected', this.handleSmartGamepadConnected);
  }

  private handleSmartPointerDown = (e: PointerEvent) => {
    if (this.mode === 'vr') return;
    if (e.pointerType === 'touch' && this.mode !== 'mobile') {
      this.setMode('mobile');
    } else if (e.pointerType === 'mouse' && this.mode !== 'desktop') {
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
      const isPhoneUA = /Android|iPhone|iPod|Mobile/i.test(ua);
      if (!isPhoneUA) {
        this.setMode('desktop');
      }
    }
  };

  private handleSmartTouchStart = () => {
    if (this.mode === 'vr') return;
    if (this.mode !== 'mobile') {
      this.setMode('mobile');
    }
  };

  private handleSmartKeyDown = (e: KeyboardEvent) => {
    if (this.mode === 'vr') return;
    if (
      this.mode === 'mobile' &&
      ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft'].includes(e.code)
    ) {
      this.setMode('desktop');
    }
  };

  private handleSmartGamepadConnected = () => {
    if (this.mode === 'vr') return;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const isPhoneUA = /Android|iPhone|iPod|Mobile/i.test(ua);
    if (!isPhoneUA && this.mode !== 'desktop') {
      this.setMode('desktop');
    }
  };

  public setMode(newMode: PlatformMode) {
    if (this.mode === newMode) return;
    if (this.mode === 'desktop') {
      this.desktop.releasePointerLock();
    }
    if (this.mode === 'mobile') {
      this.mobile.reset();
    }
    this.mode = newMode;
    this.onModeChangeCallback?.(newMode);
  }

  public poll(
    settings: GameSettings,
    dt: number,
    xrSession: XRSession | null = null,
    rightController: THREE.Group | null = null
  ): GameplayInputCommand {
    if (this.mode === 'vr' && xrSession) {
      return this.vr.poll(xrSession, rightController, dt, settings);
    }
    if (this.mode === 'mobile') {
      return this.mobile.poll(settings);
    }
    return this.desktop.poll(settings, dt);
  }

  /**
   * Memicu getaran (Vibration / Haptic Feedback) di Desktop (Gamepad), Mobile, dan Controller VR.
   */
  public triggerHaptic(
    type: HapticEventType,
    settings: GameSettings,
    xrSession: XRSession | null = null
  ) {
    if (!settings.hapticsEnabled) return;

    const profiles: Record<
      HapticEventType,
      {
        duration: number;
        weak: number;
        strong: number;
        mobilePattern: number | number[];
      }
    > = {
      shoot: { duration: 28, weak: 0.25, strong: 0.15, mobilePattern: 18 },
      enemyHit: { duration: 45, weak: 0.45, strong: 0.35, mobilePattern: 30 },
      kill: { duration: 95, weak: 0.75, strong: 0.85, mobilePattern: [35, 25, 55] },
      wrong: { duration: 65, weak: 0.4, strong: 0.3, mobilePattern: [25, 20, 25] },
      playerDamage: {
        duration: 170,
        weak: 0.85,
        strong: 1.0,
        mobilePattern: [70, 30, 90],
      },
      dash: { duration: 40, weak: 0.35, strong: 0.2, mobilePattern: 25 },
      emp: { duration: 120, weak: 0.7, strong: 0.7, mobilePattern: [40, 20, 60] },
    };

    const p = profiles[type];

    // 1. VR Controller Haptics (Meta Quest 3S)
    if (xrSession) {
      try {
        for (const source of xrSession.inputSources) {
          if (type === 'shoot' && source.handedness === 'left') continue;
          const gp = source.gamepad as
            | (Gamepad & {
                hapticActuators?: Array<{
                  pulse?: (value: number, duration: number) => Promise<void>;
                }>;
                vibrationActuator?: {
                  playEffect?: (
                    type: string,
                    params: {
                      startDelay: number;
                      duration: number;
                      weakMagnitude: number;
                      strongMagnitude: number;
                    }
                  ) => Promise<void>;
                };
              })
            | null;
          if (!gp) continue;
          const firstActuator = gp.hapticActuators?.[0];
          if (firstActuator && typeof firstActuator.pulse === 'function') {
            firstActuator.pulse(p.strong, p.duration).catch(() => {});
          } else if (typeof gp.vibrationActuator?.playEffect === 'function') {
            gp.vibrationActuator
              .playEffect('dual-rumble', {
                startDelay: 0,
                duration: p.duration,
                weakMagnitude: p.weak,
                strongMagnitude: p.strong,
              })
              .catch(() => {});
          }
        }
      } catch {}
    }

    // 2. Desktop Gamepad Vibration (Dual-Rumble)
    if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') {
      try {
        const gamepads = navigator.getGamepads();
        for (const gp of gamepads) {
          if (!gp || !gp.connected) continue;
          const vib = (
            gp as Gamepad & {
              vibrationActuator?: {
                playEffect?: (
                  type: string,
                  params: {
                    startDelay: number;
                    duration: number;
                    weakMagnitude: number;
                    strongMagnitude: number;
                  }
                ) => Promise<void>;
              };
              hapticActuators?: Array<{
                pulse?: (value: number, duration: number) => Promise<void>;
              }>;
            }
          ).vibrationActuator;

          if (vib?.playEffect) {
            vib
              .playEffect('dual-rumble', {
                startDelay: 0,
                duration: p.duration,
                weakMagnitude: p.weak,
                strongMagnitude: p.strong,
              })
              .catch(() => {});
          } else if (
            (gp as unknown as { hapticActuators?: Array<{ pulse?: (v: number, d: number) => Promise<void> }> })
              .hapticActuators?.[0]?.pulse
          ) {
            (
              gp as unknown as {
                hapticActuators: Array<{ pulse: (v: number, d: number) => Promise<void> }>;
              }
            ).hapticActuators[0]
              .pulse(p.strong, p.duration)
              .catch(() => {});
          }
        }
      } catch {}
    }

    // 3. Mobile Device Vibration API
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(p.mobilePattern);
      } catch {}
    }
  }

  public dispose() {
    this.detachAutoDetection();
    this.desktop.detach();
    this.mobile.detachGyroListener();
    this.mobile.reset();
  }
}
