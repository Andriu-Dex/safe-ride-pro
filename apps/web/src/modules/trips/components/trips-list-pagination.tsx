import { Button } from '../../../components/ui/button';
import styles from './trips-list-pagination.module.css';

type TripsListPaginationProps = {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
};

export function TripsListPagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
}: TripsListPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalItems <= pageSize) {
    return null;
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(totalItems, page * pageSize);

  return (
    <div className={styles.pagination}>
      <span className={styles.info}>
        Mostrando {start} a {end} de {totalItems}
      </span>

      <div className={styles.actions}>
        <Button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          variant="ghost"
        >
          Anterior
        </Button>
        <span className={styles.label}>
          Pagina {page} de {totalPages}
        </span>
        <Button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          variant="ghost"
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
