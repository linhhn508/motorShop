import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ContactPage from '../ContactPage'

describe('ContactPage', () => {
  it('renders page heading', () => {
    render(<ContactPage />)
    expect(screen.getByRole('heading', { name: /Thông tin liên hệ/i })).toBeInTheDocument()
  })

  it('renders all form fields', () => {
    render(<ContactPage />)
    expect(screen.getByLabelText(/Họ và tên/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Số điện thoại/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Chủ đề/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Nội dung/i)).toBeInTheDocument()
  })

  it('renders contact info section', () => {
    render(<ContactPage />)
    expect(screen.getByText(/345\/75 Phan Xích Long/)).toBeInTheDocument()
  })

  it('submits form and resets fields on success', async () => {
    const user = userEvent.setup()
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

    render(<ContactPage />)
    await user.type(screen.getByLabelText(/Họ và tên/i), 'Nguyễn Văn A')
    await user.type(screen.getByLabelText(/Số điện thoại/i), '0365913732')
    await user.type(screen.getByLabelText(/Email/i), 'test@example.com')
    await user.selectOptions(screen.getByLabelText(/Chủ đề/i), 'product')
    await user.type(screen.getByLabelText(/Nội dung/i), 'Toi muon hoi ve san pham')

    await user.click(screen.getByRole('button', { name: /Gửi tin nhắn/i }))

    expect(alertSpy).toHaveBeenCalledWith('Gửi tin nhắn thành công!')
    expect(screen.getByLabelText(/Họ và tên/i)).toHaveValue('')
    expect(screen.getByLabelText(/Số điện thoại/i)).toHaveValue('')
    expect(screen.getByLabelText(/Nội dung/i)).toHaveValue('')

    alertSpy.mockRestore()
  })

  it('renders submit button', () => {
    render(<ContactPage />)
    expect(screen.getByRole('button', { name: /Gửi tin nhắn/i })).toBeInTheDocument()
  })
})
