import Icon from './icons.jsx';

function buildPages(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  const result = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push('...');
    result.push(page);
  });
  return result;
}

export default function Pagination({ meta, onChange }) {
  if (!meta || !meta.total) return null;

  const { page, limit, total, total_pages: totalPages } = meta;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 px-3 py-3 border-top">
      <small className="text-secondary">
        Menampilkan {from}-{to} dari {total} data
      </small>
      <ul className="pagination pagination-sm mb-0">
        <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
          <button
            type="button"
            className="page-link"
            onClick={() => onChange(page - 1)}
            aria-label="Halaman sebelumnya"
          >
            <Icon name="chevronLeft" size={12} />
          </button>
        </li>
        {buildPages(page, totalPages).map((item, index) =>
          item === '...' ? (
            <li key={`gap-${index}`} className="page-item disabled">
              <span className="page-link">...</span>
            </li>
          ) : (
            <li key={item} className={`page-item ${item === page ? 'active' : ''}`}>
              <button type="button" className="page-link" onClick={() => onChange(item)}>
                {item}
              </button>
            </li>
          )
        )}
        <li className={`page-item ${page >= totalPages ? 'disabled' : ''}`}>
          <button
            type="button"
            className="page-link"
            onClick={() => onChange(page + 1)}
            aria-label="Halaman berikutnya"
          >
            <Icon name="chevronRight" size={12} />
          </button>
        </li>
      </ul>
    </div>
  );
}
