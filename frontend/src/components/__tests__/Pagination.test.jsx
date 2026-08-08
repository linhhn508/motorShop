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
