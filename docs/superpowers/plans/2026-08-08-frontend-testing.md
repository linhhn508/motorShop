# Frontend Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add unit and integration tests for the React frontend using Vitest + React Testing Library + MSW.

**Architecture:** Tests live in `__tests__/` folders adjacent to their source. Shared test setup and MSW mock handlers live in `frontend/tests/`. All API calls are intercepted by MSW at the network level.

**Tech Stack:** Vitest, @testing-library/react, @testing-library/jest-dom, @testing-library/user-event, jsdom, msw

## Global Constraints

- All test dependencies are devDependencies only
- MSW v2 API (using `http.get()` / `http.post()` handlers, not the legacy `rest.*` API)
- Test environment: jsdom
- Vitest globals enabled (no need to import `describe`, `it`, `expect`)
- All components using react-router-dom must be wrapped in `MemoryRouter` when tested

---

### Task 1: Install dependencies and configure Vitest

**Files:**
- Modify: `frontend/package.json` (add devDependencies and scripts)
- Modify: `frontend/vite.config.js` (add test config)

- [ ] **Step 1: Install test dependencies**

```bash
cd frontend
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom msw
```

- [ ] **Step 2: Add test scripts to package.json**

Add to the `"scripts"` section of `frontend/package.json`:

```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 3: Add test config to vite.config.js**

Modify `frontend/vite.config.js` to add a `test` block:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
      '/images': {
        target: 'http://localhost:9000',
        rewrite: (path) => path.replace(/^\/images/, '/product-image'),
      },
    },
    host: '0.0.0.0'
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.js',
  },
})
```

- [ ] **Step 4: Verify config loads**

```bash
cd frontend && npx vitest --version
```

Expected: Vitest version prints without errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.js
git commit -m "test: install vitest, testing-library, msw dependencies"
```

---

### Task 2: Create MSW mocks and test setup

**Files:**
- Create: `frontend/tests/mocks/data.js`
- Create: `frontend/tests/mocks/handlers.js`
- Create: `frontend/tests/setup.js`

**Interfaces:**
- Produces: `mockProducts` array, `mockCategories` array, `mockProductDetail` object
- Produces: MSW `handlers` array
- Produces: global test setup (jest-dom matchers, MSW server lifecycle)

- [ ] **Step 1: Create mock data file**

Create `frontend/tests/mocks/data.js`:

```js
export const mockCategories = ['Lop xe', 'Phuoc', 'Po xe', 'Heo dau', 'Phu kien']

export const mockProducts = [
  { id: 'lop-michelin-city-grip-2', name: 'Lop Michelin City Grip 2', price: '1.200.000' },
  { id: 'phuoc-sau-ohlins-binh-dau', name: 'Phuoc sau Ohlins binh dau', price: '4.500.000' },
  { id: 'po-akrapovic-r1', name: 'Po Akrapovic R1', price: '8.900.000' },
  { id: 'heo-dau-brembo-4-pis', name: 'Heo dau Brembo 4 piston', price: '3.200.000' },
  { id: 'nhong-sen-dia-did-vang-428hd', name: 'Nhong sen dia DID vang 428HD', price: '950.000' },
  { id: 'xi-nhan-led-koso', name: 'Xi nhan LED Koso', price: '350.000' },
  { id: 'guong-gu-tay-lai-crg', name: 'Guong gu tay lai CRG', price: '450.000' },
  { id: 'gac-chan-nhom-biker', name: 'Gac chan nhom Biker', price: '280.000' },
  { id: 'yen-doi-triump-speed-400', name: 'Yen doi Triumph Speed 400', price: '1.800.000' },
  { id: 'lop-pirelli-diablo-rosso', name: 'Lop Pirelli Diablo Rosso', price: '1.500.000' },
  { id: 'extra-product-11', name: 'San pham thu 11', price: '500.000' },
]

export const mockProductDetail = {
  id: 'lop-michelin-city-grip-2',
  name: 'Lop Michelin City Grip 2',
  price: '1.200.000',
  product: {
    overall: {
      brand: 'Michelin',
      made_in: 'Thai Lan',
      material: 'Cao su tong hop',
      color: 'Den',
    },
    detail: '<p>Lop Michelin City Grip 2 thiet ke danh cho xe tay ga.</p>',
  },
}
```

- [ ] **Step 2: Create MSW handlers**

Create `frontend/tests/mocks/handlers.js`:

```js
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
```

- [ ] **Step 3: Create global test setup**

Create `frontend/tests/setup.js`:

```js
import '@testing-library/jest-dom'
import { setupServer } from 'msw/node'
import { handlers } from './mocks/handlers'

export const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

- [ ] **Step 4: Verify setup with a smoke test**

