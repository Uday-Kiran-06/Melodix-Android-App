/**
 * Serialized TrackPlayer Queue Controller
 * 
 * Guarantees that at most one logical queue mutation modifies the native TrackPlayer
 * queue at a time. Operations are queued in FIFO order and executed sequentially.
 * Network and filesystem operations MUST be performed before entering queueController.run().
 */

export class QueueController {
    private queuePromise: Promise<any> = Promise.resolve();

    /**
     * Executes a queue mutation task in strict serialized order.
     * @param operation Async task containing the atomic queue inspection and mutation logic.
     * @returns Promise resolving with the result of the operation.
     */
    public run<T>(operation: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.queuePromise = this.queuePromise
                .then(async () => {
                    try {
                        const result = await operation();
                        resolve(result);
                    } catch (error) {
                        console.error('[QueueController]: Operation failed:', error);
                        reject(error);
                    }
                })
                .catch((error) => {
                    // Ensure the promise chain does not break if an unhandled error occurs
                    console.error('[QueueController]: Unexpected chain error:', error);
                    reject(error);
                });
        });
    }
}

export const queueController = new QueueController();
