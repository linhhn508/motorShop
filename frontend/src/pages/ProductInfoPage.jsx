import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import CategoryMenu from '../components/CategoryMenu'
import '../styles/product_info.css'

function ProductInfoPage() {
  const { productId } = useParams()
  const [product, setProduct] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`/api/products/${productId}/info`)
      .then((res) => {
        if (res.status === 404) {
          setError('Sản phẩm không tồn tại.')
          return null
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (data) setProduct(data)
      })
      .catch((err) => {
        setError('Đã xảy ra lỗi khi tải sản phẩm. Vui lòng thử lại sau.')
        console.error('Error loading product:', err)
      })
  }, [productId])

  if (error) {
    return (
      <div className="product_info_container">
        <CategoryMenu />
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <h2>404 - Không tìm thấy sản phẩm</h2>
          <p>{error}</p>
          <Link to="/">Quay về trang chủ</Link>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="product_info_container">
        <CategoryMenu />
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p>Đang tải...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="product_info_container">
      <CategoryMenu />
      <div className="product_info_header">
        <h3><Link to="/">Trang chủ</Link> &raquo; {product.name}</h3>
      </div>
      <div className="product_info_content">
        <div className="overall-info-wrapper">
          <div className="image-container">
            <img src={`/images/${product.id}/thumbnail.png`} alt={product.name} />
          </div>
          <div className="overall-info">
            <div>
              <h3>{product.name}</h3>
              <p>
                <strong>Giá:</strong> {product.price} VNĐ<br />
                <strong>Tình trạng:</strong> Còn hàng<br />
                <strong>Hãng sản xuất:</strong> {product.product?.overall?.brand}<br />
                <strong>Xuất xứ:</strong> {product.product?.overall?.made_in}<br />
                <strong>Chất liệu:</strong> {product.product?.overall?.material}<br />
                <strong>Màu sắc:</strong> {product.product?.overall?.color}<br />
              </p>
              <button className="add-to-cart-btn">
                MUA NGAY VỚI GIÁ {product.price} VNĐ<br />Đặt mua giao hàng tận nơi
              </button>
            </div>
            <ol className="slogan">
              <li><img src="/assets/payment.png" alt="Thanh toán đa dạng" /> PHƯƠNG THỨC THANH TOÁN ĐA DẠNG</li>
              <li><img src="/assets/delivery.png" alt="Ship COD" /> SHIP COD TOÀN QUỐC. PHÍ TÙY TỈNH</li>
              <li><img src="/assets/policy.png" alt="Bảo hành" /> CHÍNH SÁCH BẢO HÀNH VÀ ĐỔI TRẢ</li>
              <li><img src="/assets/badge.png" alt="Chất lượng" /> CHẤT LƯỢNG ĐẢM BẢO</li>
            </ol>
          </div>
        </div>
        <div className="detailed_info_wrapper">
          <h4>Mô tả</h4>
          <div dangerouslySetInnerHTML={{ __html: product.product?.detail }} />
        </div>
      </div>
      <div className="product_info_related">
        <h3>SẢN PHẨM LIÊN QUAN</h3>
      </div>
    </div>
  )
}

export default ProductInfoPage
