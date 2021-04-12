import { arrayify } from "@ethersproject/bytes";
import fastify, { FastifyInstance } from "fastify";
import { TransferOffchainTx } from "../features/transfer";
import { StorageManager } from "../storageEngine";

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
        port: number,
        storageManager: StorageManager
    ): Promise<RPC> {
        const server = fastify({ logger: true });
        server.setErrorHandler(console.log);

        server.register(async function(fastify: FastifyInstance) {
            fastify.get("/", helloHandler);
            fastify.get("/user/state/:stateID", async function(
                request: any,
                reply: any
            ) {
                const stateID = request.params.stateID;
                const state = await storageManager.state.get(stateID);
                return state.toJSON();
            });
            fastify.post("/tx", tx, async function(request: any, reply: any) {
                const bytes = arrayify(request.body.bytes);
                const transfer = TransferOffchainTx.deserialize(bytes);
                console.log(transfer.toString());
            });
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
