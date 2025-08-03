"use client"

import { Loader2 } from "lucide-react"
import "./LoadingOverlay.css"

const LoadingOverlay = () => {
  return (
    <div className="loading-overlay">
      <div className="loading-modal">
        <div className="loading-spinner">
          <Loader2 size={32} className="spinning" />
        </div>
        <div className="loading-content">
          <h3 className="loading-title">Processing Request</h3>
          <p className="loading-description">Generating secure share link and preparing your content...</p>
        </div>
      </div>
    </div>
  )
}

export default LoadingOverlay
