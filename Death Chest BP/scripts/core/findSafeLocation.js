
const RADIUS = 8;
const MAX_HEIGHT = 100;

/**
 * 
 * @param {import('@minecraft/server').Dimension} dimension 
 * @param {import('@minecraft/server').Vector3} pos 
 */
function getSurfaseAboveLiquid(dimension, pos) {
    let y = pos.y;

    while (y < MAX_HEIGHT) {
        const block = dimension.getBlock({ x: pos.x, y, z: pos.z });
        if (!block) return null;
        if (!block.isLiquid) {
            return { x: pos.x, y, z: pos.z };
        }
        y++;
    }
    return null;
}

/**
 * 
 * @param {import('@minecraft/server').Dimension} dimension 
 * @param {import('@minecraft/server').Vector3} pos 
 */
function isValidChestLocation(dimension, pos) {
    let currentPos = { ...pos };
    const currentBlock = dimension.getBlock(currentPos);
    if (!currentBlock) return null;
    if (currentBlock.isLiquid) {
        const newPos = getSurfaseAboveLiquid(dimension, currentPos);
        if (!newPos) return null;
        currentPos = newPos;
    }

    const below = dimension.getBlock({ x: currentPos.x, y: currentPos.y - 1, z: currentPos.z });
    const current = dimension.getBlock(currentPos);
    if (!below || !current) return null;
    if (!current.isAir) return null;
    if (below.isAir) return null;
    return currentPos;
}

/**
 * 
 * @param {import('@minecraft/server').Dimension} dimension 
 * @param {import('@minecraft/server').Vector3} origin 
 */
export function findSafeLocation(dimension, origin) {
    let best = null;
    let bestDistance = Infinity;
    for (let x = -RADIUS; x <= RADIUS; x++) {
        for (let z = -RADIUS; z <= RADIUS; z++) {
            for (let y = -RADIUS; y <= RADIUS; y++) {
                const pos = {
                    x: Math.floor(origin.x + x),
                    y: Math.floor(origin.y + y),
                    z: Math.floor(origin.z + z)
                };
                if (pos.y < -64) continue;
                const validPos = isValidChestLocation(dimension, pos);
                if (validPos) {
                    const dist = 
                        (validPos.x - origin.x) ** 2 +
                        (validPos.y - origin.y) ** 2 +
                        (validPos.z - origin.z) ** 2;
                    if (dist < bestDistance) {
                        bestDistance = dist;
                        best = validPos;
                    }
                }
            }
        }
    }
    return best;
}