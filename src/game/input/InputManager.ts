import * as THREE from 'three';
import type { VRHandGestureResult } from '../xr/VRHandGestures';

const _scratchVROrigin = new THREE.Vector3();
const _scratchVRQuat = new THREE.Quaternion();
const _scratchVRDir = new THREE.Vector3();

function isValidGamepad(gp: Gamepad | null | undefined): gp is Gamepad {
  return Boolean(
    gp &&
      gp.connected &&
      ((gp.buttons?.length ?? 0) >= 4 || (gp.axes?.length ?? 0) >= 2)
  );
}

function isGamepadBtnActive(
  btn: GamepadButton | undefined,
  threshold: number = 0.35
): boolean {
  return Boolean(
    btn && (btn.pressed || (typeof btn.value === 'number' && btn.value >= threshold))
  );
}

function readGamepadDpad(gp: Gamepad): {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
} {
  let up = isGamepadBtnActive(gp.buttons[12], 0.5);
  let down = isGamepadBtnActive(gp.buttons[13], 0.5);
  let left = isGamepadBtnActive(gp.buttons[14], 0.5);
  let right = isGamepadBtnActive(gp.buttons[15], 0.5);

  // Dukungan D-Pad HAT Switch untuk gamepad USB / DirectInput non-standard (axes[9])
  if (gp.mapping !== 'standard' && gp.axes.length >= 10) {
    const hat = gp.axes[9];
    if (typeof hat === 'number' && Math.abs(hat) <= 1.05) {
      if (hat <= -0.6 || hat >= 0.85) up = true;
      if (hat >= -0.85 && hat <= -0.05) right = true;
      if (hat >= -0.25 && hat <= 0.55) down = true;
      if (hat >= 0.35 && hat <= 1.05) left = true;
    }
  }

  return { up, down, left, right };
}

function readGamepadRightStick(gp: Gamepad): { rx: number; ry: number } {
  if (gp.mapping === 'standard' || gp.axes.length < 6) {
    return {
      rx: gp.axes[2] || 0,
      ry: gp.axes[3] || 0,
    };
  }
  // Pada beberapa controller DirectInput (mis. DualShock/USB generic), axes[3] & axes[4] adalah trigger L2/R2 (-1 saat dilepas)
  const a3 = gp.axes[3] || 0;
  const a4 = gp.axes[4] || 0;
  const looksLikeTriggerAxes = a3 < -0.85 && a4 < -0.85;
  return {
    rx: gp.axes[2] || 0,
    ry: looksLikeTriggerAxes ? gp.axes[5] || 0 : a3,
  };
}
import {
  GameSettings,
  GameplayInputCommand,
  HapticEventType,
  PlatformMode,
  WeaponType,
  resolveSpeedSettings,
} from '../types';

/**
 * 1. DESKTOP INPUT (Keyboard WASD + Mouse Pointer Lock + Gamepad Controller)
 */
export class DesktopInput {
  private keysPressed = new Set<string>();
  private isMouseDown = false;
  private lookAccumX = 0;
  private lookAccumY = 0;
  private smoothLookX = 0;
  private smoothLookY = 0;
  private pendingReload = false;
  private pendingDash = false;
  private pendingEmp = false;
  private pendingOverdrive = false;
  private pendingAbility = false;
  private pendingPause = false;
  private pendingMute = false;
  private pendingToggleHint = false;
  private pendingWeapon: WeaponType | null = null;
  public isPointerLocked = false;
  private domElement: HTMLElement | null = null;
  private isActive = false;
  private suppressNextUnlockPause = false;
  private unadjustedUnsupported = false;
  private lastMouseClientX: number | null = null;
  private lastMouseClientY: number | null = null;

