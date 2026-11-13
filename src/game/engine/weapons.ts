import * as THREE from 'three';
import { WeaponType } from '../types';
import { WEAPON_REGISTRY } from '../rules';
import { sound } from '../audio';

export class WeaponRig {
  public camera: THREE.Camera;
  public gunGroup: THREE.Group;
  public currentWeapon: WeaponType = 'laser_rifle';
  public ammoCount: number;

  private ammoByWeapon: Record<WeaponType, number>;

  private weaponMeshes: Map<WeaponType, THREE.Group> = new Map();
  private weaponAccentMats: Map<
    WeaponType,
    Array<THREE.MeshStandardMaterial | THREE.MeshBasicMaterial>
  > = new Map();
  private crystalTintHex: string | null = null;
  private muzzleFlashLight: THREE.PointLight;
  private muzzleTipAnchor: THREE.Object3D;
  private recoilOffset = new THREE.Vector3();
  private recoilRot = new THREE.Euler();
  private timeSinceLastShot = 0;
  private reloadDuration = 1.4;
  private fireRateMult = 1.0;
  private reloadTimeMult = 1.0;
  private magSizeBonus = 0;
  private vrHandParent: THREE.Object3D | null = null;
  private vrHandIsTracking = false;

  constructor(camera: THREE.Camera) {
    this.camera = camera;
    this.gunGroup = new THREE.Group();
    this.ammoByWeapon = {
      laser_rifle: WEAPON_REGISTRY.laser_rifle.magSize,
      cyber_shotgun: WEAPON_REGISTRY.cyber_shotgun.magSize,
      railgun: WEAPON_REGISTRY.railgun.magSize,
      plasma_smg: WEAPON_REGISTRY.plasma_smg.magSize,
    };
    this.ammoCount = this.ammoByWeapon.laser_rifle;

    this.gunGroup.position.set(0.32, -0.28, -0.6);
    this.camera.add(this.gunGroup);

    this.muzzleFlashLight = new THREE.PointLight('#00f0ff', 0, 10);
    this.muzzleFlashLight.position.set(0, 0.02, -0.68);
    this.gunGroup.add(this.muzzleFlashLight);

    this.muzzleTipAnchor = new THREE.Object3D();
    this.muzzleTipAnchor.position.set(0, 0.02, -0.68);
    this.gunGroup.add(this.muzzleTipAnchor);

    this.buildAllWeaponModels();
    this.switchWeapon('laser_rifle');
  }

  public attachToVRHand(controller: THREE.Object3D | null, isHandTracking = false) {
    if (this.vrHandParent === controller && this.vrHandIsTracking === isHandTracking) return;
    this.vrHandParent = controller;
    this.vrHandIsTracking = isHandTracking;
    if (controller) {
      if (this.gunGroup.parent !== controller) {
        controller.add(this.gunGroup);
      }
      if (isHandTracking) {
        // Mode tangan kosong (mount pada sendi wrist): selaraskan sejajar punggung/telapak tangan
        this.gunGroup.scale.setScalar(0.46);
        this.gunGroup.position.set(0.015, 0.01, -0.09);
        this.gunGroup.rotation.set(-0.22, 0, 0);
      } else {
        // Mode controller fisik: posisi grip tepat di genggaman controller
        this.gunGroup.scale.setScalar(0.5);
        this.gunGroup.position.set(0, 0.045, -0.055);
        this.gunGroup.rotation.set(0, 0, 0);
      }
    } else {
      this.camera.add(this.gunGroup);
      this.gunGroup.scale.setScalar(1);
      this.gunGroup.position.set(0.32, -0.28, -0.6);
      this.gunGroup.rotation.set(0, 0, 0);
    }
  }

  public getMuzzleWorldPosition(out: THREE.Vector3): THREE.Vector3 {
    this.gunGroup.updateMatrixWorld(true);
    return this.muzzleTipAnchor.getWorldPosition(out);
  }

