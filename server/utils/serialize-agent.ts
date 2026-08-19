/** Prisma BigInt is not JSON-serializable; RAM/disk sizes fit in Number. */
export function serializeAgentBigints<T extends { memoryTotalBytes?: bigint | number | null }>(agent: T) {
    return {
        ...agent,
        memoryTotalBytes: agent.memoryTotalBytes == null ? null : Number(agent.memoryTotalBytes),
    }
}
