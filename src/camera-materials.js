import * as THREE from 'three';

// Material study: Poly Haven Camera_01. Keep our rig and geometry; its atlas
// belongs to a different UV layout, so use repeatable CC0 Brown Leather maps.
export async function createCameraMaterials(renderer) {
  const loader = new THREE.TextureLoader();
  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  const load = async (name, colorSpace) => {
    const texture = await loader.loadAsync(`${import.meta.env.BASE_URL}textures/leather/${name}`);
    texture.colorSpace = colorSpace;
    texture.flipY = false;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.35, 1.35);
    texture.anisotropy = anisotropy;
    return texture;
  };
  let maps = [];
  try {
    maps = await Promise.all([
      load('charcoal-color.webp', THREE.SRGBColorSpace),
      load('leather-normal.webp', THREE.NoColorSpace),
      load('leather-arm.webp', THREE.NoColorSpace),
    ]);
    // Upload before the camera is revealed, avoiding a first-use texture hitch.
    maps.forEach((map) => renderer.initTexture(map));
  } catch (error) {
    console.warn('Leather textures unavailable; using charcoal material.', error);
  }
  const [colorMap, normalMap, armMap] = maps;
  const leather = new THREE.MeshPhysicalMaterial({
    name: 'Leather | charcoal PBR', color: '#292b2c',
    map: colorMap || null, normalMap: normalMap || null,
    normalScale: new THREE.Vector2(0.72, 0.72),
    roughnessMap: armMap || null, roughness: 0.92,
    aoMap: armMap || null, aoMapIntensity: 0.35,
    metalness: 0, clearcoat: 0.07, clearcoatRoughness: 0.5,
    envMapIntensity: 0.7,
  });
  const chrome = new THREE.MeshStandardMaterial({
    name: 'Chrome | satin PBR', color: '#c4c9ca',
    metalness: 1, roughness: 0.25, envMapIntensity: 1.05,
  });
  const chassis = chrome.clone();
  chassis.name = 'Chrome | chassis satin PBR';
  chassis.color.set('#9da6aa');
  chassis.roughness = 0.32;
  chassis.envMapIntensity = 0.45;
  const enamel = new THREE.MeshPhysicalMaterial({
    name: 'Enamel | black PBR', color: '#14191c',
    metalness: 0.18, roughness: 0.34,
    clearcoat: 0.35, clearcoatRoughness: 0.23, envMapIntensity: 0.8,
  });
  const anodized = new THREE.MeshStandardMaterial({
    name: 'Anodized | graphite PBR', color: '#292e32',
    metalness: 0.82, roughness: 0.3, envMapIntensity: 0.85,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    name: 'Optical glass | coated PBR', color: '#426360',
    metalness: 0, roughness: 0.075, ior: 1.52,
    transmission: 0.3, thickness: 0.08,
    clearcoat: 1, clearcoatRoughness: 0.055,
    iridescence: 0.22, iridescenceIOR: 1.3,
    iridescenceThicknessRange: [180, 360], envMapIntensity: 0.85,
  });
  const innerGlass = glass.clone();
  innerGlass.name = 'Optical glass | inner PBR';
  innerGlass.color.set('#17262a');
  innerGlass.transmission = 0.12;
  innerGlass.roughness = 0.11;

  return {
    apply(mesh, objectPath) {
      const originalName = mesh.material.name;
      if (originalName.includes('Leather')) mesh.material = leather;
      else if (originalName.includes('Chrome')) mesh.material = /Body \| chrome chassis/i.test(objectPath) ? chassis : chrome;
      else if (originalName.includes('Enamel')) mesh.material = enamel;
      else if (originalName.includes('Anodized')) mesh.material = anodized;
      else if (originalName.includes('Optical glass')) mesh.material = originalName.includes('inner') ? innerGlass : glass;
    },
  };
}
