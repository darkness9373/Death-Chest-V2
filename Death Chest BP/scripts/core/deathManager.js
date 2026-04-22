import { BlockPermutation, ItemStack, Player, system, world } from '@minecraft/server';
import { ENTITY_STORAGE_ID, ITEM_KEY_ID } from '../config';
import { findSafeLocation } from './findSafeLocation';
import { generateUniqueCode } from './uniqueCode';

world.afterEvents.entityDie.subscribe(data => {
    const player = data.deadEntity;
    if (player instanceof Player) {
        const deathPos = player.location;
        const dimension = player.dimension;
        system.run(() => {
            const cd = generateUniqueCode(16);
            const store = {
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
                spawnEntityStorage(player, dim, safe ?? spawn, store);
                return;
            }
            const safe = findSafeLocation(dimension, deathPos);
            spawnEntityStorage(player, dimension, safe ?? deathPos, store);
        })
    }
})

/**
 * 
 * @param {import('@minecraft/server').Player} player
 * @param {import('@minecraft/server').Dimension} dimension 
 * @param {import('@minecraft/server').Vector3} pos 
 * @param {Object} data 
 */
function spawnEntityStorage(player, dimension, pos, data) {
    const items = player.dimension.getEntities({
        location: pos,
        type: 'minecraft:item',
        maxDistance: 6
    })
    if (items.length === 0) return;
    const block = dimension.getBlock(pos);
    block.setPermutation(BlockPermutation.resolve('minecraft:chest'));
    const entity = dimension.spawnEntity(ENTITY_STORAGE_ID, {
        x: pos.x + 0.5,
        y: pos.y + 0.5,
        z: pos.z + 0.5
    });
    entity.setDynamicProperty('data', JSON.stringify(data));
    const inv = entity.getComponent('inventory').container;
    for (const item of items) {
        const itemComp = item.getComponent('item');
        inv.addItem(itemComp.itemStack);
        item.remove();
    }
    const key = new ItemStack(ITEM_KEY_ID, 1);
    key.setLore([`ID : ${data.code}`, `Location : ${pos.x}, ${pos.y}, ${pos.z}`, `Dimension : ${dimension.id}`]);
    player.getComponent('inventory').container.addItem(key);
}