Create `frontend/src/components/__tests__/smoke.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'

test('smoke test - testing setup works', () => {
  render(<div>hello</div>)
  expect(screen.getByText('hello')).toBeInTheDocument()
})
```

Run: `cd frontend && npx vitest run src/components/__tests__/smoke.test.jsx`

Expected: 1 test passes.

- [ ] **Step 5: Delete smoke test and commit**

```bash
rm frontend/src/components/__tests__/smoke.test.jsx
git add frontend/tests/
git commit -m "test: add MSW mock handlers and global test setup"
```

---

### Task 3: Unit tests for Header and Footer

**Files:**
- Create: `frontend/src/components/__tests__/Header.test.jsx`
- Create: `frontend/src/components/__tests__/Footer.test.jsx`

- [ ] **Step 1: Write Header tests**

Create `frontend/src/components/__tests__/Header.test.jsx`:

```jsx
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
    expect(screen.getByText(/GIAO HANG TOAN QUOC/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run Header tests**

`cd frontend && npx vitest run src/components/__tests__/Header.test.jsx`

- [ ] **Step 3: Write Footer tests**

Create `frontend/src/components/__tests__/Footer.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import Footer from '../Footer'

describe('Footer', () => {
  it('renders contact information', () => {
    render(<Footer />)
    expect(screen.getByText(/345\/75 Phan Xich Long/)).toBeInTheDocument()
    expect(screen.getByText(/036 591 3732/)).toBeInTheDocument()
    expect(screen.getByText(/example@example.com/)).toBeInTheDocument()
  })

  it('renders payment information', () => {
    render(<Footer />)
    expect(screen.getByText(/HINH THUC THANH TOAN/)).toBeInTheDocument()
    expect(screen.getByText(/TECHCOMBANK/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Run Footer tests**

`cd frontend && npx vitest run src/components/__tests__/Footer.test.jsx`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/__tests__/Header.test.jsx frontend/src/components/__tests__/Footer.test.jsx
git commit -m "test: add Header and Footer unit tests"
```

---

### Task 4: Unit tests for Pagination

**Files:**
- Create: `frontend/src/components/__tests__/Pagination.test.jsx`

- [ ] **Step 1: Write Pagination tests**

Create `frontend/src/components/__tests__/Pagination.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Pagination from '../Pagination'

describe('Pagination', () => {
  it('returns null when totalPages is 1', () => {
    const { container } = render(<Pagination currentPage={1} totalPages={1} onPageChange={() => {}} />)
    expect(container.innerHTML).toBe('')
  })

  it('returns null when totalPages is 0', () => {
    const { container } = render(<Pagination currentPage={1} totalPages={0} onPageChange={() => {}} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders correct number of page buttons', () => {
    render(<Pagination currentPage={1} totalPages={3} onPageChange={() => {}} />)
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument()
  })

  it('disables Previous button on first page', () => {
    render(<Pagination currentPage={1} totalPages={3} onPageChange={() => {}} />)
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled()
  })

  it('disables Next button on last page', () => {
    render(<Pagination currentPage={3} totalPages={3} onPageChange={() => {}} />)
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })

  it('calls onPageChange with correct page on click', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<Pagination currentPage={1} totalPages={3} onPageChange={onPageChange} />)
    await user.click(screen.getByRole('button', { name: '2' }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('calls onPageChange on Next button click', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<Pagination currentPage={1} totalPages={3} onPageChange={onPageChange} />)
    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('calls onPageChange on Previous button click', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<Pagination currentPage={2} totalPages={3} onPageChange={onPageChange} />)
    await user.click(screen.getByRole('button', { name: /previous/i }))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('marks active page button', () => {
    render(<Pagination currentPage={2} totalPages={3} onPageChange={() => {}} />)
    expect(screen.getByRole('button', { name: '2' })).toHaveClass('active')
    expect(screen.getByRole('button', { name: '1' })).not.toHaveClass('active')
  })
})
```

- [ ] **Step 2: Run Pagination tests**

`cd frontend && npx vitest run src/components/__tests__/Pagination.test.jsx`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/__tests__/Pagination.test.jsx
git commit -m "test: add Pagination unit tests"
```

---

### Task 5: Unit test for CategoryMenu

**Files:**
- Create: `frontend/src/components/__tests__/CategoryMenu.test.jsx`

- [ ] **Step 1: Write CategoryMenu tests**

Create `frontend/src/components/__tests__/CategoryMenu.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../../../tests/setup'
import CategoryMenu from '../CategoryMenu'
import { mockCategories } from '../../../tests/mocks/data'

function renderCategoryMenu() {
  return render(<MemoryRouter><CategoryMenu /></MemoryRouter>)
}

describe('CategoryMenu', () => {
  it('renders category title', () => {
    renderCategoryMenu()
    expect(screen.getByText('Danh muc san pham')).toBeInTheDocument()
  })

  it('fetches and displays categories', async () => {
    renderCategoryMenu()
    for (const cat of mockCategories) {
      expect(await screen.findByText(cat)).toBeInTheDocument()
    }
  })

  it('handles API error without crashing', async () => {
    server.use(
      http.get('/api/products/categories/', () => {
        return new HttpResponse(null, { status: 500 })
      })
    )
    renderCategoryMenu()
    expect(screen.getByText('Danh muc san pham')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run CategoryMenu tests**

`cd frontend && npx vitest run src/components/__tests__/CategoryMenu.test.jsx`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/__tests__/CategoryMenu.test.jsx
git commit -m "test: add CategoryMenu unit tests"
```

---

### Task 6: Integration tests for HomePage

**Files:**
- Create: `frontend/src/pages/__tests__/HomePage.test.jsx`

- [ ] **Step 1: Write HomePage tests**

Create `frontend/src/pages/__tests__/HomePage.test.jsx`:

```jsx
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
    expect(screen.getByText('SAN PHAM MOI NHAT')).toBeInTheDocument()
  })

  it('handles API failure without crashing', async () => {
    server.use(http.get('/api/products/', () => new HttpResponse(null, { status: 500 })))
    renderHomePage()
    expect(screen.getByText('SAN PHAM MOI NHAT')).toBeInTheDocument()
  })

  it('handles empty product list', async () => {
    server.use(http.get('/api/products/', () => HttpResponse.json([])))
    renderHomePage()
    expect(screen.getByText('SAN PHAM MOI NHAT')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run HomePage tests**

`cd frontend && npx vitest run src/pages/__tests__/HomePage.test.jsx`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/__tests__/HomePage.test.jsx
git commit -m "test: add HomePage integration tests"
```

---

### Task 7: Integration tests for ProductInfoPage

**Files:**
- Create: `frontend/src/pages/__tests__/ProductInfoPage.test.jsx`

- [ ] **Step 1: Write ProductInfoPage tests**

Create `frontend/src/pages/__tests__/ProductInfoPage.test.jsx`:

```jsx
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
    expect(screen.getByText('Dang tai...')).toBeInTheDocument()
  })

  it('fetches and renders product details', async () => {
    renderProductInfoPage()
    expect(await screen.findByText(mockProductDetail.name)).toBeInTheDocument()
    expect(screen.getByText(/1\.200\.000/)).toBeInTheDocument()
    expect(screen.getByText(/Michelin/)).toBeInTheDocument()
    expect(screen.getByText(/Thai Lan/)).toBeInTheDocument()
    expect(screen.getByText(/Cao su tong hop/)).toBeInTheDocument()
  })

  it('renders breadcrumb with link to home', async () => {
    renderProductInfoPage()
    await screen.findByText(mockProductDetail.name)
    expect(screen.getByRole('link', { name: /trang chu/i })).toHaveAttribute('href', '/')
  })

  it('renders buy button with price', async () => {
    renderProductInfoPage()
    const button = await screen.findByRole('button', { name: /MUA NGAY/i })
    expect(button).toBeInTheDocument()
  })

  it('shows 404 error for non-existent product', async () => {
    renderProductInfoPage('non-existent-product')
    expect(await screen.findByText(/San pham khong ton tai/)).toBeInTheDocument()
    expect(screen.getByText(/404/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /quay ve trang chu/i })).toHaveAttribute('href', '/')
  })

  it('shows error message for network failure', async () => {
    server.use(http.get('/api/products/:id/info', () => HttpResponse.error()))
    renderProductInfoPage()
    expect(await screen.findByText(/Da xay ra loi/)).toBeInTheDocument()
  })

  it('renders product image', async () => {
    renderProductInfoPage()
    await screen.findByText(mockProductDetail.name)
    const img = screen.getByAltText(mockProductDetail.name)
    expect(img).toHaveAttribute('src', '/images/' + mockProductDetail.id + '/thumbnail.png')
  })
})
```

- [ ] **Step 2: Run ProductInfoPage tests**

`cd frontend && npx vitest run src/pages/__tests__/ProductInfoPage.test.jsx`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/__tests__/ProductInfoPage.test.jsx
git commit -m "test: add ProductInfoPage integration tests"
```

---

### Task 8: Integration tests for ContactPage

**Files:**
- Create: `frontend/src/pages/__tests__/ContactPage.test.jsx`

- [ ] **Step 1: Write ContactPage tests**

Create `frontend/src/pages/__tests__/ContactPage.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ContactPage from '../ContactPage'

describe('ContactPage', () => {
  it('renders page heading', () => {
    render(<ContactPage />)
    expect(screen.getByRole('heading', { name: /lien he/i })).toBeInTheDocument()
  })

  it('renders all form fields', () => {
    render(<ContactPage />)
    expect(screen.getByLabelText(/ho va ten/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/so dien thoai/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/chu de/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/noi dung/i)).toBeInTheDocument()
  })

  it('renders contact info section', () => {
    render(<ContactPage />)
    expect(screen.getByText(/345\/75 Phan Xich Long/)).toBeInTheDocument()
  })

  it('submits form and resets fields on success', async () => {
    const user = userEvent.setup()
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

    render(<ContactPage />)
    await user.type(screen.getByLabelText(/ho va ten/i), 'Nguyen Van A')
    await user.type(screen.getByLabelText(/so dien thoai/i), '0365913732')
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.selectOptions(screen.getByLabelText(/chu de/i), 'product')
    await user.type(screen.getByLabelText(/noi dung/i), 'Toi muon hoi ve san pham')

    await user.click(screen.getByRole('button', { name: /gui tin nhan/i }))

    expect(alertSpy).toHaveBeenCalledWith('Gui tin nhan thanh cong!')
    expect(screen.getByLabelText(/ho va ten/i)).toHaveValue('')
    expect(screen.getByLabelText(/so dien thoai/i)).toHaveValue('')
    expect(screen.getByLabelText(/noi dung/i)).toHaveValue('')

    alertSpy.mockRestore()
  })

  it('renders submit button', () => {
    render(<ContactPage />)
    expect(screen.getByRole('button', { name: /gui tin nhan/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run ContactPage tests**

`cd frontend && npx vitest run src/pages/__tests__/ContactPage.test.jsx`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/__tests__/ContactPage.test.jsx
git commit -m "test: add ContactPage integration tests"
```

---

### Task 9: Integration tests for FeedbackPage

**Files:**
- Create: `frontend/src/pages/__tests__/FeedbackPage.test.jsx`

- [ ] **Step 1: Write FeedbackPage tests**

Create `frontend/src/pages/__tests__/FeedbackPage.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FeedbackPage from '../FeedbackPage'

describe('FeedbackPage', () => {
  it('renders page heading', () => {
    render(<FeedbackPage />)
    expect(screen.getByRole('heading', { name: /phan hoi khach hang/i })).toBeInTheDocument()
  })

  it('renders sample reviews', () => {
    render(<FeedbackPage />)
    expect(screen.getByText('Tran Minh Khoa')).toBeInTheDocument()
    expect(screen.getByText('Nguyen Thi Lan')).toBeInTheDocument()
    expect(screen.getByText('Le Hoang Bao')).toBeInTheDocument()
    expect(screen.getByText('Pham Anh Tuan')).toBeInTheDocument()
  })

  it('renders feedback form fields', () => {
    render(<FeedbackPage />)
    expect(screen.getByLabelText(/ho va ten/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/san pham/i)).toBeInTheDocument()
    expect(screen.getByText(/muc do hai long/i)).toBeInTheDocument()
  })

  it('star rating interaction updates label', async () => {
    const user = userEvent.setup()
    render(<FeedbackPage />)

    expect(screen.getByText('Chua danh gia')).toBeInTheDocument()
    const stars = screen.getAllByText('\u2733')
    await user.click(stars[3])
    expect(screen.getByText('Tot')).toBeInTheDocument()
  })

  it('submits form and resets fields on success', async () => {
    const user = userEvent.setup()
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

    render(<FeedbackPage />)
    await user.type(screen.getByLabelText(/ho va ten/i), 'Tester')
    await user.type(screen.getByLabelText(/san pham/i), 'Lop Michelin')

    const stars = screen.getAllByText('\u2733')
    await user.click(stars[4])

    await user.click(screen.getByRole('button', { name: /gui danh gia/i }))

    expect(alertSpy).toHaveBeenCalledWith('Gui phan hoi thanh cong!')
    expect(screen.getByLabelText(/ho va ten/i)).toHaveValue('')
    expect(screen.getByLabelText(/san pham/i)).toHaveValue('')

    alertSpy.mockRestore()
  })
})
```

- [ ] **Step 2: Run FeedbackPage tests**

`cd frontend && npx vitest run src/pages/__tests__/FeedbackPage.test.jsx`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/__tests__/FeedbackPage.test.jsx
git commit -m "test: add FeedbackPage integration tests"
```

---

### Task 10: Run full test suite and final commit

- [ ] **Step 1: Run all tests**

```bash
cd frontend && npx vitest run
```

Expected: All 42 tests pass.

- [ ] **Step 2: Fix any failures**

Debug with `screen.debug()`. Common issues:
- Text matching: check exact rendered text
- Async timing: use `findByText` for API-loaded content
- Router wrapping: wrap components using Link/NavLink/useParams in MemoryRouter

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "test: complete frontend unit and integration test suite"
```
