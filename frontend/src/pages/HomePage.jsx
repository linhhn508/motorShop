import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import CategoryMenu from '../components/CategoryMenu'
import Pagination from '../components/Pagination'

const ITEMS_PER_PAGE = 10

function HomePage() {
  const [products, setProducts] = useState([])
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    fetch('/api/products/')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(setProducts)
      .catch((err) => console.error('Error loading products:', err))
  }, [])

  const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedProducts = products.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  return (
    <div className="container">
      <CategoryMenu />
      <div className="content">
        <h3>SẢN PHẨM MỚI NHẤT</h3>
        <div id="product_list" className="product-grid">
          {paginatedProducts.map((product) => (
            <li key={product.id} style={{ listStyle: 'none' }}>
              <div className="product-item">
                <Link to={`/product/${product.id}`}>
                  <img
                    src={`/images/${product.id}/thumbnail.png`}
                    alt={product.name}
                  />
                  <h4>{product.name}</h4>
                </Link>
                <p>{product.price} VNĐ</p>
              </div>
            </li>
          ))}
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  )
}

export default HomePage
