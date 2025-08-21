import { disableSystemProxy } from '@arachne/proxy'

export async function cleanup() {
    await disableSystemProxy()
}

cleanup().catch((err) => {
    console.error(err)
    process.exit(1)
})
