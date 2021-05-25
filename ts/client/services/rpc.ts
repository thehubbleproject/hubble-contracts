import { arrayify } from "@ethersproject/bytes";
import fastify, { FastifyInstance } from "fastify";
import { CoreAPI } from "../coreAPI";
import { TransferOffchainTx } from "../features/transfer";

async function helloHandler(request: any, reply: any) {
    return { hello: "world" };
}

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
    server: FastifyInstance;

    constructor(server: FastifyInstance) {
        this.server = server;
    }

    static async init(
        { l2Storage, transferPool }: CoreAPI,
        port: number
    ): Promise<RPC> {
        const server = fastify({ logger: true });
        server.setErrorHandler(console.error);

        server.register(async (fastify: FastifyInstance) => {
            fastify.get("/", helloHandler);
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
                async request => {
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
        });
        try {
            const address = await server.listen(port);
            console.info("Started rest api server", { address });
        } catch (e) {
            console.error("Failed to start rest api server", e);
            throw e;
        }
        return new RPC(server);
    }

    /**
     * Close the server instance.
     */
    async close(): Promise<void> {
        await this.server.close();
    }
}
