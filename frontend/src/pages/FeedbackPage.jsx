import { useState } from 'react'
import '../styles/pages.css'

const ratingLabels = ['', 'Rất tệ', 'Tệ', 'Bình thường', 'Tốt', 'Xuất sắc']

const sampleReviews = [
  {
    name: 'Trần Minh Khoa',
    stars: 5,
    date: '18/07/2026',
    product: 'Lốp Michelin City Grip 2',
    content: 'Chất lượng sản phẩm tuyệt vời, đúng hàng chính hãng. Shop tư vấn nhiệt tình, giao hàng nhanh. Sẽ ủng hộ lần sau!',
  },
  {
    name: 'Nguyễn Thị Lan',
    stars: 5,
    date: '12/07/2026',
    product: 'Phuộc sau Ohlins',
    content: 'Mình đã tìm nhiều chỗ mới ra được hàng chính hãng. Shop có đầy đủ giấy tờ, tem chính hãng rõ ràng. Rất tin tưởng!',
  },
  {
    name: 'Lê Hoàng Bảo',
    stars: 4,
    date: '05/07/2026',
    product: 'Dịch vụ: Tư vấn mua hàng',
    content: 'Nhân viên tư vấn rất am hiểu về sản phẩm, giải thích cặn kẽ từng chi tiết. Chỉ hơi chờ lâu một chút nhưng nhìn chung rất ổn.',
  },
  {
    name: 'Phạm Anh Tuấn',
    stars: 5,
    date: '28/06/2026',
    product: 'Heo dầu Brembo 4 piston',
    content: 'Giao hàng đúng hẹn, đóng gói cẩn thận. Sản phẩm khớp hoàn toàn với mô tả. Mình rất hài lòng với trải nghiệm mua sắm tại đây.',
  },
]

function StarRating({ value, onChange }) {
  const [hovered, setHovered] = useState(0)

  return (
    <div className="star-rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={`star ${star <= (hovered || value) ? 'active' : ''}`}
          onMouseOver={() => setHovered(star)}
          onMouseOut={() => setHovered(0)}
          onClick={() => onChange(star)}
        >
          &#9733;
        </span>
      ))}
    </div>
  )
}

function FeedbackPage() {
  const [formData, setFormData] = useState({
    name: '',
    product: '',
    rating: 0,
    category: '',
    message: '',
    suggestion: '',
  })

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/feedback/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (response.ok) {
        alert('Gửi phản hồi thành công!')
        setFormData({ name: '', product: '', rating: 0, category: '', message: '', suggestion: '' })
      }
    } catch (error) {
      console.error('Error submitting feedback:', error)
    }
  }

  const renderStars = (count) => {
    return '★'.repeat(count) + '☆'.repeat(5 - count)
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Phản hồi khách hàng</h2>
        <p>Ý kiến của bạn giúp chúng tôi ngày càng hoàn thiện hơn</p>
      </div>

      <div className="feedback-layout">
        <div className="feedback-form-wrapper">
          <h3>Gửi đánh giá của bạn</h3>
          <form className="feedback-form" onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="fb-name">Họ và tên <span className="required">*</span></label>
              <input type="text" id="fb-name" name="name" placeholder="Nguyễn Văn A" required value={formData.name} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label htmlFor="fb-product">Sản phẩm / Dịch vụ đã sử dụng</label>
              <input type="text" id="fb-product" name="product" placeholder="Ví dụ: Lốp Michelin City Grip 2" value={formData.product} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label>Mức độ hài lòng <span className="required">*</span></label>
              <StarRating value={formData.rating} onChange={(val) => setFormData({ ...formData, rating: val })} />
              <span className="rating-label">{ratingLabels[formData.rating] || 'Chưa đánh giá'}</span>
            </div>

            <div className="form-group">
              <label htmlFor="fb-category">Danh mục phản hồi</label>
              <select id="fb-category" name="category" value={formData.category} onChange={handleChange}>
                <option value="">-- Chọn danh mục --</option>
                <option value="product_quality">Chất lượng sản phẩm</option>
                <option value="service">Dịch vụ khách hàng</option>
                <option value="delivery">Giao hàng</option>
                <option value="price">Giá cả</option>
                <option value="website">Website</option>
                <option value="other">Khác</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="fb-message">Nội dung phản hồi <span className="required">*</span></label>
              <textarea id="fb-message" name="message" rows="5" placeholder="Chia sẻ trải nghiệm của bạn với chúng tôi..." required value={formData.message} onChange={handleChange}></textarea>
            </div>

            <div className="form-group">
              <label htmlFor="fb-suggest">Đề xuất cải thiện (nếu có)</label>
              <textarea id="fb-suggest" name="suggestion" rows="3" placeholder="Bạn muốn chúng tôi cải thiện điều gì?" value={formData.suggestion} onChange={handleChange}></textarea>
            </div>

            <button type="submit" className="submit-btn">Gửi phản hồi</button>
          </form>
        </div>

        <div className="reviews-wrapper">
          <h3>Đánh giá từ khách hàng</h3>

          <div className="review-summary">
            <div className="review-avg">
              <span className="avg-score">4.8</span>
              <div className="avg-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
              <span className="avg-count">Dựa trên 128 đánh giá</span>
            </div>
            <div className="review-bars">
              <div className="review-bar-row"><span>5&#9733;</span><div className="bar"><div className="bar-fill" style={{ width: '80%' }}></div></div><span>80%</span></div>
              <div className="review-bar-row"><span>4&#9733;</span><div className="bar"><div className="bar-fill" style={{ width: '14%' }}></div></div><span>14%</span></div>
              <div className="review-bar-row"><span>3&#9733;</span><div className="bar"><div className="bar-fill" style={{ width: '4%' }}></div></div><span>4%</span></div>
              <div className="review-bar-row"><span>2&#9733;</span><div className="bar"><div className="bar-fill" style={{ width: '1%' }}></div></div><span>1%</span></div>
              <div className="review-bar-row"><span>1&#9733;</span><div className="bar"><div className="bar-fill" style={{ width: '1%' }}></div></div><span>1%</span></div>
            </div>
          </div>

          <div className="review-list">
            {sampleReviews.map((review, index) => (
              <div key={index} className="review-item">
                <div className="review-header">
                  <strong>{review.name}</strong>
                  <span className="review-stars">{renderStars(review.stars)}</span>
                  <span className="review-date">{review.date}</span>
                </div>
                <p className="review-product">Sản phẩm: {review.product}</p>
                <p>{review.content}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default FeedbackPage
