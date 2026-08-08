import { render, screen } from '@testing-library/react'
import Footer from '../Footer'

describe('Footer', () => {
  it('renders contact information', () => {
    render(<Footer />)
    expect(screen.getByText(/345\/75 Phan Xích Long/)).toBeInTheDocument()
    expect(screen.getByText(/036 591 3732/)).toBeInTheDocument()
    expect(screen.getByText(/example@example.com/)).toBeInTheDocument()
  })

  it('renders payment information', () => {
    render(<Footer />)
    expect(screen.getByText(/HÌNH THỨC THANH TOÁN/)).toBeInTheDocument()
    expect(screen.getByText(/TECHCOMBANK/)).toBeInTheDocument()
  })
})
