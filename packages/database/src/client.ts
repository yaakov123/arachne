import { PrismaClient } from '@prisma/client'

let prisma: PrismaClient | null = null

/**
 * Get the Prisma client instance (singleton)
 */
export function getPrismaClient(): PrismaClient {
    if (!prisma) {
        prisma = new PrismaClient({
            log:
                process.env.NODE_ENV === 'development'
                    ? ['query', 'info', 'warn', 'error']
                    : ['warn', 'error'],
            datasources: {
                db: {
                    url: process.env.DATABASE_URL || 'file:./dev.db',
                },
            },
        })
    }
    return prisma
}

/**
 * Close the Prisma client connection
 */
export async function closePrismaClient(): Promise<void> {
    if (prisma) {
        await prisma.$disconnect()
        prisma = null
    }
}

/**
 * Execute a function within a transaction
 */
export async function withTransaction<T>(
    fn: (
        prisma: Omit<
            PrismaClient,
            '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
        >
    ) => Promise<T>
): Promise<T> {
    const client = getPrismaClient()
    return client.$transaction(fn)
}

/**
 * Initialize database with optimized SQLite settings
 */
export async function initializeDatabase(): Promise<void> {
    const client = getPrismaClient()

    // Optimize SQLite for performance
    await client.$executeRaw`PRAGMA journal_mode = WAL`
    await client.$executeRaw`PRAGMA synchronous = NORMAL`
    await client.$executeRaw`PRAGMA cache_size = -64000` // 64MB cache
    await client.$executeRaw`PRAGMA temp_store = MEMORY`
    await client.$executeRaw`PRAGMA mmap_size = 134217728` // 128MB mmap
}
