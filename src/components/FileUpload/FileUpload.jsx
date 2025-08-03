"use client"

import { useRef, useState } from "react"
import { Upload, File, X } from "lucide-react"
import { formatFileSize } from "../../utils/fileUtils"
import "./FileUpload.css"

const FileUpload = ({ files, onFilesChange }) => {
  const fileInputRef = useRef(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    addFiles(droppedFiles)
  }

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files)
    addFiles(selectedFiles)
  }

  const addFiles = (newFiles) => {
    const filesWithId = newFiles.map((file) => ({
      id: Date.now() + Math.random(),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
    }))
    onFilesChange([...files, ...filesWithId])
  }

  const removeFile = (fileId) => {
    onFilesChange(files.filter((f) => f.id !== fileId))
  }

  return (
    <div className="file-upload">
      <h3 className="upload-title">File Upload</h3>

      <div
        className={`upload-area ${isDragOver ? "drag-over" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="upload-icon" />
        <p className="upload-text">
          Drag & drop files here or <span className="upload-link">browse</span>
        </p>
        <p className="upload-subtext">Support for any file type</p>
      </div>

      <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="file-input" />

      {files.length > 0 && (
        <div className="file-list">
          <h4 className="file-list-title">Selected Files ({files.length})</h4>
          {files.map((fileItem) => (
            <div key={fileItem.id} className="file-item">
              <File className="file-icon" />
              <div className="file-info">
                <span className="file-name">{fileItem.name}</span>
                <span className="file-size">{formatFileSize(fileItem.size)}</span>
              </div>
              <button className="remove-file" onClick={() => removeFile(fileItem.id)}>
                <X className="remove-icon" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default FileUpload
