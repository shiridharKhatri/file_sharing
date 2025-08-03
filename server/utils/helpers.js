import crypto from "crypto"

export function generateShareId() {
  return crypto.randomBytes(8).toString("hex")
}

export function calculateExpiryDate(expiry) {
  const now = new Date()

  switch (expiry) {
    case "10min":
      return new Date(now.getTime() + 10 * 60 * 1000)
    case "1hr":
      return new Date(now.getTime() + 60 * 60 * 1000)
    case "6hr":
      return new Date(now.getTime() + 6 * 60 * 60 * 1000)
    case "24hr":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000)
    case "7d":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    case "never":
      return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
    default:
      return new Date(now.getTime() + 60 * 60 * 1000)
  }
}
