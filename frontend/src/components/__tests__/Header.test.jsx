import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Header from '../Header'

function renderHeader() {
  return render(<MemoryRouter><Header /></MemoryRouter>)
}

describe('Header', () => {
  it('renders logo image', () => {
    renderHeader()
    expect(screen.getByAltText('My Motor Shop')).toBeInTheDocument()
  })

  it('renders navigation links', () => {
    renderHeader()
    expect(screen.getByRole('link', { name: /homepage/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /blog/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /contact/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /feedback/i })).toBeInTheDocument()
  })

  it('renders search input', () => {
    renderHeader()
    expect(screen.getByPlaceholderText('Input something..')).toBeInTheDocument()
  })

  it('renders banner info', () => {
    renderHeader()
    expect(screen.getByText(/GIAO HÀNG TOÀN QUỐC/)).toBeInTheDocument()
  })
})
