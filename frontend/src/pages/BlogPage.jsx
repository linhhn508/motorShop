import '../styles/pages.css'

const blogPosts = [
  {
    id: 1,
    tag: 'Kinh nghiệm',
    title: 'Cách chọn lốp xe phù hợp cho từng loại địa hình',
    excerpt: 'Lốp xe là bộ phận tiếp xúc trực tiếp với mặt đường, ảnh hưởng lớn đến sự an toàn và hiệu suất vận hành...',
    date: '20/07/2026',
  },
  {
    id: 2,
    tag: 'Bảo dưỡng',
    title: '5 bước bảo dưỡng phuộc sau đúng cách tại nhà',
    excerpt: 'Phuộc xe có vai trò hấp thụ xung động từ mặt đường, giúp xe vận hành êm ái và ổn định hơn. Dưới đây là hướng dẫn...',
    date: '15/07/2026',
  },
  {
    id: 3,
    tag: 'Sản phẩm mới',
    title: 'Akrapovic R1 – Lựa chọn hàng đầu cho xe thể thao',
    excerpt: 'Ống xả Akrapovic R1 vừa được chúng tôi cập nhật vào kho hàng. Đây là dòng pô được ưa chuộng nhất trong phân khúc...',
    date: '10/07/2026',
  },
  {
    id: 4,
    tag: 'Kinh nghiệm',
    title: 'Hệ thống phanh ABS – Có thực sự cần thiết?',
    excerpt: 'Nhiều biker vẫn còn tranh luận về việc phanh ABS có thực sự cần thiết hay không. Bài viết này sẽ phân tích chi tiết...',
    date: '05/07/2026',
  },
  {
    id: 5,
    tag: 'Bảo dưỡng',
    title: 'Nhớt xe – Phân loại và cách chọn đúng loại nhớt',
    excerpt: 'Việc chọn đúng loại nhớt cho xe là yếu tố then chốt để bảo vệ động cơ và kéo dài tuổi thọ xe...',
    date: '01/07/2026',
  },
  {
    id: 6,
    tag: 'Sản phẩm mới',
    title: 'Gương CRG – Thiết kế tối giản, phong cách tối đa',
    excerpt: 'Gương gù tay lái CRG với thiết kế nhỏ gọn đang trở thành trend được giới biker Việt Nam ưa chuộng nhất hiện nay...',
    date: '25/06/2026',
  },
]

function BlogPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Blog</h2>
        <p>Tin tức, kinh nghiệm và cẩm nang về xe máy</p>
      </div>

      <div className="blog-grid">
        {blogPosts.map((post) => (
          <article key={post.id} className="blog-card">
            <div className="blog-card-img-placeholder"></div>
            <div className="blog-card-body">
              <span className="blog-tag">{post.tag}</span>
              <h3>{post.title}</h3>
              <p>{post.excerpt}</p>
              <div className="blog-meta">
                <span>{post.date}</span>
                <a href="#" className="read-more-btn">Đọc tiếp &rarr;</a>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

export default BlogPage
