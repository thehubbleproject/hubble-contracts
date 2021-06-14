import { ContractTransaction } from "ethers";
import { assert, expect } from "chai";

export async function expectRevert(
    tx: Promise<ContractTransaction>,
    revertReason: string
) {
    await tx.then(
        () => {
            assert.fail(`Expect tx to fail with reason: ${revertReason}`);
        },
        error => {
            expect(error.message).to.have.string(revertReason);
        }
    );
}

export async function expectCallRevert(
    tx: Promise<any>,
    revertReason: string | null
) {
    await tx.then(
        () => {
            assert.fail(`Expect tx to fail with reason: ${revertReason}`);
        },
        error => {
            if (revertReason === null) {
                assert.isNull(error.reason);
            } else {
                expect(error.reason).to.have.string(revertReason);
            }
        }
    );
}
