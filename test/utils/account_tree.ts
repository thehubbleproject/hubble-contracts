import { Tree } from './tree';
import { BLSAccountRegistryInstance } from '../../types/truffle-contracts';

export class AccountRegistry {
  treeLeft: Tree;
  treeRight: Tree;
  // TODO: must be big int
  leftIndex: number = 0;
  rigthIndex: number = 0;
  setSize: number;

  public static async new(registry: BLSAccountRegistryInstance): Promise<AccountRegistry> {
    const depth = (await registry.DEPTH()).toNumber();
    const batchDepth = (await registry.BATCH_DEPTH()).toNumber();
    return new AccountRegistry(registry, depth, batchDepth);
  }
  constructor(
    private readonly registry: BLSAccountRegistryInstance,
    private readonly depth: number,
    private readonly batchDepth: number
  ) {
    this.treeLeft = Tree.new(depth);
    this.treeRight = Tree.new(depth);
    this.setSize = 1 << depth;
  }

  public async register(pubkey: string[]): Promise<number> {
    const accountID = (await this.registry.leafIndexLeft()).toNumber();
    await this.registry.register(pubkey);
    const leaf = this.pubkeyToLeaf(pubkey);
    this.treeLeft.updateSingle(accountID, leaf);
    const _witness = this.witness(accountID);
    assert.isTrue(await this.registry.exists(accountID, pubkey, _witness));
    return accountID;
  }

  public witness(accountID: number): string[] {
    // TODO: right?
    return this.treeLeft.witness(accountID).nodes;
  }

  public pubkeyToLeaf(uncompressed: string[]) {
    const leaf = web3.utils.soliditySha3(
      { t: 'uint256', v: uncompressed[0] },
      { t: 'uint256', v: uncompressed[1] },
      { t: 'uint256', v: uncompressed[2] },
      { t: 'uint256', v: uncompressed[3] }
    );
    return leaf;
  }
}
