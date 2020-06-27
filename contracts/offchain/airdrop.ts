import * as ethUtils from "ethereumjs-util";


export async function createAirdropBatch(drops, dropTokenType, rollupInstance, coordinator_wallet) {

    const newRoot = await rollupInstance.processAirdropBatch(drops)
    const dropsRoot = await rollupInstance.dropHashchains(drops)
    const signature = ethUtils.ecsign(ethUtils.toBuffer(dropsRoot), coordinator_wallet.getPrivateKey());
    await rollupInstance.addAirdropBatch(dropsRoot, newRoot, signature, dropTokenType)
}
