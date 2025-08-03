"use client"

import { useEffect } from "react"
import { CheckCircle, AlertCircle, Info, X } from "lucide-react"
import "./Toast.css"

const Toast = ({ message, type = "success", onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  const config = {
    success: {
      icon: CheckCircle,
      className: "toast-success",
    },
    error: {
      icon: AlertCircle,
      className: "toast-error",
    },
    info: {
      icon: Info,
      className: "toast-info",
    },
  }

  const { icon: IconComponent, className } = config[type]

  return (
    <div className={`toast ${className}`}>
      <div className="toast-content">
        <div className="toast-icon">
          <IconComponent size={18} />
        </div>
        <span className="toast-message">{message}</span>
      </div>
      <button className="toast-close" onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  )
}

export default Toast
