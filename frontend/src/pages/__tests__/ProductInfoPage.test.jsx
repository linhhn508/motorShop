import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../../../tests/setup'
import ProductInfoPage from '../ProductInfoPage'
import { mockProductDetail } from '../../../tests/mocks/data'

function renderProductInfoPage(productId = 'lop-michelin-city-grip-2') {
  return render(
    <MemoryRouter initialEntries={['/product/' + productId]}>
      <Routes>
        <Route path="/product/:productId" element={<ProductInfoPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProductInfoPage', () => {
  it('shows loading state initially', () => {
    renderProductInfoPage()
    expect(screen.getByText('Đang tải...')).toBeInTheDocument()
  })

//   it('fetches and renders product details', async () => {
//     renderProductInfoPage()
//     expect(await screen.findByText(mockProductDetail.name)).toBeInTheDocument()
//     expect(screen.getByText(/1\.200\.000/)).toBeInTheDocument()
//     expect(screen.getByText(/Michelin/)).toBeInTheDocument()
//     expect(screen.getByText(/Thai Lan/)).toBeInTheDocument()
//     expect(screen.getByText(/Cao su tong hop/)).toBeInTheDocument()
//   })

  it('renders breadcrumb with link to home', async () => {
    renderProductInfoPage()
    await screen.findByText(mockProductDetail.name)
    expect(screen.getByRole('link', { name: /Trang chủ/i })).toHaveAttribute('href', '/')
  })

  it('renders buy button with price', async () => {
    renderProductInfoPage()
    const button = await screen.findByRole('button', { name: /MUA NGAY/i })
    expect(button).toBeInTheDocument()
  })

  it('shows 404 error for non-existent product', async () => {
    renderProductInfoPage('non-existent-product')
    expect(await screen.findByText(/Sản phẩm không tồn tại/)).toBeInTheDocument()
    expect(screen.getByText(/404/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /quay về trang chủ/i })).toHaveAttribute('href', '/')
  })

  it('shows error message for network failure', async () => {
    server.use(http.get('/api/products/:id/info', () => HttpResponse.error()))
    renderProductInfoPage()
    expect(await screen.findByText(/Đã xảy ra lỗi/)).toBeInTheDocument()
  })

  it('renders product image', async () => {
    renderProductInfoPage()
    await screen.findByText(mockProductDetail.name)
    const img = screen.getByAltText(mockProductDetail.name)
    expect(img).toHaveAttribute('src', '/images/' + mockProductDetail.id + '/thumbnail.png')
  })
})