  public setModifiers(fireRateMult: number, reloadTimeMult: number, magSizeBonus: number) {
    this.fireRateMult = fireRateMult;
    this.reloadTimeMult = reloadTimeMult;
    this.magSizeBonus = magSizeBonus;
    const def = WEAPON_REGISTRY[this.currentWeapon];
    this.reloadDuration = def.reloadTime * this.reloadTimeMult;
  }

  public getMaxMagSize(): number {
    return WEAPON_REGISTRY[this.currentWeapon].magSize + this.magSizeBonus;
  }

  private addWeaponErgonomics(
    group: THREE.Group,
    darkMat: THREE.Material,
    accentMat: THREE.Material,
    hasStock = true
  ) {
    // Pistol Grip (gagang pegangan tangan kanan)
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.11), darkMat);
    grip.position.set(0, -0.15, 0.11);
    grip.rotation.x = 0.26;
    group.add(grip);

    // Trigger Guard
    const triggerGuard = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.025, 0.12), darkMat);
    triggerGuard.position.set(0, -0.12, 0.02);
    group.add(triggerGuard);

    // Magazine
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, 0.11), darkMat);
    mag.position.set(0, -0.14, -0.1);
    mag.rotation.x = -0.14;
    group.add(mag);

    const magStripe = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.03, 0.114), accentMat);
    magStripe.position.set(0, -0.18, -0.11);
    magStripe.rotation.x = -0.14;
    group.add(magStripe);

    if (hasStock) {
      // Popor belakang (Stock) agar siluet senapan penuh
      const stockArm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.09, 0.28), darkMat);
      stockArm.position.set(0, -0.02, 0.42);
      group.add(stockArm);

      const stockPad = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.2, 0.06), darkMat);
      stockPad.position.set(0, -0.04, 0.56);
      group.add(stockPad);
    }
  }

  private buildAllWeaponModels() {
    // 1. Pulse Laser Rifle
    const rifle = new THREE.Group();
    const rifleDarkMat = new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.3, metalness: 0.85 });
    const rifleBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.16, 0.65),
      rifleDarkMat
    );
    rifle.add(rifleBody);

    const rifleBarrelMat = new THREE.MeshStandardMaterial({
      color: '#00f0ff',
      emissive: '#00b8ff',
      emissiveIntensity: 0.6,
    });
    const rifleBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.035, 0.45, 12),
      rifleBarrelMat
    );
    rifleBarrel.rotation.x = Math.PI / 2;
    rifleBarrel.position.set(0, 0.02, -0.45);
    rifle.add(rifleBarrel);

    const rifleShroud = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.11, 0.26), rifleDarkMat);
    rifleShroud.position.set(0, 0.01, -0.34);
    rifle.add(rifleShroud);

    const rifleOpticMat = new THREE.MeshBasicMaterial({ color: '#00f0ff', wireframe: true });
    const rifleOptic = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.08, 0.18),
      rifleOpticMat
    );
    rifleOptic.position.set(0, 0.12, -0.1);
    rifle.add(rifleOptic);

    this.addWeaponErgonomics(rifle, rifleDarkMat, rifleBarrelMat, true);
    this.weaponMeshes.set('laser_rifle', rifle);
    this.weaponAccentMats.set('laser_rifle', [rifleBarrelMat, rifleOpticMat]);

    // 2. Glitch Scattergun
    const shotgun = new THREE.Group();
    const shotgunDarkMat = new THREE.MeshStandardMaterial({ color: '#1f132b', roughness: 0.4, metalness: 0.8 });
    const shotgunBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.2, 0.6),
      shotgunDarkMat
    );
    shotgun.add(shotgunBody);

    const shotgunBarrelMat = new THREE.MeshStandardMaterial({
      color: '#ff0055',
      emissive: '#ff0055',
      emissiveIntensity: 0.5,
    });
    const barrelL = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.4, 12),
      shotgunBarrelMat
    );
    barrelL.rotation.x = Math.PI / 2;
    barrelL.position.set(-0.045, 0.04, -0.4);
    shotgun.add(barrelL);

    const barrelR = barrelL.clone();
    barrelR.position.x = 0.045;
    shotgun.add(barrelR);

    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.24), shotgunDarkMat);
    pump.position.set(0, -0.04, -0.34);
    shotgun.add(pump);

    this.addWeaponErgonomics(shotgun, shotgunDarkMat, shotgunBarrelMat, true);
    this.weaponMeshes.set('cyber_shotgun', shotgun);
    this.weaponAccentMats.set('cyber_shotgun', [shotgunBarrelMat]);

    // 3. Apex Railgun
    const railgun = new THREE.Group();
    const railDarkMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.2, metalness: 0.95 });
    const railBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.22, 0.8),
      railDarkMat
    );
    railgun.add(railBody);

    const railAccentMat = new THREE.MeshBasicMaterial({ color: '#bf00ff' });
    const railTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.04, 0.6),
      railAccentMat
    );
    railTop.position.set(0, 0.12, -0.5);
    railgun.add(railTop);

    const railBot = railTop.clone();
    railBot.position.y = -0.12;
    railgun.add(railBot);

    this.addWeaponErgonomics(railgun, railDarkMat, railAccentMat, true);
    this.weaponMeshes.set('railgun', railgun);
    this.weaponAccentMats.set('railgun', [railAccentMat]);

    // 4. Sub-Zero Plasma SMG
    const smg = new THREE.Group();
    const smgDarkMat = new THREE.MeshStandardMaterial({ color: '#092314', roughness: 0.3, metalness: 0.8 });
    const smgBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.22, 0.42),
      smgDarkMat
    );
    smg.add(smgBody);

    const smgAccentMat = new THREE.MeshBasicMaterial({ color: '#39ff14', wireframe: true });
    const drumMag = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.14, 16),
      smgAccentMat
    );
    drumMag.position.set(0, -0.15, 0.02);
    smg.add(drumMag);

    this.addWeaponErgonomics(smg, smgDarkMat, smgAccentMat, false);
    this.weaponMeshes.set('plasma_smg', smg);
    this.weaponAccentMats.set('plasma_smg', [smgAccentMat]);

    this.weaponMeshes.forEach((mesh) => {
      mesh.visible = false;
      this.gunGroup.add(mesh);
    });
  }

  public resetAllAmmo() {
    (Object.keys(WEAPON_REGISTRY) as WeaponType[]).forEach((w) => {
      this.ammoByWeapon[w] = WEAPON_REGISTRY[w].magSize + this.magSizeBonus;
    });
    this.ammoCount = this.ammoByWeapon[this.currentWeapon];
  }

  public addAmmoSupply(stage: 1 | 2 | 3 = 1): number {
    const gainsByStage: Record<1 | 2 | 3, Record<WeaponType, number>> = {
      1: { laser_rifle: 5, cyber_shotgun: 3, railgun: 2, plasma_smg: 5 },
      2: { laser_rifle: 4, cyber_shotgun: 2, railgun: 1, plasma_smg: 4 },
      3: { laser_rifle: 3, cyber_shotgun: 2, railgun: 1, plasma_smg: 3 },
    };
    const gains = gainsByStage[stage];
    const prevCurrentAmmo = this.ammoByWeapon[this.currentWeapon];
    (Object.keys(WEAPON_REGISTRY) as WeaponType[]).forEach((w) => {
      const maxCap = WEAPON_REGISTRY[w].magSize * 2;
      this.ammoByWeapon[w] = Math.min(maxCap, this.ammoByWeapon[w] + gains[w]);
    });
    this.ammoCount = this.ammoByWeapon[this.currentWeapon];
    return Math.max(0, this.ammoCount - prevCurrentAmmo);
  }

  public switchWeapon(type: WeaponType) {
    if (this.currentWeapon === type && this.weaponMeshes.get(type)?.visible) return;

    this.ammoByWeapon[this.currentWeapon] = this.ammoCount;

    this.weaponMeshes.forEach((mesh, key) => {
      mesh.visible = key === type;
    });

    this.currentWeapon = type;
    const def = WEAPON_REGISTRY[type];
    this.ammoCount = this.ammoByWeapon[type];
    this.reloadDuration = def.reloadTime * this.reloadTimeMult;
    this.muzzleFlashLight.color.set(this.crystalTintHex || def.color);

    const tipOffsets: Record<WeaponType, [number, number, number]> = {
      laser_rifle: [0, 0.02, -0.68],
      cyber_shotgun: [0, 0.04, -0.61],
      railgun: [0, 0.0, -0.80],
      plasma_smg: [0, 0.01, -0.24],
    };
    const [tx, ty, tz] = tipOffsets[type];
    this.muzzleTipAnchor.position.set(tx, ty, tz);
    this.muzzleFlashLight.position.set(tx, ty, tz);
  }

  /**
   * Mengubah warna energi senjata & sinar tembakan sesuai Kristal Warna yang diambil saat melawan Boss
   */
  public setCrystalTint(colorHex: string | null) {
    this.crystalTintHex = colorHex;
    const defaultColors: Record<WeaponType, string> = {
      laser_rifle: '#00f0ff',
      cyber_shotgun: '#ff0055',
      railgun: '#bf00ff',
      plasma_smg: '#39ff14',
    };

    this.weaponAccentMats.forEach((mats, wType) => {
      const targetHex = colorHex || defaultColors[wType];
      mats.forEach((mat) => {
        mat.color.set(targetHex);
        if ('emissive' in mat) {
          mat.emissive.set(targetHex);
        }
      });
    });

    const curDef = WEAPON_REGISTRY[this.currentWeapon];
    this.muzzleFlashLight.color.set(colorHex || curDef.color);
  }

  public canShoot(): boolean {
    const def = WEAPON_REGISTRY[this.currentWeapon];
    const effectiveFireRate = def.fireRate * this.fireRateMult;
    return this.ammoCount > 0 && this.timeSinceLastShot >= 1.0 / effectiveFireRate;
  }

  public fire(): boolean {
    if (!this.canShoot()) {
      return false;
    }

    const def = WEAPON_REGISTRY[this.currentWeapon];
    this.timeSinceLastShot = 0;

    this.ammoCount = Math.max(0, this.ammoCount - 1);
    this.ammoByWeapon[this.currentWeapon] = this.ammoCount;

    this.recoilOffset.z = def.recoil;
    this.recoilRot.x = def.recoil * 1.5;
    this.muzzleFlashLight.intensity = 3.5;

    if (def.soundType === 'laser') sound.playLaser();
    else if (def.soundType === 'shotgun') sound.playShotgun();
    else if (def.soundType === 'railgun') sound.playRailgun();
    else if (def.soundType === 'plasma') sound.playPlasma();

    return true;
  }

  private static readonly ZERO_VEC = new THREE.Vector3(0, 0, 0);

  public update(dt: number, isMoving: boolean, time: number) {
    this.timeSinceLastShot += dt;

    this.recoilOffset.lerp(WeaponRig.ZERO_VEC, dt * 14);
    this.recoilRot.x = THREE.MathUtils.lerp(this.recoilRot.x, 0, dt * 14);

    if (this.vrHandParent) {
      this.gunGroup.position.set(0, 0.045, -0.055 + this.recoilOffset.z);
      this.gunGroup.rotation.set(this.recoilRot.x, 0, 0);
    } else {
      const bobX = isMoving ? Math.sin(time * 10) * 0.015 : 0;
      const bobY = isMoving ? Math.cos(time * 20) * 0.015 : Math.sin(time * 2) * 0.003;
      this.gunGroup.position.x = 0.32 + bobX;
      this.gunGroup.position.y = -0.28 + bobY;
      this.gunGroup.position.z = -0.6 + this.recoilOffset.z;
      this.gunGroup.rotation.x = this.recoilRot.x;
    }

    if (this.muzzleFlashLight.intensity > 0) {
      this.muzzleFlashLight.intensity = Math.max(0, this.muzzleFlashLight.intensity - dt * 25);
    }
  }
}
