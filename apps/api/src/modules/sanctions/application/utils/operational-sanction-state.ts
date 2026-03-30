import { OperationalSanctionStatus } from '@saferidepro/shared-types';

type ActiveSanctionLike = {
  status: OperationalSanctionStatus;
  endsAt: Date | null;
};

export function isOperationalSanctionCurrentlyActive(
  sanction: ActiveSanctionLike,
  asOf: Date,
): boolean {
  return (
    sanction.status === OperationalSanctionStatus.Active &&
    (!sanction.endsAt || sanction.endsAt.getTime() > asOf.getTime())
  );
}
