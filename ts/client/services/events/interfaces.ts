/**
 * Represents an object that can sync L1 events
 * to local state (L2).
 */
export interface EventSyncer {
    /**
     * Syncs events from L1 to local state (L2)
     * for a given range of blocks.
     *
     * @param startBlock The block number to start searching from.
     * @param endBlock  The block number to search to.
     */
    initialSync(startBlock: number, endBlock: number): Promise<void>;
    /**
     * Starts listening for new events to sync.
     */
    listen(): void;
    /**
     * Stops listening for new events to sync.
     */
    stopListening(): void;
}
