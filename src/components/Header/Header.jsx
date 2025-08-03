import { Share2 } from "lucide-react"
import "./Header.css"

const Header = () => {
  return (
    <header className="header">
      <div className="header-container">
        <div className="logo">
          <Share2 className="logo-icon" />
          <h1 className="logo-text">ShareFlow</h1>
        </div>
        <nav className="nav">
          <span className="nav-item">Professional File & Text Sharing</span>
        </nav>
      </div>
    </header>
  )
}

export default Header
