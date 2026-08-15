/**
 * Agent enrollment/auth secret helpers.
 *
 * Enrollment tokens and long-lived auth keys are random 256-bit values shown
 * to the operator/agent exactly once and stored only as a salted hash — the
 * server never needs to recover the plaintext, so hash-and-verify (not
 * encryption-at-rest) is the right primitive here.
 */
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

/** Generates a random 256-bit secret, hex-encoded. */
export function generateSecret(): string {
    return randomBytes(32).toString('hex')
}

/** Hashes a secret as `salt:derivedKey` (hex), suitable for storing in *Hash columns. */
export async function hashSecret(secret: string): Promise<string> {
    const salt = randomBytes(16)
    const derived = (await scryptAsync(secret, salt, 64)) as Buffer
    return `${salt.toString('hex')}:${derived.toString('hex')}`
}

/** Verifies a secret against a stored `salt:derivedKey` hash using a constant-time comparison. */
export async function verifySecret(secret: string, stored: string | null | undefined): Promise<boolean> {
    if (!stored) return false
    const [saltHex, derivedHex] = stored.split(':')
    if (!saltHex || !derivedHex) return false

    const salt = Buffer.from(saltHex, 'hex')
    const expected = Buffer.from(derivedHex, 'hex')
    const actual = (await scryptAsync(secret, salt, expected.length)) as Buffer

    return actual.length === expected.length && timingSafeEqual(actual, expected)
}
