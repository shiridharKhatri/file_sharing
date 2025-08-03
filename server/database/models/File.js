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
  },
  {
    timestamps: true,
  },
)

fileSchema.index({ shareId: 1 })

export default mongoose.model("File", fileSchema)
