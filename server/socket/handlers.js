import Share from "../database/models/Share.js"

export function setupSocketHandlers(io) {
  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`)

    socket.on("joinShare", async (data) => {
      try {
        const { shareId, username = "Anonymous" } = data

        const share = await Share.findOne({ shareId })

        if (!share || share.isExpired) {
          socket.emit("error", { message: "Share not found or expired" })
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

        socket.to(shareId).emit("userJoined", {
          socketId: socket.id,
          username,
          activeUsers: share.activeUsers.length + 1,
        })

        socket.emit("shareState", {
          textContent: share.textContent,
          language: share.language,
          title: share.title,
          activeUsers: share.activeUsers.length + 1,
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

        const share = await Share.findOne({ shareId })

        if (!share || share.isExpired) {
          socket.emit("error", { message: "Share not found or expired" })
          return
        }

        share.textContent = textContent
        if (language) share.language = language
        share.stats.edits += 1
        await share.save()

        socket.to(shareId).emit("textUpdate", {
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

    socket.on("disconnect", async () => {
      try {
        if (socket.shareId) {
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

        console.log(`User disconnected: ${socket.id}`)
      } catch (error) {
        console.error("Disconnect error:", error)
      }
    })
  })
}
