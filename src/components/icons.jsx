const ICONS = {
  box: 'bi-box-seam',
  folder: 'bi-folder2',
  users: 'bi-people',
  bell: 'bi-bell',
  logout: 'bi-box-arrow-right',
  chevronDown: 'bi-chevron-down',
  chevronLeft: 'bi-chevron-left',
  chevronRight: 'bi-chevron-right',
  search: 'bi-search',
  plus: 'bi-plus-lg',
  pencil: 'bi-pencil-square',
  trash: 'bi-trash3',
  printer: 'bi-printer',
  download: 'bi-download',
  check: 'bi-check-lg',
  x: 'bi-x-lg',
  menu: 'bi-list',
  arrowLeft: 'bi-arrow-left',
  file: 'bi-paperclip',
  lock: 'bi-lock-fill',
  unlock: 'bi-unlock-fill',
  sort: 'bi-chevron-expand',
  save: 'bi-floppy',
  alert: 'bi-exclamation-triangle',
  user: 'bi-person',
};

export default function Icon({ name, size = 16, className = '' }) {
  return (
    <i
      className={`bi ${ICONS[name] || ICONS.alert} ${className}`}
      style={{ fontSize: size }}
      aria-hidden="true"
    />
  );
}
