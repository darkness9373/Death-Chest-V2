import { system, world } from "@minecraft/server";
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
            entity.nameTag = `${data.owner}'s Death Chest\n${Math.max(0, Math.floor((data.expire - Date.now()) / 1000))}s left`;
        }
    }
}, 20)