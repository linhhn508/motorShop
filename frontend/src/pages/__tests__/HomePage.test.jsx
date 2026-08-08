import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../../../tests/setup'
import HomePage from '../HomePage'
import { mockProducts } from '../../../tests/mocks/data'

function renderHomePage() {
  return render(<MemoryRouter><HomePage /></MemoryRouter>)
}

describe('HomePage', () => {
  it('fetches and renders products', async () => {
    renderHomePage()
    expect(await screen.findByText(mockProducts[0].name)).toBeInTheDocument()
    expect(screen.getByText(mockProducts[9].name)).toBeInTheDocument()
  })

  it('does not show 11th product on first page', async () => {
    renderHomePage()
    await screen.findByText(mockProducts[0].name)
    expect(screen.queryByText(mockProducts[10].name)).not.toBeInTheDocument()
  })

  it('renders product links pointing to /product/:id', async () => {
    renderHomePage()
    const firstProduct = await screen.findByText(mockProducts[0].name)
    const link = firstProduct.closest('a')
    expect(link).toHaveAttribute('href', '/product/' + mockProducts[0].id)
  })

  it('shows second page products when clicking page 2', async () => {
    const user = userEvent.setup()
    renderHomePage()
    await screen.findByText(mockProducts[0].name)
    await user.click(screen.getByRole('button', { name: '2' }))
    expect(screen.getByText(mockProducts[10].name)).toBeInTheDocument()
    expect(screen.queryByText(mockProducts[0].name)).not.toBeInTheDocument()
  })

  it('renders heading', () => {
    renderHomePage()
    expect(screen.getByText('SẢN PHẨM MỚI NHẤT')).toBeInTheDocument()
  })

  it('handles API failure without crashing', async () => {
    server.use(http.get('/api/products/', () => new HttpResponse(null, { status: 500 })))
    renderHomePage()
    expect(screen.getByText('SẢN PHẨM MỚI NHẤT')).toBeInTheDocument()
  })

  it('handles empty product list', async () => {
    server.use(http.get('/api/products/', () => HttpResponse.json([])))
    renderHomePage()
    expect(screen.getByText('SẢN PHẨM MỚI NHẤT')).toBeInTheDocument()
  })
})
