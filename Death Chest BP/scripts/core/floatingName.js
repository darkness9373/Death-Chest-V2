import { system, world, BlockPermutation } from "@minecraft/server";
import { ENTITY_STORAGE_ID } from "../config";

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
            entity.nameTag = `${data.owner}'s\n${formatTime(Math.max(0, Math.floor((data.expire - Date.now()) / 1000)))}`;
            if (Date.now() > data.expire) {
                const block = dimension.getBlock(entity.location);
                block.setPermutation(BlockPermutation.resolve('minecraft:air'));
                entity.remove();
            }
            let hasItem = false;
            const container = entity.getComponent('minecraft:inventory').container;
            for (let i = 0; i < container.size; i++) {
                const item = container.getItem(i);
                if (!item) continue;
                hasItem = true;
                break;
            }
            if (!hasItem) {
                const block = dimension.getBlock(entity.location);
                block.setPermutation(BlockPermutation.resolve('minecraft:air'));
                entity.remove();
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