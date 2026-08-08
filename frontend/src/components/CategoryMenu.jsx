import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

function CategoryMenu() {
  const [categories, setCategories] = useState([])

  useEffect(() => {
    fetch('/api/products/categories/')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(setCategories)
      .catch((err) => console.error('Error loading categories:', err))
  }, [])

  return (
    <div id="menu" className="menu">
      <ul>
        <li className="menu-title">Danh mục sản phẩm</li>
        {categories.map((cat) => (
          <li key={cat}>
            <Link to="/">{cat}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default CategoryMenu
