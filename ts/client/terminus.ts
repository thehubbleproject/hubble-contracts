import { createTerminus } from "@godaddy/terminus";
import { Server } from "http";
import { sleep } from "../utils";
import { HubbleNode } from "./node";

/**
 * HTTP/Proccess lifecycle controller
 * https://github.com/godaddy/terminus
 *
 * @param node HubbleNode to manage
 * @param server HTTP Server to manage
 */
export const terminus = (node: HubbleNode, server: Server) => {
    createTerminus(server, {
        // https://github.com/godaddy/terminus#how-to-set-terminus-up-with-kubernetes
        beforeShutdown: async () => sleep(5000),
        onSignal: async () => {
            console.log("shutting down");
            await node.close();
        },
        onShutdown: async () => {
            console.log("shutdown complete");
        },
        healthChecks: {
            "/health": async () => {
                // no-op, HTTP 200
            }
        }
    });
};
