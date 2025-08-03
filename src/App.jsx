"use client"

import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import { ShareProvider } from "./context/ShareContext"
import ShareFlowApp from "./components/ShareFlowApp"
import ShareViewer from "./components/ShareViewer"
import "./App.css"

function App() {
  return (
    <ShareProvider>
      <Router>
        <Routes>
          <Route path="/" element={<ShareFlowApp />} />
          <Route path="/share/:shareId" element={<ShareViewer />} />
        </Routes>
      </Router>
    </ShareProvider>
  )
}

export default App
