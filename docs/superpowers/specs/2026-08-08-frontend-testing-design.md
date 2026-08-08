# Frontend Testing Design

**Date:** 2026-08-08  
**Scope:** Unit and integration tests for the React frontend (`frontend/src/`)  
**Out of scope:** E2E tests (deferred to release branch), visual/CSS testing, BlogPage (static)

---

## Tech Stack

| Package | Purpose |
|---------|---------|
| `vitest` | Test runner (Vite-native) |
| `@testing-library/react` | Component rendering & queries |
| `@testing-library/jest-dom` | DOM assertion matchers |
| `@testing-library/user-event` | Simulating user interactions |
| `jsdom` | Browser environment for Vitest |
| `msw` | Mock Service Worker for API mocking |

All added as devDependencies.

## File Structure

```
frontend/
├── src/
│   ├── components/__tests__/
│   │   ├── Header.test.jsx
│   │   ├── Footer.test.jsx
│   │   ├── CategoryMenu.test.jsx
│   │   └── Pagination.test.jsx
│   └── pages/__tests__/
│       ├── HomePage.test.jsx
│       ├── ProductInfoPage.test.jsx
│       ├── ContactPage.test.jsx
│       └── FeedbackPage.test.jsx
├── tests/
│   ├── setup.js
│   └── mocks/
│       ├── handlers.js
│       └── data.js
└── vite.config.js  (add test config block)
```

## Scripts

```json
"test": "vitest",
"test:coverage": "vitest run --coverage"
```

## Configuration

### Vite config (`vite.config.js`)

Add a `test` block to the existing config:

```js
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: './tests/setup.js',
}
```

### Global setup (`tests/setup.js`)

- Imports `@testing-library/jest-dom` for extended matchers
- Starts MSW server with `beforeAll`
- Resets handlers between tests with `afterEach`
- Closes server with `afterAll`

## MSW Handlers

| Method | Route | Response |
|--------|-------|----------|
| GET | `/api/products/` | Mock product list |
| GET | `/api/products/categories/` | Mock category list |
| GET | `/api/products/:id/info` | Product detail (200) or 404 for unknown ID |
| POST | `/api/contact/` | 200 OK |
| POST | `/api/feedback/` | 200 OK |

## Test Patterns

### Router wrapper

Components using `react-router-dom` are wrapped in `MemoryRouter`:

```jsx
function renderWithRouter(ui, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/*" element={ui} />
      </Routes>
    </MemoryRouter>
  )
}
```

For route-param-dependent pages (e.g. ProductInfoPage):

```jsx
render(
  <MemoryRouter initialEntries={['/product/test-product-1']}>
    <Routes>
      <Route path="/product/:productId" element={<ProductInfoPage />} />
    </Routes>
  </MemoryRouter>
)
```

### Async data fetching

Use `findBy*` queries or `waitFor` to wait for API data to render:

```jsx
const productName = await screen.findByText('Lốp Michelin City Grip 2')
expect(productName).toBeInTheDocument()
```

---

## Unit Tests — Components

### Header
- Renders logo image with alt text
- Renders nav links: Homepage, Blog, Contact, Feedback
- Renders search input

### Footer
- Renders contact info (address, hours, hotline, email)
- Renders payment info

### CategoryMenu
- Fetches categories from `/api/products/categories/` and renders them
- Handles API error gracefully (no crash)

### Pagination
- Returns null when `totalPages <= 1`
- Renders correct number of page buttons
- Calls `onPageChange` with correct page number on click
- Disables Previous button on first page
- Disables Next button on last page
- Marks active page button

---

## Integration Tests — Pages

### HomePage
- Fetches products on mount and renders product grid
- Each product links to `/product/:id`
- Pagination renders correct subset of products
- Handles empty product list
- Handles API failure (no crash)

### ProductInfoPage
- Fetches product info by route param and renders details (name, price, brand, made_in, material, color)
- Shows loading state initially ("Đang tải...")
- Shows 404 error view for non-existent product
- Shows error message for network failure
- Renders breadcrumb with link to home

### ContactPage
- Renders all form fields (name, phone, email, subject, message)
- Submits form data via POST to `/api/contact/`
- Resets form fields on successful submission
- Shows success alert on submission

### FeedbackPage
- Renders feedback form and existing sample reviews
- Star rating interaction updates selected rating and label
- Submits form data via POST to `/api/feedback/`
- Resets form fields on successful submission
- Shows success alert on submission

---

## Out of Scope

- **E2E tests** — Will be added when release branch is created
- **BlogPage** — Static content with no API calls or interactive logic
- **CSS / visual styling** — Not tested at unit/integration level
- **App-level router integration** — E2E concern
