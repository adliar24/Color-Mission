import * as THREE from 'three';
import { WeaponType } from '../types';
import { WEAPON_REGISTRY } from '../rules';
import { sound } from '../audio';

export class WeaponRig {
  public camera: THREE.Camera;
  public gunGroup: THREE.Group;
  public currentWeapon: WeaponType = 'laser_rifle';
  public ammoCount: number;
  public reserveAmmo: number;
  public isReloading: boolean = false;
  public reloadProgress: number = 0;

  private ammoByWeapon: Record<WeaponType, number>;
  private reserveByWeapon: Record<WeaponType, number>;

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

  constructor(camera: THREE.Camera) {
    this.camera = camera;
    this.gunGroup = new THREE.Group();
    this.ammoByWeapon = {
      laser_rifle: WEAPON_REGISTRY.laser_rifle.magSize,
      cyber_shotgun: WEAPON_REGISTRY.cyber_shotgun.magSize,
      railgun: WEAPON_REGISTRY.railgun.magSize,
      plasma_smg: WEAPON_REGISTRY.plasma_smg.magSize,
    };
    this.reserveByWeapon = {
      laser_rifle: WEAPON_REGISTRY.laser_rifle.magSize * 3,
      cyber_shotgun: WEAPON_REGISTRY.cyber_shotgun.magSize * 3,
      railgun: WEAPON_REGISTRY.railgun.magSize * 3,
      plasma_smg: WEAPON_REGISTRY.plasma_smg.magSize * 3,
    };
    this.ammoCount = this.ammoByWeapon.laser_rifle;
    this.reserveAmmo = this.reserveByWeapon.laser_rifle;

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

  private buildAllWeaponModels() {
    // 1. Pulse Laser Rifle
    const rifle = new THREE.Group();
    const rifleBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.16, 0.65),
      new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.3, metalness: 0.85 })
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

    const rifleOpticMat = new THREE.MeshBasicMaterial({ color: '#00f0ff', wireframe: true });
    const rifleOptic = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.08, 0.18),
      rifleOpticMat
    );
    rifleOptic.position.set(0, 0.12, -0.1);
    rifle.add(rifleOptic);

    this.weaponMeshes.set('laser_rifle', rifle);
    this.weaponAccentMats.set('laser_rifle', [rifleBarrelMat, rifleOpticMat]);

    // 2. Glitch Scattergun
    const shotgun = new THREE.Group();
    const shotgunBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.2, 0.6),
      new THREE.MeshStandardMaterial({ color: '#1f132b', roughness: 0.4, metalness: 0.8 })
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

    this.weaponMeshes.set('cyber_shotgun', shotgun);
    this.weaponAccentMats.set('cyber_shotgun', [shotgunBarrelMat]);

    // 3. Apex Railgun
    const railgun = new THREE.Group();
    const railBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.22, 0.8),
      new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.2, metalness: 0.95 })
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

    this.weaponMeshes.set('railgun', railgun);
    this.weaponAccentMats.set('railgun', [railAccentMat]);

    // 4. Sub-Zero Plasma SMG
    const smg = new THREE.Group();
    const smgBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.22, 0.42),
      new THREE.MeshStandardMaterial({ color: '#092314', roughness: 0.3, metalness: 0.8 })
    );
    smg.add(smgBody);

    const smgAccentMat = new THREE.MeshBasicMaterial({ color: '#39ff14', wireframe: true });
    const drumMag = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.14, 16),
      smgAccentMat
    );
    drumMag.position.set(0, -0.15, 0.02);
    smg.add(drumMag);

    this.weaponMeshes.set('plasma_smg', smg);
    this.weaponAccentMats.set('plasma_smg', [smgAccentMat]);

    this.weaponMeshes.forEach((mesh) => {
      mesh.visible = false;
      this.gunGroup.add(mesh);
    });
  }

  public resetAllAmmo() {
    (Object.keys(WEAPON_REGISTRY) as WeaponType[]).forEach((w) => {
      const mag = WEAPON_REGISTRY[w].magSize + this.magSizeBonus;
      this.ammoByWeapon[w] = mag;
      this.reserveByWeapon[w] = WEAPON_REGISTRY[w].magSize * 3;
    });
    this.ammoCount = this.ammoByWeapon[this.currentWeapon];
    this.reserveAmmo = this.reserveByWeapon[this.currentWeapon];
    this.isReloading = false;
    this.reloadProgress = 0;
  }

  public addAmmoSupply() {
    (Object.keys(WEAPON_REGISTRY) as WeaponType[]).forEach((w) => {
      const addAmount = Math.max(4, Math.round(WEAPON_REGISTRY[w].magSize * 1.5));
      this.reserveByWeapon[w] = Math.min(
        WEAPON_REGISTRY[w].magSize * 6,
        this.reserveByWeapon[w] + addAmount
      );
    });
    this.reserveAmmo = this.reserveByWeapon[this.currentWeapon];
    if (this.ammoCount <= 0 && !this.isReloading && this.reserveAmmo > 0) {
      this.startReload();
    }
  }

  public switchWeapon(type: WeaponType) {
    if (this.currentWeapon === type && this.weaponMeshes.get(type)?.visible) return;

    this.ammoByWeapon[this.currentWeapon] = this.ammoCount;
    this.reserveByWeapon[this.currentWeapon] = this.reserveAmmo;

    this.weaponMeshes.forEach((mesh, key) => {
      mesh.visible = key === type;
    });

    this.currentWeapon = type;
    const def = WEAPON_REGISTRY[type];
    this.ammoCount = this.ammoByWeapon[type];
    this.reserveAmmo = this.reserveByWeapon[type];
    this.isReloading = false;
    this.reloadProgress = 0;
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

  public canShoot(isOverdrive: boolean = false): boolean {
    const def = WEAPON_REGISTRY[this.currentWeapon];
    const effectiveFireRate = def.fireRate * this.fireRateMult * (isOverdrive ? 1.5 : 1.0);
    const hasAmmo = isOverdrive || (!this.isReloading && this.ammoCount > 0);
    return hasAmmo && this.timeSinceLastShot >= 1.0 / effectiveFireRate;
  }

  public startReload() {
    const maxMag = this.getMaxMagSize();
    if (this.isReloading || this.ammoCount >= maxMag || this.reserveAmmo <= 0) return;
    this.isReloading = true;
    this.reloadProgress = 0;
    this.reloadDuration = WEAPON_REGISTRY[this.currentWeapon].reloadTime * this.reloadTimeMult;
  }

  public fire(isOverdrive: boolean = false): boolean {
    if (!this.canShoot(isOverdrive)) {
      if (this.ammoCount <= 0 && !this.isReloading && !isOverdrive && this.reserveAmmo > 0) {
        this.startReload();
      }
      return false;
    }

    const def = WEAPON_REGISTRY[this.currentWeapon];
    this.timeSinceLastShot = 0;

    if (!isOverdrive) {
      this.ammoCount = Math.max(0, this.ammoCount - 1);
      this.ammoByWeapon[this.currentWeapon] = this.ammoCount;
    }

    this.recoilOffset.z = def.recoil;
    this.recoilRot.x = def.recoil * 1.5;
    this.muzzleFlashLight.intensity = 3.5;

    if (def.soundType === 'laser') sound.playLaser();
    else if (def.soundType === 'shotgun') sound.playShotgun();
    else if (def.soundType === 'railgun') sound.playRailgun();
    else if (def.soundType === 'plasma') sound.playPlasma();

    if (this.ammoCount <= 0 && !isOverdrive && this.reserveAmmo > 0) {
      this.startReload();
    }

    return true;
  }

  private static readonly ZERO_VEC = new THREE.Vector3(0, 0, 0);

  public update(dt: number, isMoving: boolean, time: number) {
    this.timeSinceLastShot += dt;

    if (this.isReloading) {
      this.reloadProgress += dt / Math.max(0.2, this.reloadDuration);
      this.gunGroup.position.y = -0.28 - Math.sin(this.reloadProgress * Math.PI) * 0.15;
      if (this.reloadProgress >= 1.0) {
        const needed = Math.max(0, this.getMaxMagSize() - this.ammoCount);
        const loaded = Math.min(needed, this.reserveAmmo);
        this.ammoCount += loaded;
        this.reserveAmmo = Math.max(0, this.reserveAmmo - loaded);
        this.ammoByWeapon[this.currentWeapon] = this.ammoCount;
        this.reserveByWeapon[this.currentWeapon] = this.reserveAmmo;
        this.isReloading = false;
        this.reloadProgress = 0;
        this.gunGroup.position.y = -0.28;
      }
    } else {
      const bobX = isMoving ? Math.sin(time * 10) * 0.015 : 0;
      const bobY = isMoving ? Math.cos(time * 20) * 0.015 : Math.sin(time * 2) * 0.003;
      this.gunGroup.position.x = 0.32 + bobX;
      this.gunGroup.position.y = -0.28 + bobY;
    }

    this.recoilOffset.lerp(WeaponRig.ZERO_VEC, dt * 14);
    this.recoilRot.x = THREE.MathUtils.lerp(this.recoilRot.x, 0, dt * 14);
    this.gunGroup.position.z = -0.6 + this.recoilOffset.z;
    this.gunGroup.rotation.x = this.recoilRot.x;

    if (this.muzzleFlashLight.intensity > 0) {
      this.muzzleFlashLight.intensity = Math.max(0, this.muzzleFlashLight.intensity - dt * 25);
    }
  }
}
