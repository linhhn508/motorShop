import { http, HttpResponse } from 'msw'
import { mockProducts, mockCategories, mockProductDetail } from './data'

export const handlers = [
  http.get('/api/products/', () => {
    return HttpResponse.json(mockProducts)
  }),

  http.get('/api/products/categories/', () => {
    return HttpResponse.json(mockCategories)
  }),

  http.get('/api/products/:id/info', ({ params }) => {
    if (params.id === mockProductDetail.id) {
      return HttpResponse.json(mockProductDetail)
    }
    return new HttpResponse(null, { status: 404 })
  }),

  http.post('/api/contact/', () => {
    return HttpResponse.json({ message: 'ok' })
  }),

  http.post('/api/feedback/', () => {
    return HttpResponse.json({ message: 'ok' })
  }),
]
