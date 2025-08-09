import Share from "../database/models/Share.js"

const subnetWhitelist = new Set()

function getClientIP(socket) {
  const rawIP =
    socket.handshake.headers["x-forwarded-for"] ||
    socket.handshake.address ||
    socket.conn.remoteAddress ||
    ""

  return rawIP.replace(/^.*:/, "").trim()
}

function getClassCSubnet(ip) {
  const parts = ip.split(".")
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}` : null
}

export function setupSocketHandlers(io) {
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

        // Handle public or collaborative (local-network) shares
        if (shareId === "public-global" || shareId === "local-network") {
          const clientIP = getClientIP(socket)
          const subnet = getClassCSubnet(clientIP)

          if (!subnet) {
            socket.emit("error", {
              message: "Could not determine your network",
              code: "INVALID_IP_FORMAT",
              clientIP,
            })
            return
          }

          // Dynamic collaborative subnet handling
          if (shareId === "local-network") {
            if (subnetWhitelist.size === 0) {
              subnetWhitelist.add(subnet)
              console.log(`Collaborative subnet initialized to: ${subnet}`)
            }

            if (!subnetWhitelist.has(subnet)) {
              console.log(`Blocked user ${clientIP} - outside of subnet(s): ${[...subnetWhitelist].join(", ")}`)
              socket.emit("error", {
                message: "You are not on the same local network as others.",
                code: "NOT_ON_LOCAL_NETWORK",
                clientIP,
              })
              return
            }
          }

          // Accept the user
          socket.join(shareId)
          socket.shareId = shareId
          socket.username = username

          const share = globalShares[shareId]

          if (!share.activeUsers.find((u) => u.socketId === socket.id)) {
            share.activeUsers.push({ socketId: socket.id, username, ip: clientIP })
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

        // Private share logic (unchanged)
        const share = await Share.findOne({ shareId })

        if (!share) {
          socket.emit("error", { message: "Share not found" })
          return
        }

        if (share.isExpired) {
          socket.emit("error", { message: "Share has expired" })
          return
        }

        if (share.activeUsers.length >= share.settings.maxUsers) {
          socket.emit("error", { message: "Share is full" })
          return
        }

        socket.join(shareId)
        socket.shareId = shareId
        socket.username = username

        await share.addActiveUser(socket.id, username)

        socket.emit("shareState", {
          textContent: share.textContent,
          language: share.language,
          title: share.title,
          activeUsers: share.activeUsers.length,
        })

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

        if (shareId === "public-global" || shareId === "local-network") {
          const share = globalShares[shareId]
          share.textContent = textContent
          if (language) share.language = language

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

        const isAuthorizedUser = share.activeUsers.some((user) => user.socketId === socket.id)
        if (!isAuthorizedUser) {
          socket.emit("error", { message: "Not authorized to edit this share" })
          return
        }

        share.textContent = textContent
        if (language) share.language = language
        share.stats.edits += 1
        await share.save()

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
