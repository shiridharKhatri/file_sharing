import Share from "../database/models/Share.js"

export function setupSocketHandlers(io) {
  // Store global shares in memory for public/collaborative modes
  const globalShares = {
    "public-global": {
      textContent: "",
      language: "plaintext",
      activeUsers: [],
    },
    "local-network": {
      textContent: "",
      language: "plaintext",
      activeUsers: [],
    },
  }

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`)

    socket.on("joinShare", async (data) => {
      try {
        const { shareId, username = "Anonymous" } = data
        console.log(`User ${socket.id} joining share: ${shareId}`)

        // Handle public and collaborative shares
        if (shareId === "public-global" || shareId === "local-network") {
          // For collaborative/local network, use flexible network checking
          if (shareId === "local-network") {
            const clientIP =
              socket.clientIP ||
              socket.handshake.headers["x-real-ip"] ||
              (socket.handshake.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
              socket.conn.remoteAddress ||
              socket.handshake.address

            // For maximum compatibility (like ssavr.com), you can make this even more permissive:
            // Just log the IP but allow most connections, only blocking obvious external/suspicious IPs

            const isSuspiciousIP = /^(0\.0\.0\.0|255\.255\.255\.255)$/.test(clientIP.replace(/^::ffff:/, ""))

            if (isSuspiciousIP) {
              socket.emit("error", {
                message: "Unable to verify network context for collaborative mode. Please try Public mode instead.",
                code: "NETWORK_VERIFICATION_FAILED",
                clientIP: clientIP,
              })
              return
            }

          }

          // Rest of the collaborative mode logic remains the same...
          socket.join(shareId)
          socket.shareId = shareId
          socket.username = username

          const share = globalShares[shareId]
          if (!share.activeUsers.find((u) => u.socketId === socket.id)) {
            share.activeUsers.push({ socketId: socket.id, username, ip: socket.clientIP })
          }

          socket.emit("shareState", {
            textContent: share.textContent,
            language: share.language,
            activeUsers: share.activeUsers.length,
          })

          socket.to(shareId).emit("userJoined", {
            socketId: socket.id,
            username,
            activeUsers: share.activeUsers.length,
          })

          return
        }

        const share = await Share.findOne({ shareId })

        if (!share) {
          socket.emit("error", { message: "Share not found" })
          return
        }

        if (share.isExpired) {
          console.log(`Private share expired: ${shareId}`)
          socket.emit("error", { message: "Share has expired" })
          return
        }

        if (share.activeUsers.length >= share.settings.maxUsers) {
          console.log(`Private share full: ${shareId}`)
          socket.emit("error", { message: "Share is full" })
          return
        }

        // Join the socket room
        socket.join(shareId)
        socket.shareId = shareId
        socket.username = username

        // Add user to active users
        await share.addActiveUser(socket.id, username)
        // Send current share state to the new user FIRST
        socket.emit("shareState", {
          textContent: share.textContent,
          language: share.language,
          title: share.title,
          activeUsers: share.activeUsers.length,
        })

        // Then notify other users
        socket.to(shareId).emit("userJoined", {
          socketId: socket.id,
          username,
          activeUsers: share.activeUsers.length,
        })
      } catch (error) {
        console.error("Join share error:", error)
        socket.emit("error", { message: "Failed to join share" })
      }
    })

    socket.on("textChange", async (data) => {
      try {
        const { shareId, textContent, language } = data
        if (socket.shareId !== shareId) {
          socket.emit("error", { message: "Not authorized for this share" })
          return
        }

        // Handle public and collaborative shares
        if (shareId === "public-global" || shareId === "local-network") {
          const share = globalShares[shareId]
          share.textContent = textContent
          if (language) share.language = language

          // Broadcast to ALL users in the same share, including the sender for confirmation
          io.to(shareId).emit("textUpdate", {
            textContent,
            language,
            updatedBy: socket.username,
            updatedAt: new Date(),
          })

          return
        }

        const share = await Share.findOne({ shareId })

        if (!share || share.isExpired) {
          socket.emit("error", { message: "Share not found or expired" })
          return
        }

        // Check if user is authorized to edit this private share
        const isAuthorizedUser = share.activeUsers.some((user) => user.socketId === socket.id)
        if (!isAuthorizedUser) {
          socket.emit("error", { message: "Not authorized to edit this share" })
          return
        }

        // Update the share content
        share.textContent = textContent
        if (language) share.language = language
        share.stats.edits += 1
        await share.save()

        // Broadcast to ALL users in the same share
        io.to(shareId).emit("textUpdate", {
          textContent,
          language,
          updatedBy: socket.username,
          updatedAt: new Date(),
        })
      } catch (error) {
        console.error("Text change error:", error)
        socket.emit("error", { message: "Failed to update text" })
      }
    })

    socket.on("typing", (data) => {
      const { shareId, isTyping } = data
      if (socket.shareId === shareId) {
        socket.to(shareId).emit("userTyping", {
          socketId: socket.id,
          username: socket.username,
          isTyping,
        })
      }
    })

    // Handle file upload events
    socket.on("filesUploaded", (data) => {
      const { shareId, files } = data
      if (socket.shareId === shareId) {
        socket.to(shareId).emit("filesUploaded", { files })
      }
    })

    socket.on("fileDeleted", (data) => {
      const { fileId } = data
      if (socket.shareId) {
        socket.to(socket.shareId).emit("fileDeleted", { fileId })
      }
    })

    socket.on("cursorMove", (data) => {
      const { shareId, position } = data

      if (socket.shareId === shareId) {
        socket.to(shareId).emit("cursorUpdate", {
          socketId: socket.id,
          username: socket.username,
          position,
        })
      }
    })

    socket.on("disconnect", async () => {
      try {
        if (socket.shareId) {
          // Handle public and collaborative shares
          if (socket.shareId === "public-global" || socket.shareId === "local-network") {
            const share = globalShares[socket.shareId]
            share.activeUsers = share.activeUsers.filter((u) => u.socketId !== socket.id)
            socket.to(socket.shareId).emit("userLeft", {
              socketId: socket.id,
              username: socket.username,
              activeUsers: share.activeUsers.length,
            })

            return
          }

          // Handle private shares
          const share = await Share.findOne({ shareId: socket.shareId })

          if (share) {
            await share.removeActiveUser(socket.id)

            socket.to(socket.shareId).emit("userLeft", {
              socketId: socket.id,
              username: socket.username,
              activeUsers: share.activeUsers.length,
            })
          }
        }
      } catch (error) {
        console.error("Disconnect error:", error)
      }
    })
  })
}

// FLEXIBLE IP checking function for collaborative mode - like ssavr.com
function isCollaborativeNetworkIP(ip) {
  // Remove IPv6 prefix if present
  const cleanIP = ip.replace(/^::ffff:/, "")

  // For collaborative mode, we'll be much more permissive
  // The idea is to allow users who are likely in the same "network context"

  // Always allow localhost and development IPs
  const alwaysAllowedPatterns = [
    /^127\./, // 127.0.0.0/8 (localhost)
    /^::1$/, // IPv6 localhost
    /^localhost$/,
    /^0\.0\.0\.0$/, // Sometimes shows as this
  ]

  if (alwaysAllowedPatterns.some((pattern) => pattern.test(cleanIP))) {
    console.log(`IP ${cleanIP} allowed - localhost/development`)
    return true
  }

  // For production/hosted environments, allow broader ranges
  // This mimics how ssavr.com works - more permissive collaborative sharing
  const collaborativeRanges = [
    // Traditional private networks
    /^10\./, // 10.0.0.0/8 (Class A private)
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12 (Class B private)
    /^192\.168\./, // 192.168.0.0/16 (Class C private)

    // Cloud and hosting provider ranges (common in modern deployments)
    /^172\./, // Docker containers and cloud providers
    /^100\./, // Some cloud providers
    /^198\./, // Some hosting providers
    /^203\./, // Some regional networks

    // Link-local and special ranges
    /^169\.254\./, // 169.254.0.0/16 (Link-local)
    /^224\./, // Multicast (sometimes used in corporate networks)

    // IPv6 ranges
    /^fe80:/, // IPv6 link-local
    /^fc00:/, // IPv6 unique local
    /^fd00:/, // IPv6 unique local

    // For hosted applications, allow same subnet patterns
    // This is key for making it work like ssavr.com
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9]?)$/, // Any valid IP in development
  ]

  // In production, if we're running on a server, be more permissive
  // This allows users from the same hosting environment/region to collaborate
  const isProduction = process.env.NODE_ENV === "production"

  if (isProduction) {
    // Allow any private network range
    const productionRanges = [/^10\./, /^172\./, /^192\.168\./, /^100\./, /^198\./, /^203\./, /^169\.254\./]

    const isAllowed = productionRanges.some((range) => range.test(cleanIP))
    if (isAllowed) {
      console.log(`IP ${cleanIP} allowed for production collaborative mode`)
      return true
    }

    // For production, also allow based on IP similarity (same class C network)
    // This helps users in the same general network area collaborate
    const ipParts = cleanIP.split(".")
    if (ipParts.length === 4) {
      const classC = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`
      // You could store and compare class C networks here for more sophisticated matching
      return true // For now, allow all valid IPs in production
    }
  }

  const isLocal = collaborativeRanges.some((range) => range.test(cleanIP))
  console.log(`IP ${cleanIP} is ${isLocal ? "collaborative network" : "external"} - ${isLocal ? "ALLOWED" : "BLOCKED"}`)

  return isLocal
}
