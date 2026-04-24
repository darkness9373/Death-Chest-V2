import { BlockPermutation, EquipmentSlot, ItemStack, Player, system, TickingAreaManager, world } from '@minecraft/server';
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
                code: cd,
                locked: true
            }
            if ((deathPos.y < -55 && dimension.id === 'minecraft:overworld')) {
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

const itm = new Map();
/**
 * 
 * @param {import('@minecraft/server').Player} player
 * @param {import('@minecraft/server').Dimension} dimension 
 * @param {import('@minecraft/server').Vector3} pos 
 * @param {Object} data 
 */
function spawnEntityStorage(player, dimension, pos, data) {
    const items = player.dimension.getEntities({
        location: player.location,
        type: 'minecraft:item',
        maxDistance: 6
    })
    if (items.length === 0) return;
    itm.set(data.code, items);
    if (!dimension.isChunkLoaded(pos)) {
        dimension.runCommand(`tickingarea add circle ${pos.x} ${pos.y} ${pos.z} 1 temp_area`);
        system.runTimeout(() => {
            try {
                const block = dimension.getBlock(pos);
                block.setPermutation(BlockPermutation.resolve('minecraft:chest'));
                const entity = dimension.spawnEntity(ENTITY_STORAGE_ID, {
                    x: pos.x + 0.5,
                    y: pos.y + 0.5,
                    z: pos.z + 0.5
                });
                entity.setDynamicProperty('data', JSON.stringify(data));
                const inv = entity.getComponent('inventory').container;
                for (const item of itm.get(data.code)) {
                    const itemComp = item.getComponent('item');
                    inv.addItem(itemComp.itemStack);
                    item.remove();
                }
                itm.delete(data.code);
            } catch (e) {
                console.error('Failed to set chest block at ', pos, ' in dimension ', dimension.id, e);
            } finally {
                dimension.runCommand(`tickingarea remove temp_area`);
            }
        }, 5)
        return;
    } else {
        const block = dimension.getBlock(pos);
        block.setPermutation(BlockPermutation.resolve('minecraft:chest'));
        const entity = dimension.spawnEntity(ENTITY_STORAGE_ID, {
            x: pos.x + 0.5,
            y: pos.y + 0.5,
            z: pos.z + 0.5
        });
        entity.setDynamicProperty('data', JSON.stringify(data));
        const inv = entity.getComponent('inventory').container;
        for (const item of itm.get(data.code)) {
            const itemComp = item.getComponent('item');
            inv.addItem(itemComp.itemStack);
            item.remove();
        }
        itm.delete(data.code);
    };
    const key = new ItemStack(ITEM_KEY_ID, 1);
    key.setLore([`ID : ${data.code}`, `Location : ${pos.x}, ${pos.y}, ${pos.z}`, `Dimension : ${dimension.id}`]);
    key.setDynamicProperty('id', data.code);
    player.getComponent('inventory').container.addItem(key);
}

world.beforeEvents.playerInteractWithBlock.subscribe(ev => {
    const { player, block, itemStack } = ev;
    if (block.typeId !== 'minecraft:chest') return;
    const entity = getDeathEntity(block);
    if (!entity) return;
    const data = getData(entity);
    if (!data) return;
    ev.cancel = true;
    if (player.name !== data.owner) {
        system.run(() => player.onScreenDisplay.setActionBar(`§cThis is not your death chest!`));
        return;
    }

    if (data.locked) {
        const item = itemStack;
        if (!item || item.typeId !== ITEM_KEY_ID) {
            system.run(() => player.onScreenDisplay.setActionBar(`§cYou need the death chest key to unlock it!`));
            return;
        }
        let keyData;
        try {
            keyData = item.getDynamicProperty('id');
        } catch (e) { }
        if (!keyData || keyData !== data.code) {
            system.run(() => player.onScreenDisplay.setActionBar(`§cYou need the correct death chest key to unlock it!`));
            return;
        }
        if (Date.now() > keyData.expire) {
            system.run(() => player.onScreenDisplay.setActionBar(`§cThe death chest has expired!`));
            return;
        }
        data.locked = false;
        entity.setDynamicProperty('data', JSON.stringify(data));
        system.run(() => player.getComponent('inventory').container.setItem(player.selectedSlotIndex, undefined));
        system.run(() => player.onScreenDisplay.setActionBar(`§aYou have unlocked the death chest!`));
        return;
    }
    system.run(() => transferItems(entity, player));
})

/**
 * 
 * @param {import('@minecraft/server').Block} block 
 */
function getDeathEntity(block) {
    const entities = block.dimension.getEntities({
        location: block.location,
        type: ENTITY_STORAGE_ID,
        maxDistance: 1.5
    })
    return entities[0]
}

function getData(entity) {
    try {
        return JSON.parse(entity.getDynamicProperty('data'));
    } catch (e) {
        return null;
    }
}


/**
 * 
 * @param {import('@minecraft/server').Entity} entity 
 * @param {import('@minecraft/server').Player} player 
 */
function transferItems(entity, player) {
    const inv = player.getComponent('inventory').container;
    const enInv = entity.getComponent('inventory').container;

    for (let i = 0; i < enInv.size; i++) {
        const item = enInv.getItem(i);
        if (!item) continue;
        const clone = item.clone();
        let equipped = false;
        if (isEquipable(clone.typeId)) {
            equipped = equipToPlayer(player, clone);
        }
        if (!equipped) {
            inv.addItem(clone);
        }
        enInv.setItem(i, undefined);
    }

    const block = entity.dimension.getBlock(entity.location);
    entity.remove();
    block.setPermutation(BlockPermutation.resolve('minecraft:air'));
}

function isEquipable(itemId) {
    return (
        itemId.includes('helmet') ||
        itemId.includes('chestplate') ||
        itemId.includes('leggings') ||
        itemId.includes('boots') ||
        itemId === 'minecraft:shield' ||
        itemId === 'minecraft:elytra' ||
        itemId === 'minecraft:totem_of_undying'
    )
}

/**
 * 
 * @param {Player} player 
 * @param {ItemStack} item 
 */
function equipToPlayer(player, item) {
    const eq = player.getComponent('equippable');
    if (item.typeId.includes('helmet')) {
        eq.setEquipment(EquipmentSlot.Head, item);
        return true;
    }
    if (item.typeId.includes('chestplate') || item.typeId === 'minecraft:elytra') {
        const current = eq.getEquipment(EquipmentSlot.Chest);
        if (!current) {
            eq.setEquipment(EquipmentSlot.Chest, item);
            return true;
        }
        return false;
    }
    if (item.typeId.includes('leggings')) {
        eq.setEquipment(EquipmentSlot.Legs, item);
        return true;
    }
    if (item.typeId.includes('boots')) {
        eq.setEquipment(EquipmentSlot.Feet, item);
        return true;
    }
    if (item.typeId === 'minecraft:shield' || item.typeId === 'minecraft:totem_of_undying') {
        const offhand = eq.getEquipment(EquipmentSlot.Offhand);
        if (!offhand) {
            eq.setEquipment(EquipmentSlot.Offhand, item);
            return true;
        }
        return false;
    }
    return false;
}