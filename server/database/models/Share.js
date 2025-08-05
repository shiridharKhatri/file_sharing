import mongoose from "mongoose"

const shareSchema = new mongoose.Schema(
  {
    shareId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    mode: {
      type: String,
      enum: ["global", "collaborative", "private"],
      required: true,
    },
    title: {
      type: String,
      default: "Untitled Share",
    },
    textContent: {
      type: String,
      default: "",
    },
    language: {
      type: String,
      default: "plaintext",
    },
    password: {
      type: String,
      default: null,
      validate: {
        validator: function (v) {
          if (this.mode === "private") {
            return v && v.length > 10
          }
          return true
        },
        message: "Private shares must have a valid password hash",
      },
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    files: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "File",
      },
    ],
    activeUsers: [
      {
        socketId: String,
        username: String,
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    settings: {
      allowEdit: { type: Boolean, default: true },
      allowDownload: { type: Boolean, default: true },
      maxUsers: { type: Number, default: 10 },
    },
    stats: {
      views: { type: Number, default: 0 },
      downloads: { type: Number, default: 0 },
      edits: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  },
)

shareSchema.pre("save", function (next) {
  if (this.isModified("password")) {
    console.log("=== SAVING SHARE WITH PASSWORD ===")
    console.log("ShareId:", this.shareId)
    console.log("Mode:", this.mode)
    console.log("Password field exists:", !!this.password)
    console.log("Password length:", this.password ? this.password.length : 0)
    console.log("Password starts with:", this.password ? this.password.substring(0, 10) : "null")
  }
  next()
})

shareSchema.virtual("isExpired").get(function () {
  return new Date() > this.expiresAt
})

shareSchema.set("toObject", { virtuals: true })
shareSchema.set("toJSON", { virtuals: true })

shareSchema.methods.addActiveUser = function (socketId, username = "Anonymous") {
  const existingUser = this.activeUsers.find((user) => user.socketId === socketId)
  if (!existingUser) {
    this.activeUsers.push({ socketId, username })
    return this.save()
  }
  return Promise.resolve(this)
}

shareSchema.methods.removeActiveUser = function (socketId) {
  this.activeUsers = this.activeUsers.filter((user) => user.socketId !== socketId)
  return this.save()
}

export default mongoose.model("Share", shareSchema)
