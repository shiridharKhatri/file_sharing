"use client"

import { useContext } from "react"
import { ShareContext } from "../context/ShareContext"

export function useShare() {
  const context = useContext(ShareContext)

  if (!context) {
    throw new Error("useShare must be used within a ShareProvider")
  }

  return context
}

export default useShare
