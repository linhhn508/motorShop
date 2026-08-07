function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null

  return (
    <nav aria-label="Page navigation">
      <ul className="pagination">
        <li>
          <button
            id="prev-btn"
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            &laquo; Previous
          </button>
        </li>
        <li id="page-numbers">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              className={page === currentPage ? 'active' : ''}
              onClick={() => onPageChange(page)}
            >
              {page}
            </button>
          ))}
        </li>
        <li>
          <button
            id="next-btn"
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            Next &raquo;
          </button>
        </li>
      </ul>
    </nav>
  )
}

export default Pagination
