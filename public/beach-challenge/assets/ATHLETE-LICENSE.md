# Playza athlete asset

`playza-athlete.glb` adapts the Sam character and original idle/run animations by Innerscene, built from MakeHuman/MPFB CC0 body, rig, and skin assets. The source models are released under CC0 1.0, permitting modification and commercial redistribution.

Sources:
- https://www.innerscene.com/tools/library/3d-parts/idle-standing-sam-3d-person-animated-1f9f1217
- https://www.innerscene.com/tools/library/3d-parts/run-sam-3d-person-animated-fa008c06
- https://creativecommons.org/publicdomain/zero/1.0/

Playza adaptations: coral sports top and navy training trousers, texture resizing, compact skin attributes, and resampled animation keys. The Playza logo is a separate brand asset and is not covered by this CC0 dedication. Volleyball poses and first-person arm control are implemented in `game/athlete.js`; they are procedural IK, not motion capture.

Rebuild with Python, numpy, and Pillow:
```
python3 scripts/prepare-playza-athlete.py --idle /path/to/original-idle.glb --run /path/to/original-run.glb
```

The local GLTFLoader, BufferGeometryUtils, and SkeletonUtils files are from Three.js r180 under the MIT license in `vendor/THREE-LICENSE.txt`.
