'use client';

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, type AuditFilters } from '../types/audit';
import { Button } from '../../../components/ui/button';
import { InputField } from '../../../components/ui/input-field';
import { SelectField } from '../../../components/ui/select-field';
import { getAuditActionLabel, getAuditEntityTypeLabel } from '../lib/audit-labels';

type AuditFiltersPanelProps = {
  values: AuditFilters;
  institutionOptions: Array<{
    id: string;
    name: string;
  }>;
  isSubmitting: boolean;
  onChange: (field: keyof AuditFilters, value: string) => void;
  onApply: (event: React.FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
};

export function AuditFiltersPanel({
  values,
  institutionOptions,
  isSubmitting,
  onChange,
  onApply,
  onReset,
}: AuditFiltersPanelProps) {
  return (
    <article className="panel panel-stack">
      <div className="section-heading">
        <h2 className="panel-title">Filtros de auditoria</h2>
        <p className="section-heading-meta">Consulta eventos y reportes revisables</p>
      </div>

      <form className="form-grid form-grid-3" onSubmit={onApply}>
        <SelectField
          label="Institucion"
          onChange={(event) => onChange('institutionId', event.target.value)}
          value={values.institutionId ?? ''}
        >
          <option value="">Todas las accesibles</option>
          {institutionOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Accion"
          onChange={(event) => onChange('action', event.target.value)}
          value={values.action ?? ''}
        >
          <option value="">Todas</option>
          {AUDIT_ACTIONS.map((action) => (
            <option key={action} value={action}>
              {getAuditActionLabel(action)}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Entidad"
          onChange={(event) => onChange('entityType', event.target.value)}
          value={values.entityType ?? ''}
        >
          <option value="">Todas</option>
          {AUDIT_ENTITY_TYPES.map((entityType) => (
            <option key={entityType} value={entityType}>
              {getAuditEntityTypeLabel(entityType)}
            </option>
          ))}
        </SelectField>

        <InputField
          label="Desde"
          onChange={(event) => onChange('from', event.target.value)}
          type="datetime-local"
          value={values.from ?? ''}
        />

        <InputField
          label="Hasta"
          onChange={(event) => onChange('to', event.target.value)}
          type="datetime-local"
          value={values.to ?? ''}
        />

        <SelectField
          label="Limite"
          onChange={(event) => onChange('limit', event.target.value)}
          value={values.limit ?? '50'}
        >
          <option value="25">25 eventos</option>
          <option value="50">50 eventos</option>
          <option value="100">100 eventos</option>
        </SelectField>

        <div className="button-row">
          <Button disabled={isSubmitting} type="submit">
            Aplicar filtros
          </Button>
          <Button disabled={isSubmitting} onClick={onReset} type="button" variant="ghost">
            Limpiar
          </Button>
        </div>
      </form>
    </article>
  );
}
