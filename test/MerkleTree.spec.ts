import { MerkleTreeUtils } from "../types/ethers-contracts/MerkleTreeUtils";
import { getParentLeaf, getMerkleRootFromLeaves } from "../ts/utils";
import { assert, expect } from "chai";
import { ethers } from "@nomiclabs/buidler";

// Test all stateless operations
describe("MerkleTreeUtils", async function() {
    const dataBlocks = ["0x123", "0x334", "0x4343", "0x334"].map(
        ethers.utils.formatBytes32String
    );
    const dataLeaves = dataBlocks.map(ethers.utils.keccak256);
    let mtlibInstance: MerkleTreeUtils;
    before(async function() {
        const MAX_DEPTH = 4;
        const factory = await ethers.getContractFactory("MerkleTreeUtils");
        mtlibInstance = (await factory.deploy(MAX_DEPTH)) as MerkleTreeUtils;
    });

    it("ensure root created on-chain and via utils is the same", async function() {
        const maxSize = 4;
        const numberOfDataLeaves = 2 ** maxSize;
        const dummyHash =
            "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563";
        for (let i = 1; i < numberOfDataLeaves; i++) {
            const leaves = Array(i).fill(dummyHash);
            const rootFromContract = await mtlibInstance.getMerkleRootFromLeaves(
                leaves
            );
            const rootFromJs = await getMerkleRootFromLeaves(leaves, maxSize);
            assert.equal(
                rootFromContract,
                rootFromJs,
                `Mismatch off-chain and on-chain roots. Leave length is ${i}`
            );
        }
    });

    it("[LEAF] [STATELESS] verifying correct proof", async function() {
        var root = await mtlibInstance.getMerkleRoot(dataBlocks);

        var siblings: Array<string> = [
            dataLeaves[1],
            getParentLeaf(dataLeaves[2], dataLeaves[3])
        ];

        var leaf = dataLeaves[0];

        var path: string = "00";

        var isValid = await mtlibInstance.verifyLeaf(
            root,
            leaf,
            path,
            siblings
        );

        expect(isValid).to.be.deep.eq(true);
    });

    it("[LEAF] [STATELESS] verifying proof with wrong path", async function() {
        // create merkle tree and get root
        var root = await mtlibInstance.getMerkleRoot(dataBlocks);
        var siblings: Array<string> = [
            dataLeaves[1],
            getParentLeaf(dataLeaves[2], dataLeaves[3])
        ];
        var leaf = dataLeaves[0];
        var path: string = "01";
        var isValid = await mtlibInstance.verifyLeaf(
            root,
            leaf,
            path,
            siblings
        );
        expect(isValid).to.be.deep.eq(false);
    });

    it("[DATABLOCK] [STATELESS] verifying proof with wrong path", async function() {
        // create merkle tree and get root
        var root = await mtlibInstance.getMerkleRoot(dataBlocks);

        var siblings: Array<string> = [
            dataLeaves[1],
            getParentLeaf(dataLeaves[2], dataLeaves[3])
        ];
        var leaf = dataLeaves[0];
        var path: string = "01";
        var isValid = await mtlibInstance.verifyLeaf(
            root,
            leaf,
            path,
            siblings
        );
        expect(isValid).to.be.deep.eq(false);
    });

    it("[LEAF] [STATELESS] verifying other leaves", async function() {
        var root = await mtlibInstance.getMerkleRoot(dataBlocks);

        var siblings: Array<string> = [
            dataLeaves[0],
            getParentLeaf(dataLeaves[2], dataLeaves[3])
        ];
        var leaf = dataLeaves[1];
        var path: string = "01";
        var isValid = await mtlibInstance.verifyLeaf(
            root,
            leaf,
            path,
            siblings
        );
        expect(isValid).to.be.deep.eq(true);
    });

    it("[DATABLOCK] [STATELESS] verifying other leaves", async function() {
        var root = await mtlibInstance.getMerkleRoot(dataBlocks);

        var siblings: Array<string> = [
            dataLeaves[0],
            getParentLeaf(dataLeaves[2], dataLeaves[3])
        ];
        var leaf = dataLeaves[1];
        var path: string = "01";
        var isValid = await mtlibInstance.verifyLeaf(
            root,
            leaf,
            path,
            siblings
        );
        expect(isValid).to.be.deep.eq(true);
    });

    it("[DATABLOCK] [STATELESS] path greater than depth", async function() {
        var root = await mtlibInstance.getMerkleRoot(dataBlocks);

        var siblings: Array<string> = [
            dataLeaves[0],
            getParentLeaf(dataLeaves[2], dataLeaves[3])
        ];
        var leaf = dataLeaves[1];
        var path: string = "010";
        var isValid = await mtlibInstance.verifyLeaf(
            root,
            leaf,
            path,
            siblings
        );

        // TODO fix
        expect(isValid).to.be.deep.eq(false);
    });
});
