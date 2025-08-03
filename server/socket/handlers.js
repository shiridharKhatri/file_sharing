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
          // For local network, check IP restrictions
          if (shareId === "local-network") {
            const clientIP = socket.handshake.address
            console.log(`Checking IP for local network: ${clientIP}`)
            const isLocalNetwork = isLocalNetworkIP(clientIP)

            if (!isLocalNetwork) {
              console.log(`IP ${clientIP} not in local network, denying access`)
              socket.emit("error", { message: "Access restricted to local network only" })
              return
            }
            console.log(`IP ${clientIP} allowed for local network`)
          }

          // Join the socket room
          socket.join(shareId)
          socket.shareId = shareId
          socket.username = username

          // Add user to active users
          const share = globalShares[shareId]
          if (!share.activeUsers.find((u) => u.socketId === socket.id)) {
            share.activeUsers.push({ socketId: socket.id, username })
          }

          console.log(`User ${username} joined ${shareId}. Active users: ${share.activeUsers.length}`)

          // Send current share state to the new user FIRST
          socket.emit("shareState", {
            textContent: share.textContent,
            language: share.language,
            activeUsers: share.activeUsers.length,
          })

          // Then notify other users
          socket.to(shareId).emit("userJoined", {
            socketId: socket.id,
            username,
            activeUsers: share.activeUsers.length,
          })

          return
        }

        // Handle private shares (database-stored)
        console.log(`Looking for private share: ${shareId}`)
        const share = await Share.findOne({ shareId })

        if (!share) {
          console.log(`Private share not found: ${shareId}`)
          socket.emit("error", { message: "Share not found" })
          return
        }

        console.log(`Found private share: ${shareId}, expired: ${share.isExpired}`)

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
        console.log(`User ${username} joined private share ${shareId}. Active users: ${share.activeUsers.length}`)

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
        console.log(`Text change from ${socket.id} in share ${shareId}`)

        if (socket.shareId !== shareId) {
          socket.emit("error", { message: "Not authorized for this share" })
          return
        }

        // Handle public and collaborative shares
        if (shareId === "public-global" || shareId === "local-network") {
          const share = globalShares[shareId]
          share.textContent = textContent
          if (language) share.language = language

          console.log(
            `Broadcasting text update in ${shareId} to ${io.sockets.adapter.rooms.get(shareId)?.size || 0} users`,
          )

          // Broadcast to ALL users in the same share, including the sender for confirmation
          io.to(shareId).emit("textUpdate", {
            textContent,
            language,
            updatedBy: socket.username,
            updatedAt: new Date(),
          })

          return
        }

        // Handle private shares
        console.log(`Updating private share: ${shareId}`)
        const share = await Share.findOne({ shareId })

        if (!share || share.isExpired) {
          console.log(`Private share not found or expired: ${shareId}`)
          socket.emit("error", { message: "Share not found or expired" })
          return
        }

        // Update the share content
        share.textContent = textContent
        if (language) share.language = language
        share.stats.edits += 1
        await share.save()

        console.log(`Broadcasting text update in private share ${shareId}`)

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
      console.log(`User ${socket.username} ${isTyping ? "started" : "stopped"} typing in ${shareId}`)

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
      console.log(`Files uploaded to ${shareId}:`, files.length)

      if (socket.shareId === shareId) {
        socket.to(shareId).emit("filesUploaded", { files })
      }
    })

    socket.on("fileDeleted", (data) => {
      const { fileId } = data
      console.log(`File deleted: ${fileId}`)

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
        console.log(`User disconnected: ${socket.id}`)

        if (socket.shareId) {
          // Handle public and collaborative shares
          if (socket.shareId === "public-global" || socket.shareId === "local-network") {
            const share = globalShares[socket.shareId]
            share.activeUsers = share.activeUsers.filter((u) => u.socketId !== socket.id)

            console.log(`User ${socket.username} left ${socket.shareId}. Active users: ${share.activeUsers.length}`)

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
            console.log(
              `User ${socket.username} left share ${socket.shareId}. Active users: ${share.activeUsers.length}`,
            )

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

// Helper function to check if IP is in local network
function isLocalNetworkIP(ip) {
  // Remove IPv6 prefix if present
  const cleanIP = ip.replace(/^::ffff:/, "")

  console.log(`Checking if IP ${cleanIP} is local network`)

  // Local network ranges
  const localRanges = [
    /^127\./, // 127.0.0.0/8 (localhost)
    /^10\./, // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
    /^192\.168\./, // 192.168.0.0/16
    /^::1$/, // IPv6 localhost
    /^fe80:/, // IPv6 link-local
  ]

  const isLocal = localRanges.some((range) => range.test(cleanIP)) || cleanIP === "::1"
  console.log(`IP ${cleanIP} is ${isLocal ? "local" : "not local"}`)

  return isLocal
}
