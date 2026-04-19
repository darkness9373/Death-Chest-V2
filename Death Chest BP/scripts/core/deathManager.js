import { BlockPermutation, Player, system, world } from '@minecraft/server';
import { ENTITY_STORAGE_ID } from '../config';
import { findSafeLocation } from './findSafeLocation';
import { generateUniqueCode } from './uniqueCode';

world.afterEvents.entityDie.subscribe(data => {
    const player = data.deadEntity;
    if (player instanceof Player) {
        const deathPos = player.location;
        const dimension = player.dimension;
        system.run(() => {
            const cd = generateUniqueCode(16);
            const data = {
                owner: player.name,
                expire: Date.now() + 1000 * 60 * 30,
                time: Date.now(),
                code: cd
            }
            if (deathPos.y < -60) {
                let spawn = null;
                let dim = null;
                const cpoint = player.getSpawnPoint();
                if (!cpoint) {
                    const wspawn = world.getDefaultSpawnLocation();
                    spawn = wspawn;
                    dim = world.getDimension('overworld');
                } else {
                    const cspawn = {
                        x: cpoint.x,
                        y: cpoint.y,
                        z: cpoint.z
                    }
                    spawn = cspawn;
                    dim = cpoint.dimension
                }
                const safe = findSafeLocation(dim, spawn);
                if (!safe) {
                    spawnEntityStorage(dim, spawn, data);
                    return;
                }
                spawnEntityStorage(dim, safe, data);
                return;
            }
            const safe = findSafeLocation(dimension, deathPos);
            if (!safe) {
                spawnEntityStorage(dimension, deathPos, data);
                return;
            }
            spawnEntityStorage(dimension, safe, data);
        })
    }
})

/**
 * 
 * @param {import('@minecraft/server').Dimension} dimension 
 * @param {import('@minecraft/server').Vector3} pos 
 * @param {Object} data 
 */
function spawnEntityStorage(dimension, pos, data) {
    const block = dimension.getBlock(pos);
    block.setPermutation(BlockPermutation.resolve('minecraft:chest'));
    const entity = dimension.spawnEntity(ENTITY_STORAGE_ID, {
        x: pos.x + 0.5,
        y: pos.y + 0.5,
        z: pos.z + 0.5
    });
    entity.setDynamicProperty('data', JSON.stringify(data));
}