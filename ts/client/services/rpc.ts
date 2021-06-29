import { arrayify } from "@ethersproject/bytes";
import { FastifyInstance } from "fastify";
import { CoreAPI } from "../coreAPI";
import { ITransferPool, TransferOffchainTx } from "../features/transfer";

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
        fastify.get<{ Params: { stateID: number } }>(
            "/user/state/:stateID",
            async function(request) {
                const stateID = request.params.stateID;
                const state = await l2Storage.state.get(stateID);
                return state.toJSON();
            }
        );
        fastify.post<{ Body: { bytes: string } }>(
            "/tx",
            tx,
            async (request, reply) => {
                if (!transferPool) {
                    reply.status(409).send("not a proposer");
                    return;
                }

                const bytes = arrayify(request.body.bytes);
                const transfer = TransferOffchainTx.deserialize(bytes);
                console.log(transfer.toString());

                await transferPool.push(transfer);
                await l2Storage.transactions.pending(transfer);
                return { txHash: transfer.hash() };
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
                return JSON.stringify(txStatus);
            }
        );
    }
}
