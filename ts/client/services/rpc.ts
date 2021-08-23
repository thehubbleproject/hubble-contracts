import { arrayify } from "@ethersproject/bytes";
import { FastifyInstance } from "fastify";
import { CoreAPI } from "../coreAPI";
import { Pubkey2StatesDB } from "../database/pubkey2states";
import { ITransferPool, TransferOffchainTx } from "../features/transfer";
import cors from "fastify-cors";

const tx = {
    schema: {
        body: {
            type: "object",
            properties: {
                bytes: { type: "string" }
            }
        }
    }
};

export class RPC {
    constructor(
        { l2Storage }: CoreAPI,
        fastify: FastifyInstance,
        transferPool?: ITransferPool
    ) {
        fastify.register(cors, {
            origin: "*"
        });
        fastify.get<{ Params: { stateID: number } }>(
            "/user/state/:stateID",
            async function(request, reply) {
                try {
                    const { stateID } = request.params;
                    const state = await l2Storage.state.get(stateID);
                    return state.toJSON();
                } catch (error) {
                    if (error.name === "NotFoundError") {
                        return reply
                            .status(404)
                            .send({ error: "pubkey not found" });
                    } else {
                        console.error(error);
                        return reply.status(500);
                    }
                }
            }
        );
        fastify.get<{ Params: { pubkeyHash: string } }>(
            "/user/state/pubkey/:pubkeyHash",
            async function(request, reply) {
                try {
                    const { pubkeyHash } = request.params;
                    const stateIndices = await Pubkey2StatesDB.getStates(
                        pubkeyHash
                    );
                    let data = stateIndices.map(async id => {
                        let state = await l2Storage.state.get(Number(id));
                        return {
                            stateId: id,
                            balance: state.balance.toString(),
                            tokenId: state.tokenID.toString(),
                            nonce: state.nonce.toString()
                        };
                    });
                    return { states: await Promise.all(data) };
                } catch (error) {
                    if (error.name === "NotFoundError") {
                        return reply
                            .status(404)
                            .send({ error: "pubkey not found" });
                    } else {
                        console.error(error);
                        return reply.status(500);
                    }
                }
            }
        );
        fastify.get<{ Params: { pubkeyID: number } }>(
            "/user/pubkey/hash/:pubkeyID",
            async function(request, reply) {
                try {
                    const { pubkeyID } = request.params;
                    const pubkey = await l2Storage.pubkey.get(pubkeyID);
                    return { hash: pubkey.hash() };
                } catch (error) {
                    return reply
                        .status(404)
                        .send({ error: "pubkey not found" });
                }
            }
        );
        fastify.get<{ Params: { pubkeyHash: string } }>(
            "/user/pubkey/id/:pubkeyHash",
            async function(request, reply) {
                try {
                    const { pubkeyHash } = request.params;
                    const stateIndices = await Pubkey2StatesDB.getStates(
                        pubkeyHash
                    );
                    let data = await l2Storage.state.get(
                        Number(stateIndices[0])
                    );
                    return { id: data.pubkeyID.toNumber() };
                } catch (error) {
                    if (error.name === "NotFoundError") {
                        return reply
                            .status(404)
                            .send({ error: "pubkey not found" });
                    } else {
                        console.error(error);
                        return reply.status(500);
                    }
                }
            }
        );
        fastify.post<{ Body: { bytes: string } }>(
            "/tx",
            tx,
            async (request, reply) => {
                try {
                    if (!transferPool) {
                        reply.status(409).send("not a proposer");
                        return;
                    }

                    const bytes = arrayify(request.body.bytes);
                    const transfer = TransferOffchainTx.deserialize(bytes);
                    await transferPool.push(transfer);
                    await l2Storage.transactions.pending(transfer);
                    return { txHash: transfer.hash() };
                } catch (error) {
                    console.error(error);
                    return reply.status(500);
                }
            }
        );
        fastify.get<{ Params: { txMsg: string } }>(
            "/tx/:txMsg",
            async (request, reply) => {
                const { txMsg } = request.params;
                const txStatus = await l2Storage.transactions.get(txMsg);
                if (!txStatus) {
                    reply.status(404).send(`${txMsg} not found`);
                    return;
                }
                // In the future, we may want to clean up
                // this JSON serialization to something more minimal.
                return JSON.stringify({
                    status: txStatus.status,
                    l1BlockIncluded: txStatus.l1BlockIncluded,
                    l1TxnHash: txStatus.l1TxnHash
                });
            }
        );
    }
}
