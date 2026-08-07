import { useState } from 'react'
import '../styles/pages.css'

function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    subject: '',
    message: '',
  })

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/contact/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (response.ok) {
        alert('Gửi tin nhắn thành công!')
        setFormData({ name: '', phone: '', email: '', subject: '', message: '' })
      }
    } catch (error) {
      console.error('Error submitting contact form:', error)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Liên hệ</h2>
        <p>Chúng tôi luôn sẵn sàng hỗ trợ bạn</p>
      </div>

      <div className="contact-layout">
        <div className="contact-info">
          <h3>Thông tin liên hệ</h3>

          <div className="contact-info-item">
            <div className="contact-icon">&#128205;</div>
            <div>
              <strong>Địa chỉ</strong>
              <p>345/75 Phan Xích Long, Phường Cầu Kiệu, Phú Nhuận, TP.HCM</p>
            </div>
          </div>

          <div className="contact-info-item">
            <div className="contact-icon">&#128222;</div>
            <div>
              <strong>Hotline tư vấn</strong>
              <p><a href="tel:0365913732">036 591 3732</a></p>
            </div>
          </div>

          <div className="contact-info-item">
            <div className="contact-icon">&#9993;</div>
            <div>
              <strong>Email</strong>
              <p><a href="mailto:example@example.com">example@example.com</a></p>
            </div>
          </div>

          <div className="contact-info-item">
            <div className="contact-icon">&#128336;</div>
            <div>
              <strong>Giờ mở cửa</strong>
              <p>Thứ Hai - Thứ Bảy: 9:30 AM - 6:00 PM</p>
              <p>Chủ Nhật: 10:00 AM - 4:00 PM</p>
            </div>
          </div>

          <div className="map-placeholder">
            <span>Bản đồ</span>
          </div>
        </div>

        <div className="contact-form-wrapper">
          <h3>Gửi tin nhắn cho chúng tôi</h3>
          <form className="contact-form" onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="contact-name">Họ và tên <span className="required">*</span></label>
              <input type="text" id="contact-name" name="name" placeholder="Nguyễn Văn A" required value={formData.name} onChange={handleChange} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="contact-phone">Số điện thoại <span className="required">*</span></label>
                <input type="tel" id="contact-phone" name="phone" placeholder="036 591 3732" required value={formData.phone} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label htmlFor="contact-email">Email</label>
                <input type="email" id="contact-email" name="email" placeholder="example@example.com" value={formData.email} onChange={handleChange} />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="contact-subject">Chủ đề</label>
              <select id="contact-subject" name="subject" value={formData.subject} onChange={handleChange}>
                <option value="">-- Chọn chủ đề --</option>
                <option value="product">Tư vấn sản phẩm</option>
                <option value="order">Đặt hàng / Giao hàng</option>
                <option value="warranty">Bảo hành / Đổi trả</option>
                <option value="other">Khác</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="contact-message">Nội dung <span className="required">*</span></label>
              <textarea id="contact-message" name="message" rows="5" placeholder="Nhập nội dung cần liên hệ..." required value={formData.message} onChange={handleChange}></textarea>
            </div>

            <button type="submit" className="submit-btn">Gửi tin nhắn</button>
            <p className="form-note">Chúng tôi sẽ phản hồi trong vòng 24 giờ làm việc.</p>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ContactPage
