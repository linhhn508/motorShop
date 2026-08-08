import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FeedbackPage from '../FeedbackPage'

describe('FeedbackPage', () => {
  it('renders page heading', () => {
    render(<FeedbackPage />)
    expect(screen.getByRole('heading', { name: /Phản hồi khách hàng/i })).toBeInTheDocument()
  })

  it('renders sample reviews', () => {
    render(<FeedbackPage />)
    expect(screen.getByText('Trần Minh Khoa')).toBeInTheDocument()
    expect(screen.getByText('Nguyễn Thị Lan')).toBeInTheDocument()
    expect(screen.getByText('Lê Hoàng Bảo')).toBeInTheDocument()
    expect(screen.getByText('Phạm Anh Tuấn')).toBeInTheDocument()
  })

  it('renders feedback form fields', () => {
    render(<FeedbackPage />)
    expect(screen.getByLabelText(/Họ và tên/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Sản phẩm/i)).toBeInTheDocument()
    expect(screen.getByText(/Mức độ hài lòng/i)).toBeInTheDocument()
  })

  it('star rating interaction updates label', async () => {
    const user = userEvent.setup()
    render(<FeedbackPage />)

    expect(screen.getByText('Chưa đánh giá')).toBeInTheDocument()
    const stars = screen.getAllByText('★')
    await user.click(stars[3])
    expect(screen.getByText('Tốt')).toBeInTheDocument()
  })

  it('submits form and resets fields on success', async () => {
    const user = userEvent.setup()
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

    render(<FeedbackPage />)
    await user.type(screen.getByLabelText(/Họ và tên/i), 'Tester')
    await user.type(screen.getByLabelText(/Sản phẩm/i), 'Lop Michelin')

    const stars = screen.getAllByText('★')
    await user.click(stars[4])

    await user.click(screen.getByRole('button', { name: /Gửi phản hồi/i }))

    expect(alertSpy).toHaveBeenCalledWith('Gửi phản hồi thành công!')
    expect(screen.getByLabelText(/Họ và tên/i)).toHaveValue('')
    expect(screen.getByLabelText(/Sản phẩm/i)).toHaveValue('')

    alertSpy.mockRestore()
  })
})
