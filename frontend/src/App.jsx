import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import HomePage from './pages/HomePage'
import BlogPage from './pages/BlogPage'
import ContactPage from './pages/ContactPage'
import FeedbackPage from './pages/FeedbackPage'
import ProductInfoPage from './pages/ProductInfoPage'

function App() {
  return (
    <>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/product/:productId" element={<ProductInfoPage />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}

export default App
