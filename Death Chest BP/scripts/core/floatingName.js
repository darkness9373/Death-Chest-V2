import { system, world, BlockPermutation } from "@minecraft/server";
import { ENTITY_STORAGE_ID, ITEM_KEY_ID } from "../config";

system.runInterval(() => {
    const dim = [
        world.getDimension('overworld'),
        world.getDimension('nether'),
        world.getDimension('the_end')
    ]
    for (const dimension of dim) {
        const entities = dimension.getEntities({ type: ENTITY_STORAGE_ID });
        for (const entity of entities) {
            const data = JSON.parse(entity.getDynamicProperty('data'));
            entity.nameTag = `${data.owner}'s\n[§b${formatTime(Math.max(0, Math.floor((data.expire - Date.now()) / 1000)))}§r]`;
            if (Date.now() > data.expire) {
                const block = dimension.getBlock(entity.location);
                block.setPermutation(BlockPermutation.resolve('minecraft:air'));
                world.sendMessage(`§c${data.owner}'s death chest has expired and disappeared at ${entity.location.x}, ${entity.location.y}, ${entity.location.z}!`);
                entity.remove();
            }
        }
    }
    for (const player of world.getPlayers()) {
        const inv = player.getComponent('inventory').container;
        for (let i = 0; i < inv.size; i++) {
            const item = inv.getItem(i);
            if (!item || item.typeId !== ITEM_KEY_ID) continue;
            let keyData;
            try {
                keyData = JSON.parse(item.getDynamicProperty('data'));
            } catch (e) {}
            if (!keyData) continue;
            if (Date.now() > keyData.expire) {
                system.run(() => player.onScreenDisplay.setActionBar(`§cOne of your death chest keys has expired!`));
                inv.setItem(i, undefined);
            }
        }
    }
}, 20)

function formatTime(seconds) {
    const hour = Math.floor(seconds / 3600);
    const minute = Math.floor((seconds % 3600) / 60);
    const second = seconds % 60;
    const pad = (num) => String(num).padStart(2, '0');
    return `${pad(hour)}:${pad(minute)}:${pad(second)}`;
}