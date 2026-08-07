import { Link, NavLink } from 'react-router-dom'

function Header() {
  return (
    <header id="header">
      <div id="search-container">
        <Link to="/">
          <img src="/assets/prototype.png" alt="My Motor Shop" />
        </Link>
        <input type="text" placeholder="Input something.." name="search" />
        <button type="submit"><i className="fa fa-search"></i>Search</button>
      </div>
      <div id="nav-container">
        <nav>
          <NavLink to="/" end>Homepage</NavLink>
          <NavLink to="/blog">Blog</NavLink>
          <NavLink to="/contact">Contact</NavLink>
          <NavLink to="/feedback">Feedback</NavLink>
        </nav>
      </div>
      <div id="header-banner">
        <img src="/assets/capture.png" alt="Banner" />
        <ul>
          <p>GIAO HÀNG TOÀN QUỐC<br />Shipcode theo yêu cầu</p>
          <p>ĐIỆN THOẠI<br />036 591 3732</p>
          <p>CHAT VỚI CHÚNG TÔI<br />036 591 3732</p>
          <p>MUA BÁN, KÝ GỬI<br />Xe và các sản phẩm liên quan</p>
        </ul>
      </div>
    </header>
  )
}

export default Header