  // State Gamepad Desktop
  private prevGamepadButtons: Record<string, boolean> = {};
  private gamepadWeaponIdx = 0;
  private weaponsOrder: WeaponType[] = [
    'laser_rifle',
    'cyber_shotgun',
    'railgun',
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
      window.addEventListener('blur', this.onWindowBlur);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('pointerlockchange', this.onPointerLockChange);
      document.addEventListener('pointerlockerror', this.onPointerLockError);
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
      window.removeEventListener('blur', this.onWindowBlur);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('pointerlockchange', this.onPointerLockChange);
      document.removeEventListener('pointerlockerror', this.onPointerLockError);
    }
    this.reset();
  }

  public reset() {
    this.keysPressed.clear();
    this.isMouseDown = false;
    this.lookAccumX = 0;
    this.lookAccumY = 0;
    this.smoothLookX = 0;
    this.smoothLookY = 0;
    this.pendingReload = false;
    this.pendingDash = false;
    this.pendingEmp = false;
    this.pendingOverdrive = false;
    this.pendingAbility = false;
    this.pendingPause = false;
    this.pendingMute = false;
    this.pendingToggleHint = false;
    this.pendingWeapon = null;
    this.lastMouseClientX = null;
    this.lastMouseClientY = null;
  }

  private onWindowBlur = () => {
    this.reset();
  };

  public releasePointerLock() {
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      this.suppressNextUnlockPause = true;
      document.exitPointerLock?.();
    }
    this.isPointerLocked = false;
    this.isMouseDown = false;
    this.lastMouseClientX = null;
    this.lastMouseClientY = null;
  }

  public requestPointerLock() {
    if (
      typeof document !== 'undefined' &&
      this.domElement &&
      document.pointerLockElement !== this.domElement
    ) {
      this.suppressNextUnlockPause = false;
      try {
        if (!this.unadjustedUnsupported) {
          const req = (
            this.domElement as HTMLElement & {
              requestPointerLock?: (options?: {
                unadjustedMovement?: boolean;
              }) => Promise<void> | void;
            }
          ).requestPointerLock?.({ unadjustedMovement: true });
          if (req && typeof (req as Promise<void>).catch === 'function') {
            (req as Promise<void>).catch(() => {
              this.unadjustedUnsupported = true;
              try {
                this.domElement?.requestPointerLock?.();
              } catch {}
            });
          }
        } else {
          this.domElement.requestPointerLock?.();
        }
      } catch {
        this.unadjustedUnsupported = true;
        try {
          this.domElement.requestPointerLock?.();
        } catch {}
      }
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
    } else if (e.code === 'KeyH') {
      this.pendingToggleHint = true;
    } else if (e.code === 'KeyE' || e.code === 'KeyQ' || e.code === 'KeyF') {
      this.pendingAbility = true;
    } else if (e.code === 'Digit1') {
      this.pendingWeapon = 'laser_rifle';
    } else if (e.code === 'Digit2') {
      this.pendingWeapon = 'cyber_shotgun';
    } else if (e.code === 'Digit3') {
      this.pendingWeapon = 'railgun';
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
      this.lastMouseClientX = e.clientX;
      this.lastMouseClientY = e.clientY;
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.isMouseDown = false;
      this.lastMouseClientX = null;
      this.lastMouseClientY = null;
    }
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.isActive) return;
    if (this.isPointerLocked) {
      const dx = Math.max(-160, Math.min(160, e.movementX));
      const dy = Math.max(-160, Math.min(160, e.movementY));
      this.lookAccumX += dx;
      this.lookAccumY += dy;
      return;
    }

    if (e.buttons === 1) {
      let dx = e.movementX;
      let dy = e.movementY;
      if (dx === 0 && dy === 0 && this.lastMouseClientX !== null && this.lastMouseClientY !== null) {
        dx = e.clientX - this.lastMouseClientX;
        dy = e.clientY - this.lastMouseClientY;
      }
      this.lastMouseClientX = e.clientX;
      this.lastMouseClientY = e.clientY;
      this.lookAccumX += dx;
      this.lookAccumY += dy;
    }
  };

  private onPointerLockError = () => {
    if (!this.unadjustedUnsupported && this.domElement) {
      this.unadjustedUnsupported = true;
      try {
        this.domElement.requestPointerLock?.();
      } catch {}
    }
  };

  private onPointerLockChange = () => {
    const wasLocked = this.isPointerLocked;
    const nowLocked =
      !!this.domElement &&
      typeof document !== 'undefined' &&
      document.pointerLockElement === this.domElement;
    this.isPointerLocked = nowLocked;

    if (wasLocked && !nowLocked) {
      if (this.suppressNextUnlockPause) {
        this.suppressNextUnlockPause = false;
      } else {
        this.pendingPause = true;
      }
    }
  };

  private wasGamepadJustPressed(key: string, pressed: boolean | undefined): boolean {
    const now = !!pressed;
    const prev = !!this.prevGamepadButtons[key];
    this.prevGamepadButtons[key] = now;
    return now && !prev;
  }

  public pollGamepadOnly(settings: GameSettings, dt: number = 0.016): GameplayInputCommand | null {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return null;
    }
    try {
      const gamepads = navigator.getGamepads();
      let foundAny = false;
      let moveX = 0;
      let moveZ = 0;
      let lookDeltaX = 0;
      let lookDeltaY = 0;
      let jump = false;
      let shoot = false;
      const reload = false;
      const dash = false;
      const emp = false;
      const overdrive = false;
      let useAbility = false;
      let pause = false;
      let toggleHint = false;
      let weaponSwitch: WeaponType | null = null;
      let weaponCycle = false;

      const { cameraMult } = resolveSpeedSettings(settings);
      const gpLookSpeed = 2.6 * settings.mouseSensitivity * cameraMult;

      // Iterasi SEMUA gamepad yang terhubung agar slot 0 yang berupa perangkat virtual/HID tidak memblokir gamepad asli di slot 1+
      for (const gp of gamepads) {
        if (!isValidGamepad(gp)) continue;
        foundAny = true;

        // Analog Kiri (Gerak)
        const lx = gp.axes[0] || 0;
        const ly = gp.axes[1] || 0;
        if (Math.abs(lx) > 0.16) moveX += lx;
        if (Math.abs(ly) > 0.16) moveZ += ly;

        // D-Pad Gerak Cadangan (Standard + DirectInput HAT)
        const dpad = readGamepadDpad(gp);
        if (dpad.left) moveX -= 1;
        if (dpad.right) moveX += 1;
        if (dpad.up) moveZ -= 1;
        if (dpad.down) moveZ += 1;

        // Analog Kanan (Kamera)
        const { rx, ry } = readGamepadRightStick(gp);
        if (Math.abs(rx) > 0.14) lookDeltaX -= rx * gpLookSpeed * dt;
        if (Math.abs(ry) > 0.14) lookDeltaY -= ry * gpLookSpeed * dt;

        // RT / R2 (buttons[7]) atau Trigger Axis non-standard -> Menembak
        const nonStdTriggerShoot =
          gp.mapping !== 'standard' && gp.axes.length >= 5 && (gp.axes[4] ?? -1) > 0.25;
        if (isGamepadBtnActive(gp.buttons[7], 0.25) || nonStdTriggerShoot) {
          shoot = true;
        }
        // A / Cross (buttons[0]) -> Lompat
        if (isGamepadBtnActive(gp.buttons[0], 0.35)) {
          jump = true;
        }
        // Y / Triangle (buttons[3]) -> Ganti Senjata
        if (this.wasGamepadJustPressed(`gp_${gp.index}_b3`, isGamepadBtnActive(gp.buttons[3], 0.35))) {
          this.gamepadWeaponIdx = (this.gamepadWeaponIdx + 1) % this.weaponsOrder.length;
          weaponSwitch = this.weaponsOrder[this.gamepadWeaponIdx];
          weaponCycle = true;
        }
        // LB / L1 (buttons[4]) atau RB / R1 (buttons[5]) -> Ability Karakter
        if (
          this.wasGamepadJustPressed(`gp_${gp.index}_b4`, isGamepadBtnActive(gp.buttons[4], 0.35)) ||
          this.wasGamepadJustPressed(`gp_${gp.index}_b5`, isGamepadBtnActive(gp.buttons[5], 0.35))
        ) {
          useAbility = true;
        }
        // Back / Select (buttons[8]) -> Petunjuk
        if (this.wasGamepadJustPressed(`gp_${gp.index}_b8`, isGamepadBtnActive(gp.buttons[8], 0.35))) {
          toggleHint = true;
        }
        // Start / Options (buttons[9]) -> Pause
        if (this.wasGamepadJustPressed(`gp_${gp.index}_b9`, isGamepadBtnActive(gp.buttons[9], 0.35))) {
          pause = true;
        }
      }

      if (!foundAny) return null;

      return {
        moveX: Math.max(-1, Math.min(1, moveX)),
        moveZ: Math.max(-1, Math.min(1, moveZ)),
        lookDeltaX,
        lookDeltaY,
        jump,
        shoot,
        reload,
        dash,
        emp,
        overdrive,
        useAbility,
        pause,
        toggleHint,
        weaponSwitch,
        weaponCycle,
      };
    } catch {}
    return null;
  }

  public poll(settings: GameSettings, dt: number = 0.016): GameplayInputCommand {
    let moveX = 0;
    let moveZ = 0;
    const isFullKeyboard = settings.keyboardCameraMode !== false;

    if (this.keysPressed.has('KeyA') || (!isFullKeyboard && this.keysPressed.has('ArrowLeft'))) {
      moveX -= 1;
    }
    if (this.keysPressed.has('KeyD') || (!isFullKeyboard && this.keysPressed.has('ArrowRight'))) {
      moveX += 1;
    }
    if (this.keysPressed.has('KeyW') || (!isFullKeyboard && this.keysPressed.has('ArrowUp'))) {
      moveZ -= 1;
    }
    if (this.keysPressed.has('KeyS') || (!isFullKeyboard && this.keysPressed.has('ArrowDown'))) {
      moveZ += 1;
    }

    const { cameraMult } = resolveSpeedSettings(settings);
    const sens = 0.0055 * settings.mouseSensitivity * cameraMult;
    const rawMouseX = -this.lookAccumX * sens;
    const rawMouseY = -this.lookAccumY * sens;
    this.lookAccumX = 0;
    this.lookAccumY = 0;

    // Sub-frame exponential smoothing untuk meredam micro-stutter polling mouse tanpa terasa delay
    const alpha = 1 - Math.exp(-42 * Math.max(dt, 0.001));
    this.smoothLookX = this.smoothLookX * (1 - alpha) + rawMouseX;
    this.smoothLookY = this.smoothLookY * (1 - alpha) + rawMouseY;
    let lookDeltaX = this.smoothLookX * alpha;
    let lookDeltaY = this.smoothLookY * alpha;
    this.smoothLookX -= lookDeltaX;
    this.smoothLookY -= lookDeltaY;
    if (Math.abs(this.smoothLookX) < 1e-6) this.smoothLookX = 0;
    if (Math.abs(this.smoothLookY) < 1e-6) this.smoothLookY = 0;

    if (isFullKeyboard) {
      const kbdLookSpeed = 2.3 * settings.mouseSensitivity * cameraMult;
      if (this.keysPressed.has('ArrowLeft')) lookDeltaX += kbdLookSpeed * dt;
      if (this.keysPressed.has('ArrowRight')) lookDeltaX -= kbdLookSpeed * dt;
      if (this.keysPressed.has('ArrowUp')) lookDeltaY += kbdLookSpeed * dt;
      if (this.keysPressed.has('ArrowDown')) lookDeltaY -= kbdLookSpeed * dt;
    }

    let jump = this.keysPressed.has('Space');
    let shoot =
      this.isMouseDown ||
      (isFullKeyboard &&
        (this.keysPressed.has('Enter') || this.keysPressed.has('NumpadEnter')));
    let reload = this.pendingReload;
    let dash = this.pendingDash;
    let emp = this.pendingEmp;
    let overdrive = this.pendingOverdrive;
    let useAbility = this.pendingAbility;
    let pause = this.pendingPause;
    let toggleHint = this.pendingToggleHint;
    let weaponSwitch = this.pendingWeapon;
    let weaponCycle = false;

    // Poll Gamepad (Xbox / PlayStation / Standard Gamepad)
    const gpCmd = this.pollGamepadOnly(settings, dt);
    if (gpCmd) {
      moveX += gpCmd.moveX;
      moveZ += gpCmd.moveZ;
      lookDeltaX += gpCmd.lookDeltaX;
      lookDeltaY += gpCmd.lookDeltaY;
      if (gpCmd.jump) jump = true;
      if (gpCmd.shoot) shoot = true;
      if (gpCmd.reload) reload = true;
      if (gpCmd.dash) dash = true;
      if (gpCmd.emp) emp = true;
      if (gpCmd.overdrive) overdrive = true;
      if (gpCmd.useAbility) useAbility = true;
      if (gpCmd.toggleHint) toggleHint = true;
      if (gpCmd.pause) pause = true;
      if (gpCmd.weaponSwitch) weaponSwitch = gpCmd.weaponSwitch;
      if (gpCmd.weaponCycle) weaponCycle = true;
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
      useAbility,
      pause,
      toggleHint,
      weaponSwitch,
      weaponCycle,
      vrAimRay: null,
    };

    this.pendingReload = false;
    this.pendingDash = false;
    this.pendingEmp = false;
    this.pendingOverdrive = false;
    this.pendingAbility = false;
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
  private smoothLookX = 0;
  private smoothLookY = 0;
  private gyroAccumX = 0;
  private gyroAccumY = 0;
  private filteredYawRate = 0;
  private filteredPitchRate = 0;
  private currentTiltBeta = 60; // Derajat kemiringan HP saat digenggam (default 60°)
  private currentTiltGamma = 0;
  private lastMotionTimestamp = 0;
  private hasDeviceMotionRate = false;
  private lastGyroAlpha: number | null = null;
  private lastGyroBeta: number | null = null;
  private lastGyroGamma: number | null = null;
  private gyroListenerAttached = false;
  private pendingReload = false;
  private pendingDash = false;
  private pendingEmp = false;
  private pendingOverdrive = false;
  private pendingAbility = false;
  private pendingPause = false;
  private pendingToggleHint = false;
  private pendingWeapon: WeaponType | null = null;

  constructor() {
    this.attachGyroListener();
  }

  public static async requestGyroPermission(): Promise<boolean> {
    let granted = true;
    if (typeof window !== 'undefined') {
      const win = window as unknown as {
        DeviceMotionEvent?: { requestPermission?: () => Promise<string> };
        DeviceOrientationEvent?: { requestPermission?: () => Promise<string> };
      };
      if (typeof win.DeviceMotionEvent?.requestPermission === 'function') {
        try {
          const res = await win.DeviceMotionEvent.requestPermission();
          granted = granted && res === 'granted';
        } catch {
          granted = false;
        }
      }
      if (typeof win.DeviceOrientationEvent?.requestPermission === 'function') {
        try {
          const res = await win.DeviceOrientationEvent.requestPermission();
          granted = granted && res === 'granted';
        } catch {
          granted = false;
        }
      }
    }
    return granted;
  }

  public async requestGyroPermission(): Promise<boolean> {
    return MobileInput.requestGyroPermission();
  }

  public attachGyroListener() {
    if (this.gyroListenerAttached || typeof window === 'undefined') return;
    window.addEventListener('devicemotion', this.onDeviceMotion);
    window.addEventListener('deviceorientation', this.onDeviceOrientation);
    this.gyroListenerAttached = true;
  }

  public detachGyroListener() {
    if (!this.gyroListenerAttached || typeof window === 'undefined') return;
    window.removeEventListener('devicemotion', this.onDeviceMotion);
    window.removeEventListener('deviceorientation', this.onDeviceOrientation);
    this.gyroListenerAttached = false;
  }

  private forcedScreenAngle: number | null = null;

  public setScreenOrientationAngle(angle: number | null) {
    this.forcedScreenAngle = angle;
  }

  private getScreenOrientationAngle(): number {
    if (this.forcedScreenAngle !== null) return this.forcedScreenAngle;
    if (typeof window === 'undefined') return 90;
    const scrAngle = window.screen?.orientation?.angle;
    if (typeof scrAngle === 'number') return scrAngle;
    const legacyAngle = (window as unknown as { orientation?: number }).orientation;
    if (typeof legacyAngle === 'number') return legacyAngle;
    return window.innerWidth > window.innerHeight ? 90 : 0;
  }

  /**
   * Gyroscope Utama berbasis kecepatan sudut hardware (DeviceMotionEvent.rotationRate).
   * Bebas gimbal-lock, bebas drift kompas, responsif instan tanpa lag/stuck,
   * dan otomatis menyesuaikan orientasi layar (Landscape 90/270 & Portrait).
   */
  public onDeviceMotion = (e: DeviceMotionEvent) => {
    const rate = e.rotationRate;
    if (!rate || (rate.alpha === null && rate.beta === null && rate.gamma === null)) return;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const dt =
      this.lastMotionTimestamp > 0
        ? Math.min(0.05, Math.max(0.002, (now - this.lastMotionTimestamp) / 1000))
        : typeof e.interval === 'number' && e.interval > 0
          ? e.interval > 1
            ? e.interval / 1000
            : e.interval
          : 0.016;
    this.lastMotionTimestamp = now;
    this.hasDeviceMotionRate = true;

    // rate.beta = sumbu X pendek HP (deg/s), rate.gamma = sumbu Y panjang HP (deg/s), rate.alpha = sumbu Z layar (deg/s)
    const rBeta = rate.beta ?? 0;
    const rGamma = rate.gamma ?? 0;
    const rAlpha = rate.alpha ?? 0;

    const rawAngle = ((this.getScreenOrientationAngle() % 360) + 360) % 360;
    const isPortraitViewport =
      this.forcedScreenAngle === null && typeof window !== 'undefined'
        ? window.innerHeight >= window.innerWidth
        : rawAngle === 0 || rawAngle === 180;
    const isPortrait =
      this.forcedScreenAngle !== null
        ? rawAngle === 0 || rawAngle === 180
        : isPortraitViewport;

    let rawPitch = 0;
    let rawYaw = 0;

    if (isPortrait) {
      // Mode Portrait (0° / 180°): sumbu dalam layar (beta & gamma) berputar 90° dibanding Landscape
      // - Pitch (Atas - Bawah) memakai rGamma
      // - Yaw (Kiri - Kanan) memakai rAlpha & rBeta
      const isUpsideDown = rawAngle === 180;
      rawPitch = isUpsideDown ? -rGamma : rGamma;
      rawYaw = isUpsideDown
        ? rAlpha * 0.75 - rBeta * 0.75
        : rAlpha * 0.75 + rBeta * 0.75;
    } else {
      // Mode Landscape (90° / 270°) — kalibrasi teruji
      const isInverted = rawAngle === 270;
      rawPitch = isInverted ? rBeta : -rBeta;
      rawYaw = isInverted
        ? -(rAlpha * 0.75 + rGamma * 0.75)
        : rAlpha * 0.75 + rGamma * 0.75;
    }

    // Deadzone mikro (0.04 deg/s) untuk menyaring getaran sensor tanpa mengurangi responsivitas gerakan halus
    if (Math.abs(rawPitch) < 0.04) rawPitch = 0;
    if (Math.abs(rawYaw) < 0.04) rawYaw = 0;

    // Integrasi langsung responsif 0-latency (instan tanpa delay atau rasa tersangkut/ketahan)
    this.gyroAccumX += THREE.MathUtils.clamp(rawYaw * dt, -16, 16);
    this.gyroAccumY += THREE.MathUtils.clamp(rawPitch * dt, -16, 16);
  };

  /**
   * Fallback DeviceOrientationEvent jika browser tidak menyediakan DeviceMotionEvent.rotationRate.
   */
  public onDeviceOrientation = (e: DeviceOrientationEvent) => {
    if (e.beta !== null && typeof e.beta === 'number') {
      this.currentTiltBeta = e.beta;
    }
    if (e.gamma !== null && typeof e.gamma === 'number') {
      this.currentTiltGamma = e.gamma;
    }

    if (this.hasDeviceMotionRate) return;
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

    let dAlpha = e.alpha - this.lastGyroAlpha;
    if (dAlpha > 180) dAlpha -= 360;
    if (dAlpha < -180) dAlpha += 360;

    const dBeta = e.beta - this.lastGyroBeta;
    const dGamma = e.gamma - this.lastGyroGamma;

    this.lastGyroAlpha = e.alpha;
    this.lastGyroBeta = e.beta;
    this.lastGyroGamma = e.gamma;

    // Abaikan lonjakan gimbal-lock (> 15 derajat dalam 1 sampel)
    if (Math.abs(dAlpha) > 15 || Math.abs(dBeta) > 15 || Math.abs(dGamma) > 15) {
      return;
    }

    const rawAngle = ((this.getScreenOrientationAngle() % 360) + 360) % 360;
    const isPortraitViewport =
      this.forcedScreenAngle === null && typeof window !== 'undefined'
        ? window.innerHeight >= window.innerWidth
        : rawAngle === 0 || rawAngle === 180;
    const isPortrait =
      this.forcedScreenAngle !== null
        ? rawAngle === 0 || rawAngle === 180
        : isPortraitViewport;

    let rawPitch = 0;
    let rawYaw = 0;

    if (isPortrait) {
      const isUpsideDown = rawAngle === 180;
      rawPitch = isUpsideDown ? -dGamma : dGamma;
      rawYaw = isUpsideDown
        ? dAlpha * 0.75 - dBeta * 0.75
        : dAlpha * 0.75 + dBeta * 0.75;
    } else {
      const isInverted = rawAngle === 270;
      rawPitch = isInverted ? dBeta : -dBeta;
      rawYaw = isInverted
        ? -(dAlpha * 0.75 + dGamma * 0.75)
        : dAlpha * 0.75 + dGamma * 0.75;
    }

    if (Math.abs(rawPitch) < 0.03) rawPitch = 0;
    if (Math.abs(rawYaw) < 0.03) rawYaw = 0;

    this.gyroAccumX += rawYaw;
    this.gyroAccumY += rawPitch;
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
    this.pendingAbility = true;
  }

  public triggerAbility() {
    this.pendingAbility = true;
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
    this.smoothLookX = 0;
    this.smoothLookY = 0;
    this.gyroAccumX = 0;
    this.gyroAccumY = 0;
    this.filteredYawRate = 0;
    this.filteredPitchRate = 0;
    this.lastMotionTimestamp = 0;
    this.lastGyroAlpha = null;
    this.lastGyroBeta = null;
    this.lastGyroGamma = null;
    this.pendingReload = false;
    this.pendingDash = false;
    this.pendingEmp = false;
    this.pendingOverdrive = false;
    this.pendingAbility = false;
    this.pendingPause = false;
    this.pendingToggleHint = false;
    this.pendingWeapon = null;
  }

  public poll(settings: GameSettings): GameplayInputCommand {
    const { cameraMult } = resolveSpeedSettings(settings);
    const sens = 0.0052 * settings.touchSensitivity * cameraMult;
    let lookDeltaX = -this.lookAccumX * sens;
    let lookDeltaY = -this.lookAccumY * sens;
    this.lookAccumX = 0;
    this.lookAccumY = 0;

    // Jika Gyro HP diaktifkan, terapkan akumulasi rotasi secara presisi & instan tanpa lag/ketahan
    if (settings.mobileGyroEnabled) {
      // Sensitivitas responsif ala mobile shooter (0.035 rad/deg ~ 2.0x perputaran alami)
      const gyroSensMultiplier = settings.gyroSensitivity ?? 1.0;
      const gyroSens = 0.035 * gyroSensMultiplier * settings.touchSensitivity * cameraMult;
      lookDeltaX += this.gyroAccumX * gyroSens;
      lookDeltaY += this.gyroAccumY * gyroSens;
    } else {
      this.filteredYawRate = 0;
      this.filteredPitchRate = 0;
      this.lastMotionTimestamp = 0;
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
      useAbility: this.pendingAbility,
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
    this.pendingAbility = false;
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
  private weaponsOrder: WeaponType[] = ['laser_rifle', 'cyber_shotgun', 'railgun'];

  public poll(
    session: XRSession | null,
    rightController: THREE.Group | null,
    dt: number,
    settings: GameSettings,
    handGestures?: VRHandGestureResult | null
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
    let weaponCycle = false;

    for (const source of session.inputSources) {
      if (source.hand) continue;
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
          weaponCycle = true;
        }
        if (this.wasJustPressed('left_btn5', gp.buttons[5]?.pressed)) {
          pause = true;
        }
        if (this.wasJustPressed('left_grip', gp.buttons[1]?.pressed)) {
          overdrive = true;
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
            const { cameraMult } = resolveSpeedSettings(settings);
            lookDeltaX = -stickX * settings.vrSmoothTurnSpeed * cameraMult * dt;
          }
        }
      }
    }

    if (handGestures) {
      if (Math.abs(handGestures.moveZ) > 0.01) moveZ = handGestures.moveZ;
      if (Math.abs(handGestures.lookDeltaX) > 0.0001) lookDeltaX = handGestures.lookDeltaX;
      if (handGestures.shoot) shoot = true;
      if (handGestures.pause) pause = true;
      if (handGestures.useAbility) overdrive = true;
      if (handGestures.weaponSwitch) {
        this.currentWeaponIndex = (this.currentWeaponIndex + 1) % this.weaponsOrder.length;
        weaponSwitch = this.weaponsOrder[this.currentWeaponIndex];
      }
    }

    let vrAimRay: GameplayInputCommand['vrAimRay'] = null;
    if (rightController) {
      rightController.getWorldPosition(_scratchVROrigin);
      rightController.getWorldQuaternion(_scratchVRQuat);
      _scratchVRDir.set(0, 0, -1).applyQuaternion(_scratchVRQuat).normalize();
      vrAimRay = {
        origin: [_scratchVROrigin.x, _scratchVROrigin.y, _scratchVROrigin.z],
        direction: [_scratchVRDir.x, _scratchVRDir.y, _scratchVRDir.z],
      };
    } else if (handGestures?.rightAimOrigin && handGestures?.rightAimDir) {
      vrAimRay = {
        origin: [
          handGestures.rightAimOrigin.x,
          handGestures.rightAimOrigin.y,
          handGestures.rightAimOrigin.z,
        ],
        direction: [
          handGestures.rightAimDir.x,
          handGestures.rightAimDir.y,
          handGestures.rightAimDir.z,
        ],
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
      useAbility: overdrive || dash,
      pause,
      weaponSwitch,
      weaponCycle,
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
export interface MenuGamepadCommand {
  confirm: boolean;
  back: boolean;
  tutorial: boolean;
  settings: boolean;
  start: boolean;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export class InputManager {
  public mode: PlatformMode = 'desktop';
  public isGamepadConnected: boolean = false;
  public desktop = new DesktopInput();
  public mobile = new MobileInput();
  public vr = new VRInput();
  private onModeChangeCallback?: (mode: PlatformMode) => void;
  private onGamepadChangeCallback?: (connected: boolean) => void;
  private autoDetectionAttached = false;
  private menuPrevButtons: Record<string, boolean> = {};

  constructor() {
    this.detectInitialMode();
    this.syncGamepadConnection(false);
  }

  public syncGamepadConnection(notify: boolean = true): boolean {
    let connected = false;
    if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') {
      try {
        const gamepads = navigator.getGamepads();
        for (const gp of gamepads) {
          if (isValidGamepad(gp)) {
            connected = true;
            break;
          }
        }
      } catch {}
    }
    if (connected !== this.isGamepadConnected) {
      this.isGamepadConnected = connected;
      if (connected && this.mode === 'mobile') {
        this.mobile.reset();
      }
      if (notify) {
        this.onGamepadChangeCallback?.(connected);
      }
    }
    return connected;
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
  public attachAutoDetection(
    onModeChange: (mode: PlatformMode) => void,
    onGamepadChange?: (connected: boolean) => void
  ) {
    this.onModeChangeCallback = onModeChange;
    this.onGamepadChangeCallback = onGamepadChange;
    this.syncGamepadConnection(true);
    if (this.autoDetectionAttached || typeof window === 'undefined') return;
    this.autoDetectionAttached = true;

    window.addEventListener('pointerdown', this.handleSmartPointerDown, { passive: true });
    window.addEventListener('touchstart', this.handleSmartTouchStart, { passive: true });
    window.addEventListener('keydown', this.handleSmartKeyDown, { passive: true });
    window.addEventListener('gamepadconnected', this.handleSmartGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.handleSmartGamepadDisconnected);

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
    window.removeEventListener('gamepaddisconnected', this.handleSmartGamepadDisconnected);
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
    this.syncGamepadConnection(true);
    if (this.mode === 'vr') return;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const isPhoneUA = /Android|iPhone|iPod|Mobile/i.test(ua);
    if (!isPhoneUA && this.mode !== 'desktop') {
      this.setMode('desktop');
    }
  };

  private handleSmartGamepadDisconnected = () => {
    this.syncGamepadConnection(true);
  };

  public setMode(newMode: PlatformMode) {
    if (this.mode === newMode) return;
    if (this.mode === 'desktop') {
      this.desktop.releasePointerLock();
    }
    this.resetAll();
    this.mode = newMode;
    this.onModeChangeCallback?.(newMode);
  }

  /**
   * Mereset seluruh status gerakan/tombol di Desktop, Mobile, dan VR agar karakter berhenti total saat ganti stage / jeda.
   */
  public resetAll() {
    this.desktop.reset();
    this.mobile.reset();
  }

  public poll(
    settings: GameSettings,
    dt: number,
    xrSession: XRSession | null = null,
    rightController: THREE.Group | null = null,
    handGestures: VRHandGestureResult | null = null
  ): GameplayInputCommand {
    this.syncGamepadConnection(true);

    if (this.mode === 'vr' && xrSession) {
      return this.vr.poll(xrSession, rightController, dt, settings, handGestures);
    }
    if (this.mode === 'mobile') {
      const mobileCmd = this.mobile.poll(settings);
      if (this.isGamepadConnected) {
        const gpCmd = this.desktop.pollGamepadOnly(settings, dt);
        if (gpCmd) {
          return {
            moveX: Math.max(-1, Math.min(1, mobileCmd.moveX + gpCmd.moveX)),
            moveZ: Math.max(-1, Math.min(1, mobileCmd.moveZ + gpCmd.moveZ)),
            lookDeltaX: mobileCmd.lookDeltaX + gpCmd.lookDeltaX,
            lookDeltaY: mobileCmd.lookDeltaY + gpCmd.lookDeltaY,
            jump: mobileCmd.jump || gpCmd.jump,
            shoot: mobileCmd.shoot || gpCmd.shoot,
            reload: mobileCmd.reload || gpCmd.reload,
            dash: mobileCmd.dash || gpCmd.dash,
            emp: mobileCmd.emp || gpCmd.emp,
            overdrive: mobileCmd.overdrive || gpCmd.overdrive,
            pause: mobileCmd.pause || gpCmd.pause,
            toggleHint: mobileCmd.toggleHint || gpCmd.toggleHint,
            useAbility: mobileCmd.useAbility || gpCmd.useAbility,
            weaponSwitch: gpCmd.weaponSwitch ?? mobileCmd.weaponSwitch,
            weaponCycle: gpCmd.weaponCycle,
          };
        }
      }
      return mobileCmd;
    }
    return this.desktop.poll(settings, dt);
  }

  private wasMenuButtonJustPressed(key: string, pressed: boolean | undefined): boolean {
    const now = !!pressed;
    const prev = !!this.menuPrevButtons[key];
    this.menuPrevButtons[key] = now;
    return now && !prev;
  }

  /** Menyelaraskan status tombol menu dengan kondisi gamepad saat ini agar transisi playing -> paused tidak memicu double-press. */
  public syncMenuGamepadState(): void {
    if (!this.isGamepadConnected || typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return;
    }
    try {
      const gamepads = navigator.getGamepads();
      for (const gp of gamepads) {
        if (!isValidGamepad(gp)) continue;
        const axisX = gp.axes[0] ?? 0;
        const axisY = gp.axes[1] ?? 0;
        const dpad = readGamepadDpad(gp);
        const p = `gp_${gp.index}_`;
        this.menuPrevButtons[`${p}0`] = isGamepadBtnActive(gp.buttons[0], 0.35);
        this.menuPrevButtons[`${p}1`] = isGamepadBtnActive(gp.buttons[1], 0.35);
        this.menuPrevButtons[`${p}2`] = isGamepadBtnActive(gp.buttons[2], 0.35);
        this.menuPrevButtons[`${p}3`] = isGamepadBtnActive(gp.buttons[3], 0.35);
        this.menuPrevButtons[`${p}9`] = isGamepadBtnActive(gp.buttons[9], 0.35);
        this.menuPrevButtons[`${p}up`] = dpad.up || axisY < -0.55;
        this.menuPrevButtons[`${p}down`] = dpad.down || axisY > 0.55;
        this.menuPrevButtons[`${p}left`] = dpad.left || axisX < -0.55;
        this.menuPrevButtons[`${p}right`] = dpad.right || axisX > 0.55;
      }
    } catch {}
  }

  public pollMenuGamepad(): MenuGamepadCommand {
    this.syncGamepadConnection(true);
    const result: MenuGamepadCommand = {
      confirm: false,
      back: false,
      tutorial: false,
      settings: false,
      start: false,
      up: false,
      down: false,
      left: false,
      right: false,
    };
    if (!this.isGamepadConnected || typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return result;
    }
    try {
      const gamepads = navigator.getGamepads();
      for (const gp of gamepads) {
        if (!isValidGamepad(gp)) continue;
        const axisX = gp.axes[0] ?? 0;
        const axisY = gp.axes[1] ?? 0;
        const dpad = readGamepadDpad(gp);
        const rawUp = dpad.up || axisY < -0.55;
        const rawDown = dpad.down || axisY > 0.55;
        const rawLeft = dpad.left || axisX < -0.55;
        const rawRight = dpad.right || axisX > 0.55;
        const p = `gp_${gp.index}_`;
        if (this.wasMenuButtonJustPressed(`${p}0`, isGamepadBtnActive(gp.buttons[0], 0.35))) result.confirm = true;
        if (this.wasMenuButtonJustPressed(`${p}1`, isGamepadBtnActive(gp.buttons[1], 0.35))) result.back = true;
        if (this.wasMenuButtonJustPressed(`${p}2`, isGamepadBtnActive(gp.buttons[2], 0.35))) result.tutorial = true;
        if (this.wasMenuButtonJustPressed(`${p}3`, isGamepadBtnActive(gp.buttons[3], 0.35))) result.settings = true;
        if (this.wasMenuButtonJustPressed(`${p}9`, isGamepadBtnActive(gp.buttons[9], 0.35))) result.start = true;
        if (this.wasMenuButtonJustPressed(`${p}up`, rawUp)) result.up = true;
        if (this.wasMenuButtonJustPressed(`${p}down`, rawDown)) result.down = true;
        if (this.wasMenuButtonJustPressed(`${p}left`, rawLeft)) result.left = true;
        if (this.wasMenuButtonJustPressed(`${p}right`, rawRight)) result.right = true;
      }
    } catch {}
    return result;
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
