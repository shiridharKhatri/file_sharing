import mongoose from "mongoose"

const fileSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      required: true,
    },
    filename: {
      type: String,
      required: true,
    },
    path: {
      type: String,
      required: true,
    },
    mimetype: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    shareId: {
      type: String,
      required: true,
    },
    uploadedBy: {
      type: String,
      default: "Anonymous",
    },
    downloads: {
      type: Number,
      default: 0,
    },
    // Auto-delete files after 12 hours
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now
      index: { expireAfterSeconds: 0 }, // MongoDB TTL index
    },
  },
  {
    timestamps: true,
  },
)

fileSchema.index({ shareId: 1 })
fileSchema.index({ expiresAt: 1 }) // Index for cleanup job

export default mongoose.model("File", fileSchema)
